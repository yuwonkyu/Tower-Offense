import { create } from 'zustand';
import type { GameSpeed } from '@/game/formulas';
import { CARD_PICK_SECONDS, expToNextLevel, HARD_MODE } from '@/game/formulas';
import type { CardDef, HeroDef, StageConfig, StageDifficulty } from '@/game/types';
import type { BattleEngine } from '@/game/engine/engine';
import { getStageConfig } from '@/data/stages';
import { HEROES } from '@/data/heroes';
import { rollResourceReward } from '@/data/cards';
import { calcGoldReward, useProgressStore } from '@/store/progressStore';
import { useMonetizationStore } from '@/store/monetizationStore';

export type BattlePhase = 'ready' | 'running' | 'cardPick' | 'resourceNotice' | 'victory' | 'defeat';

interface BattleState {
  config: StageConfig | null;
  hero: HeroDef;
  phase: BattlePhase;
  /** 전투 엔진 참조 (BattleField가 생성, 매 프레임 동기화) */
  engine: BattleEngine | null;
  /** 남은 시간 (초) */
  timeLeft: number;
  speed: GameSpeed;
  towerHp: number;
  heroHp: number;
  heroMaxHp: number;
  heroLevel: number;
  /** 현재 레벨에서 쌓은 EXP */
  exp: number;
  expToNext: number;
  /** 스킬 남은 쿨타임 (초) */
  skillCooldown: number;
  kills: number;
  /** 생존 적 유닛 수 (HUD 상단 — 피드백 11) */
  enemyCount: number;
  /** 생존 아군 유닛 수 (HUD 하단 — 피드백 11) */
  allyCount: number;
  /** 영웅 사망 횟수 (정산용) */
  deaths: number;
  /** 결과 확정 시점까지 경과한 게임 내 시간 (초) */
  clearTime: number;
  /** 이번 전투에서 획득할 금화 (정산에서 읽기용) */
  goldEarned: number;
  /** 영웅 부활 카운트다운 (0 = 생존) */
  reviveLeft: number;
  /** 보유 카드 (cardId → 레벨) */
  pickedCards: Record<string, number>;
  /** 카드 선택지 3장 (cardPick 페이즈) */
  pickChoices: CardDef[];
  /** 카드 선택 남은 시간 (초) — 만료 시 랜덤 선택 */
  pickTimeLeft: number;
  /** 이번 선택에서 리롤(광고) 사용 여부 — 픽당 1회 */
  rerollUsed: boolean;
  /** x4 배속 세션 해금 (광고 시청) — adFree 구매 시 항상 개방 */
  x4Unlocked: boolean;
  /** 승리 보상 2배 적용 여부 (광고, 1회) */
  rewardDoubled: boolean;
  /** 카드 풀 소진 → 재화 자동 습득 모드 진입 여부 (안내 1회 후 활성) */
  resourceAutoActive: boolean;
  /** 안내 모달 표시용 직전 자동 습득 누적 (gold/diamonds) */
  resourceGain: { gold: number; diamonds: number };

  startStage: (stage: number, difficulty?: StageDifficulty) => void;
  /** 매 프레임: 타이머/쿨다운 진행 (dt = 실제 경과 초) */
  tick: (dt: number) => void;
  /** 매 프레임: 엔진 상태를 HUD로 반영 + 카드 선택 트리거 */
  syncFromEngine: (engine: BattleEngine) => void;
  /** 카드 선택 (cardPick 페이즈에서만) */
  pickCard: (cardId: string) => void;
  /** 재화 자동 습득 안내 닫기 → running 복귀 */
  dismissResourceNotice: () => void;
  /** 카드 선택지 리롤 (광고 보상) — 픽당 1회 */
  rerollCards: () => void;
  /** 배속 순환. x4 진입이 잠겨 있으면 'needsX4Ad' 반환 (광고 유도) */
  cycleSpeed: () => 'needsX4Ad' | null;
  /** x4 세션 해금 (광고 보상) + 즉시 x4 적용 */
  unlockX4: () => void;
  /** 승리 보상 2배 (광고 보상, 1회) — 추가분 금화를 반환 */
  applyDoubleReward: () => number;
  useSkill: () => void;
  reset: () => void;
}

/** 정산 금화 배수 = 프리미엄 패스(2배) × 하드 모드(2배) 합성 */
function settlementGoldMult(config: StageConfig | null): number {
  const premium = useMonetizationStore.getState().adFree ? 2 : 1;
  const hard = config?.difficulty === 'hard' ? HARD_MODE.rewardMultiplier : 1;
  return premium * hard;
}

/**
 * 카드 풀 고갈 상태에서 쌓인 선택권(pendingPicks)을 모두 재화로 환산·즉시 지급.
 * 선택 UI 없이 자동 습득 (잉여 레벨업 → 골드/다이아). 누적 지급액 반환.
 */
