import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UnitId } from '@/game/types';
import { EXTRA_UNLOCKS } from '@/data/stages';
import { BASE_UNITS } from '@/data/units';
import { NEW_ENEMY_UNITS } from '@/data/enemyUnits';
import { HEROES } from '@/data/heroes';
import {
  heroMetaExpToNext,
  heroMetaLevelFromExp,
  unitUpgradeCardCost,
  unitUpgradeGoldCost,
  unitUpgradeStatBonus,
  HERO_RESET_DIAMONDS,
  HERO_DUPE_EXP,
  UNIT_GACHA_CARDS,
} from '@/game/formulas';

// ── 타입 ─────────────────────────────────────────────────────────────

export interface HeroStatAlloc {
  atk: number;
  def: number;
  hp: number;
  atkSpeed: number;
}

const EMPTY_ALLOC: HeroStatAlloc = { atk: 0, def: 0, hp: 0, atkSpeed: 0 };

export interface HeroMetaInfo {
  level: number;
  expInLevel: number;
  expToNext: number;
  statPtsAvailable: number;
  skillPtsAvailable: number;
  invested: HeroStatAlloc;
  skillLevel: number;
}

// ── 가챠 풀 ───────────────────────────────────────────────────────────

const ALL_UNIT_IDS: UnitId[] = [
  ...BASE_UNITS.map((u) => u.id),
  ...NEW_ENEMY_UNITS.map((u) => u.id),
];

const HERO_IDS = HEROES.map((h) => h.id);

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── 상태 인터페이스 ───────────────────────────────────────────────────

interface ProgressState {
  clearedStage: number;
  gold: number;
  diamonds: number;
  unlockedUnits: UnitId[];
  /** 전투에 출전할 영웅 (기본 'maruhan') */
  selectedHeroId: string;

  // 영웅 메타
  heroExp: Record<string, number>;
  heroInvestedStats: Record<string, HeroStatAlloc>;
  heroSkillLevel: Record<string, number>;

  // 유닛 메타
  unitCardCounts: Record<string, number>;
  unitLevels: Record<string, number>;

  // ── 스테이지 결과 ──
  onStageClear: (params: {
    stage: number;
    goldEarned: number;
    unlocksUnit?: UnitId;
    heroId: string;
    heroExpGained: number;
  }) => void;
  onStageDefeat: (params: {
    goldEarned: number;
    heroId: string;
    heroExpGained: number;
  }) => void;

  /** 출전 영웅 선택 */
  selectHero: (heroId: string) => void;

  // ── 영웅 메타 ──
  getHeroMeta: (heroId: string) => HeroMetaInfo;
  investHeroStat: (heroId: string, stat: keyof HeroStatAlloc) => boolean;
  upgradeHeroSkill: (heroId: string) => boolean;
  resetHeroStats: (heroId: string) => boolean;
  /** 전투 시작 전 영웅 기본 스탯에 메타 보너스 적용 */
  getHeroAdjustedStats: (heroId: string, baseStats: Record<string, number>) => Record<string, number>;

  // ── 유닛 메타 ──
  upgradeUnit: (unitId: string) => boolean;
  /** 유닛 메타 레벨 보너스 맵 (엔진 전달용): unitId → 보너스 배수 */
  getUnitMetaBonuses: () => Record<string, number>;

  // ── 가챠 ──
  pullUnitGacha: () => { unitId: string; count: number; newlyUnlocked: boolean }[];
  pullHeroGacha: () => { heroId: string; isDupe: boolean; expGained: number };

  // ── 재화 ──
  addGold: (amount: number) => void;
  addDiamonds: (amount: number) => void;
  spendGold: (amount: number) => boolean;
  spendDiamonds: (amount: number) => boolean;

  _reset: () => void;
}

// ── 초기값 ────────────────────────────────────────────────────────────

const INITIAL = {
  clearedStage: 0,
  gold: 300,     // 초기 금화 (강화 체험용)
  diamonds: 200, // 초기 다이아 (가챠 체험용)
  unlockedUnits: [] as UnitId[],
  selectedHeroId: 'maruhan',
  heroExp: {} as Record<string, number>,
  heroInvestedStats: {} as Record<string, HeroStatAlloc>,
  heroSkillLevel: {} as Record<string, number>,
  unitCardCounts: {} as Record<string, number>,
  unitLevels: {} as Record<string, number>,
};

