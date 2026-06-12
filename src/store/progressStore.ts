import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UnitId } from '@/game/types';
import { EXTRA_UNLOCKS } from '@/data/stages';

interface ProgressState {
  /** 일반 모드 최고 클리어 스테이지 (0 = 미클리어) */
  clearedStage: number;
  gold: number;
  diamonds: number;
  /** 해금된 적 유닛 목록 (플레이어가 편성 가능한 유닛) */
  unlockedUnits: UnitId[];

  /** 스테이지 클리어 시 호출 — 진행도/보상/해금 반영 */
  onStageClear: (params: {
    stage: number;
    goldEarned: number;
    unlocksUnit?: UnitId;
  }) => void;
  /** 패배 시 킬 보상(부분) 지급 */
  onStageDefeat: (params: { goldEarned: number }) => void;
  addDiamonds: (amount: number) => void;
  spendGold: (amount: number) => boolean;
  spendDiamonds: (amount: number) => boolean;
  _reset: () => void;
}

const INITIAL: Pick<
  ProgressState,
  'clearedStage' | 'gold' | 'diamonds' | 'unlockedUnits'
> = {
  clearedStage: 0,
  gold: 0,
  diamonds: 0,
  unlockedUnits: [],
};

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      onStageClear: ({ stage, goldEarned, unlocksUnit }) => {
        const s = get();
        const newCleared = Math.max(s.clearedStage, stage);

        // 해금 처리: 스테이지 지정 유닛 + EXTRA_UNLOCKS
        const toUnlock = new Set<UnitId>(s.unlockedUnits);
        if (unlocksUnit) toUnlock.add(unlocksUnit);
        const extras = EXTRA_UNLOCKS[stage];
        if (extras) extras.forEach((u) => toUnlock.add(u));

        set({
          clearedStage: newCleared,
          gold: s.gold + goldEarned,
          unlockedUnits: [...toUnlock],
        });
      },

      onStageDefeat: ({ goldEarned }) => {
        set((s) => ({ gold: s.gold + goldEarned }));
      },

      addDiamonds: (amount) => {
        set((s) => ({ diamonds: s.diamonds + amount }));
      },

      spendGold: (amount) => {
        const { gold } = get();
        if (gold < amount) return false;
        set({ gold: gold - amount });
        return true;
      },

      spendDiamonds: (amount) => {
        const { diamonds } = get();
        if (diamonds < amount) return false;
        set({ diamonds: diamonds - amount });
        return true;
      },

      _reset: () => set(INITIAL),
    }),
    {
      name: 'tower-offense-progress',
      storage: createJSONStorage(() => AsyncStorage),
      // unlockedUnits는 Set으로 관리하나 JSON 직렬화를 위해 배열 저장
      partialize: (s) => ({
        clearedStage: s.clearedStage,
        gold: s.gold,
        diamonds: s.diamonds,
        unlockedUnits: s.unlockedUnits,
      }),
    },
  ),
);

/** 스테이지 클리어 금화 보상 */
export function calcGoldReward(stage: number, kills: number, victory: boolean): number {
  const base = stage * 20;
  const killBonus = Math.floor(kills * 0.5);
  const total = base + killBonus;
  return victory ? total : Math.floor(total * 0.3);
}