function drainPendingResources(engine: BattleEngine): { gold: number; diamonds: number } {
  let gold = 0;
  let diamonds = 0;
  while (engine.pendingPicks > 0) {
    const r = rollResourceReward();
    gold += r.gold;
    diamonds += r.diamonds;
    engine.pendingPicks--;
  }
  if (gold > 0 || diamonds > 0) {
    const prog = useProgressStore.getState();
    if (gold > 0) prog.addGold(gold);
    if (diamonds > 0) prog.addDiamonds(diamonds);
  }
  return { gold, diamonds };
}

export const useBattleStore = create<BattleState>((set, get) => ({
  config: null,
  hero: HEROES[0],
  phase: 'ready',
  engine: null,
  timeLeft: 600,
  speed: 1,
  towerHp: 0,
  heroHp: 0,
  heroMaxHp: 0,
  heroLevel: 1,
  exp: 0,
  expToNext: expToNextLevel(1),
  skillCooldown: 0,
  kills: 0,
  enemyCount: 0,
  allyCount: 0,
  deaths: 0,
  clearTime: 0,
  goldEarned: 0,
  reviveLeft: 0,
  pickedCards: {},
  pickChoices: [],
  pickTimeLeft: 0,
  rerollUsed: false,
  x4Unlocked: false,
  rewardDoubled: false,
  resourceAutoActive: false,
  resourceGain: { gold: 0, diamonds: 0 },

  startStage: (stage, difficulty = 'normal') => {
    const config = getStageConfig(stage, difficulty);
    // 선택 영웅 + 메타 스탯 적용
    const progress = useProgressStore.getState();
    const baseHero = HEROES.find((h) => h.id === progress.selectedHeroId) ?? HEROES[0];
    const adjustedStats = progress.getHeroAdjustedStats(
      baseHero.id,
      baseHero.stats as unknown as Record<string, number>,
    ) as unknown as typeof baseHero.stats;
    const hero: HeroDef = { ...baseHero, stats: adjustedStats };
    set({
      config,
      hero,
      phase: 'running',
      engine: null,
      timeLeft: config.timeLimit,
      towerHp: config.tower.hp,
      heroHp: hero.stats.hp,
      heroMaxHp: hero.stats.hp,
      heroLevel: 1,
      exp: 0,
      expToNext: expToNextLevel(1),
      skillCooldown: 0,
      kills: 0,
      enemyCount: 0,
      allyCount: 0,
      deaths: 0,
      clearTime: 0,
      goldEarned: 0,
      reviveLeft: 0,
      pickedCards: {},
      pickChoices: [],
      pickTimeLeft: 0,
      rerollUsed: false,
      rewardDoubled: false,
      resourceAutoActive: false,
      resourceGain: { gold: 0, diamonds: 0 },
      // x4Unlocked는 세션(앱 실행) 단위 유지 — 스테이지마다 리셋하지 않음
    });
  },

  tick: (dt) => {
    const s = get();

    // 카드 선택 중: 전투 일시정지, 선택 타이머만 실시간 진행 (배속 미적용)
    if (s.phase === 'cardPick') {
      const pickTimeLeft = s.pickTimeLeft - dt;
      if (pickTimeLeft <= 0) {
        const random = s.pickChoices[Math.floor(Math.random() * s.pickChoices.length)];
        if (random) {
          get().pickCard(random.id);
        } else {
          set({ phase: 'running', pickChoices: [] });
        }
        return;
      }
      set({ pickTimeLeft });
      return;
    }

    if (s.phase !== 'running') return;
    const scaled = dt * s.speed;

    const timeLeft = Math.max(0, s.timeLeft - scaled);

    if (timeLeft <= 0) {
      const elapsed = s.config ? s.config.timeLimit : 600;
      const gold = calcGoldReward(s.config?.stage ?? 1, s.kills, false) * settlementGoldMult(s.config);
      set({ timeLeft: 0, phase: 'defeat', clearTime: elapsed, goldEarned: gold });
      return;
    }
    set({ timeLeft, clearTime: (s.config?.timeLimit ?? 600) - timeLeft });
  },

  syncFromEngine: (engine) => {
    const s = get();
    if (s.engine !== engine) set({ engine });
    if (s.phase !== 'running') return;

    // 레벨업(또는 전투 시작)으로 쌓인 선택권 → 카드 선택 페이즈
    if (engine.result === 'ongoing' && engine.pendingPicks > 0) {
      const pickChoices = engine.cards.rollChoices(3);
      if (pickChoices.length > 0) {
        set({
          phase: 'cardPick',
          pickChoices,
          pickTimeLeft: CARD_PICK_SECONDS,
          rerollUsed: false,
          heroLevel: engine.level,
          exp: engine.expInLevel,
          expToNext: engine.expToNext,
        });
        return;
      }
      // 풀 고갈(모든 카드 만렙) → 재화 자동 습득. 최초 1회만 안내 카드, 이후 조용히 지급
      const gain = drainPendingResources(engine);
      if (!s.resourceAutoActive && (gain.gold > 0 || gain.diamonds > 0)) {
        set({
          phase: 'resourceNotice',
          resourceAutoActive: true,
          resourceGain: gain,
          heroLevel: engine.level,
          exp: engine.expInLevel,
          expToNext: engine.expToNext,
        });
        return;
      }
    }

    // 영웅 사망 감지: reviveLeft가 새로 생겼으면 사망 1회
    const prevRevive = s.reviveLeft;
    const newRevive = engine.reviveLeft;
    const deathDelta = prevRevive === 0 && newRevive > 0 ? 1 : 0;

    const isVictory = engine.result === 'victory';
    const goldEarned = isVictory
      ? calcGoldReward(s.config?.stage ?? 1, engine.kills, true) * settlementGoldMult(s.config)
      : s.goldEarned;

    set({
      towerHp: engine.towerHp,
      heroHp: engine.hero.hp,
      heroMaxHp: engine.hero.maxHp,
      heroLevel: engine.level,
      exp: engine.expInLevel,
      expToNext: engine.expToNext,
      skillCooldown: engine.heroSkillCd,
      kills: engine.kills,
      enemyCount: engine.enemyAlive,
      allyCount: engine.allyAlive,
      deaths: s.deaths + deathDelta,
      reviveLeft: newRevive,
      goldEarned,
      ...(isVictory ? { phase: 'victory' as const } : null),
    });
  },

  pickCard: (cardId) => {
    const s = get();
    const engine = s.engine;
    if (!engine || s.phase !== 'cardPick') return;

    engine.pickCard(cardId);
    const pickedCards = Object.fromEntries(engine.cards.owned);

    // MAX 보너스 등으로 선택권이 남아 있으면 연속 선택
    if (engine.pendingPicks > 0) {
      const pickChoices = engine.cards.rollChoices(3);
      if (pickChoices.length > 0) {
        set({ pickedCards, pickChoices, pickTimeLeft: CARD_PICK_SECONDS, rerollUsed: false });
        return;
      }
      // 연속 선택 중 풀 고갈 → 재화 자동 습득 (최초 1회 안내)
      const gain = drainPendingResources(engine);
      if (!s.resourceAutoActive && (gain.gold > 0 || gain.diamonds > 0)) {
        set({ pickedCards, phase: 'resourceNotice', resourceAutoActive: true, resourceGain: gain });
        return;
      }
    }
    set({ pickedCards, phase: 'running', pickChoices: [] });
  },

  dismissResourceNotice: () => {
    if (get().phase !== 'resourceNotice') return;
    set({ phase: 'running' });
  },

  rerollCards: () => {
    const s = get();
    // 리롤은 픽당 1회 (프리미엄=무료·광고X / 일반=광고) — 무료/광고 분기는 battle.tsx
    if (s.phase !== 'cardPick' || s.rerollUsed || !s.engine) return;
    const pickChoices = s.engine.cards.rollChoices(3);
    if (pickChoices.length === 0) return;
    set({ pickChoices, rerollUsed: true, pickTimeLeft: CARD_PICK_SECONDS });
  },

  cycleSpeed: () => {
    const { speed, x4Unlocked } = get();
    const adFree = useMonetizationStore.getState().adFree;
    if (speed === 2 && !adFree && !x4Unlocked) {
      // x4 잠김 — 광고 또는 광고 제거 구매 필요 (설계 06: IAA + IAP)
      return 'needsX4Ad';
    }
    const next: GameSpeed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
    set({ speed: next });
    return null;
  },

  unlockX4: () => {
    set({ x4Unlocked: true, speed: 4 });
  },

  applyDoubleReward: () => {
    const s = get();
    if (s.phase !== 'victory' || s.rewardDoubled) return 0;
    const delta = s.goldEarned;
    set({ goldEarned: s.goldEarned * 2, rewardDoubled: true });
    return delta;
  },

  useSkill: () => {
    const s = get();
    if (s.phase !== 'running' || !s.engine) return;
    // 실효과는 엔진에서 발동 (투신/살소나기/피노을) — 쿨타임도 엔진이 관리
    s.engine.useHeroSkill();
  },

  reset: () => {
    set({
      config: null,
      phase: 'ready',
      engine: null,
      pickChoices: [],
      resourceAutoActive: false,
      resourceGain: { gold: 0, diamonds: 0 },
    });
  },
}));