// ── 내부 헬퍼 ────────────────────────────────────────────────────────

function addHeroExpMut(
  heroExp: Record<string, number>,
  heroId: string,
  amount: number,
): Record<string, number> {
  return { ...heroExp, [heroId]: (heroExp[heroId] ?? 0) + amount };
}

// ── 스토어 ────────────────────────────────────────────────────────────

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      onStageClear: ({ stage, goldEarned, unlocksUnit, heroId, heroExpGained }) => {
        const s = get();
        const newCleared = Math.max(s.clearedStage, stage);

        const toUnlock = new Set<UnitId>(s.unlockedUnits);
        if (unlocksUnit) toUnlock.add(unlocksUnit);
        const extras = EXTRA_UNLOCKS[stage];
        if (extras) extras.forEach((u) => toUnlock.add(u));

        set({
          clearedStage: newCleared,
          gold: s.gold + goldEarned,
          unlockedUnits: [...toUnlock],
          heroExp: addHeroExpMut(s.heroExp, heroId, heroExpGained),
        });
      },

      onStageDefeat: ({ goldEarned, heroId, heroExpGained }) => {
        const s = get();
        set({
          gold: s.gold + goldEarned,
          heroExp: addHeroExpMut(s.heroExp, heroId, heroExpGained),
        });
      },

      selectHero: (heroId) => set({ selectedHeroId: heroId }),

      // ── 영웅 메타 ──────────────────────────────────────────────────

      getHeroMeta: (heroId) => {
        const s = get();
        const totalExp = s.heroExp[heroId] ?? 0;
        const { level, expInLevel, expToNext } = heroMetaLevelFromExp(totalExp);

        const invested = s.heroInvestedStats[heroId] ?? EMPTY_ALLOC;
        const usedStatPts = invested.atk + invested.def + invested.hp + invested.atkSpeed;
        const statPtsEarned = level - 1;
        const statPtsAvailable = statPtsEarned - usedStatPts;

        const skillLv = s.heroSkillLevel[heroId] ?? 1;
        const skillPtsEarned = Math.floor((level - 1) / 5);
        const skillPtsAvailable = skillPtsEarned - (skillLv - 1);

        return { level, expInLevel, expToNext, statPtsAvailable, skillPtsAvailable, invested, skillLevel: skillLv };
      },

      investHeroStat: (heroId, stat) => {
        const s = get();
        const meta = s.getHeroMeta(heroId);
        if (meta.statPtsAvailable <= 0) return false;
        const prev = s.heroInvestedStats[heroId] ?? EMPTY_ALLOC;
        set({
          heroInvestedStats: {
            ...s.heroInvestedStats,
            [heroId]: { ...prev, [stat]: prev[stat] + 1 },
          },
        });
        return true;
      },

      upgradeHeroSkill: (heroId) => {
        const s = get();
        const meta = s.getHeroMeta(heroId);
        if (meta.skillPtsAvailable <= 0) return false;
        const cur = s.heroSkillLevel[heroId] ?? 1;
        set({ heroSkillLevel: { ...s.heroSkillLevel, [heroId]: cur + 1 } });
        return true;
      },

      resetHeroStats: (heroId) => {
        const s = get();
        if (s.diamonds < HERO_RESET_DIAMONDS) return false;
        set({
          diamonds: s.diamonds - HERO_RESET_DIAMONDS,
          heroInvestedStats: { ...s.heroInvestedStats, [heroId]: EMPTY_ALLOC },
          heroSkillLevel: { ...s.heroSkillLevel, [heroId]: 1 },
        });
        return true;
      },

      getHeroAdjustedStats: (heroId, baseStats) => {
        const s = get();
        const invested = s.heroInvestedStats[heroId] ?? EMPTY_ALLOC;
        return {
          ...baseStats,
          atk: Math.round((baseStats.atk as number) * (1 + invested.atk * 0.01)),
          def: Math.round((baseStats.def as number) * (1 + invested.def * 0.01)),
          hp: Math.round((baseStats.hp as number) * (1 + invested.hp * 0.01)),
          atkSpeed: parseFloat(
            ((baseStats.atkSpeed as number) * (1 + invested.atkSpeed * 0.01)).toFixed(3),
          ),
        };
      },

      // ── 유닛 메타 ──────────────────────────────────────────────────

      upgradeUnit: (unitId) => {
        const s = get();
        const curLv = s.unitLevels[unitId] ?? 1;
        const nextLv = curLv + 1;
        const cardCost = unitUpgradeCardCost(nextLv);
        const goldCost = unitUpgradeGoldCost(nextLv);
        const cards = s.unitCardCounts[unitId] ?? 0;
        if (cards < cardCost || s.gold < goldCost) return false;
        set({
          unitCardCounts: { ...s.unitCardCounts, [unitId]: cards - cardCost },
          unitLevels: { ...s.unitLevels, [unitId]: nextLv },
          gold: s.gold - goldCost,
        });
        return true;
      },

      getUnitMetaBonuses: () => {
        const s = get();
        const result: Record<string, number> = {};
        for (const [unitId, level] of Object.entries(s.unitLevels)) {
          result[unitId] = unitUpgradeStatBonus(level);
        }
        return result;
      },

      // ── 가챠 ───────────────────────────────────────────────────────

      pullUnitGacha: () => {
        const s = get();
        if (s.diamonds < 50) return [];

        const drawn: Record<string, number> = {};
        for (let i = 0; i < UNIT_GACHA_CARDS; i++) {
          const id = randomFrom(ALL_UNIT_IDS);
          drawn[id] = (drawn[id] ?? 0) + 1;
        }

        const toUnlock = new Set<UnitId>(s.unlockedUnits);
        const results: { unitId: string; count: number; newlyUnlocked: boolean }[] = [];
        const newCounts = { ...s.unitCardCounts };

        for (const [unitId, count] of Object.entries(drawn)) {
          const wasLocked = !toUnlock.has(unitId as UnitId);
          const unit = NEW_ENEMY_UNITS.find((u) => u.id === unitId);
          if (unit && wasLocked) toUnlock.add(unitId as UnitId);
          newCounts[unitId] = (newCounts[unitId] ?? 0) + count;
          results.push({ unitId, count, newlyUnlocked: wasLocked && !!unit });
        }

        set({
          diamonds: s.diamonds - 50,
          unitCardCounts: newCounts,
          unlockedUnits: [...toUnlock],
        });
        return results;
      },

      pullHeroGacha: () => {
        const s = get();
        if (s.diamonds < 100) return { heroId: '', isDupe: false, expGained: 0 };

        const heroId = randomFrom(HERO_IDS);
        // 모든 영웅이 기본 보유 → 항상 중복 (EXP 지급)
        // 추후 영웅 잠금 시스템 도입 시 분기 추가
        const isDupe = true;
        const expGained = HERO_DUPE_EXP;

        set({
          diamonds: s.diamonds - 100,
          heroExp: addHeroExpMut(s.heroExp, heroId, expGained),
        });
        return { heroId, isDupe, expGained };
      },

      // ── 재화 ───────────────────────────────────────────────────────

      addGold: (amount) => set((s) => ({ gold: s.gold + amount })),

      addDiamonds: (amount) => set((s) => ({ diamonds: s.diamonds + amount })),

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
      partialize: (s) => ({
        clearedStage: s.clearedStage,
        gold: s.gold,
        diamonds: s.diamonds,
        unlockedUnits: s.unlockedUnits,
        selectedHeroId: s.selectedHeroId,
        heroExp: s.heroExp,
        heroInvestedStats: s.heroInvestedStats,
        heroSkillLevel: s.heroSkillLevel,
        unitCardCounts: s.unitCardCounts,
        unitLevels: s.unitLevels,
      }),
    },
  ),
);

// ── 유틸 (외부 사용) ─────────────────────────────────────────────────

/** 스테이지 클리어 금화 보상 */
export function calcGoldReward(stage: number, kills: number, victory: boolean): number {
  const base = stage * 20;
  const killBonus = Math.floor(kills * 0.5);
  const total = base + killBonus;
  return victory ? total : Math.floor(total * 0.3);
}
