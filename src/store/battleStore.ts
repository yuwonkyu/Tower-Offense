import { create } from 'zustand';
import type { GameSpeed } from '@/game/formulas';
import { CARD_PICK_SECONDS, expToNextLevel } from '@/game/formulas';
import type { CardDef, HeroDef, StageConfig, StageDifficulty } from '@/game/types';
import type { BattleEngine } from '@/game/engine/engine';
import { getStageConfig } from '@/data/stages';
import { HEROES } from '@/data/heroes';
import { calcGoldReward, useProgressStore } from '@/store/progressStore';

export type BattlePhase = 'ready' | 'running' | 'cardPick' | 'victory' | 'defeat';

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

  startStage: (stage: number, difficulty?: StageDifficulty) => void;
  /** 매 프레임: 타이머/쿨다운 진행 (dt = 실제 경과 초) */
  tick: (dt: number) => void;
  /** 매 프레임: 엔진 상태를 HUD로 반영 + 카드 선택 트리거 */
  syncFromEngine: (engine: BattleEngine) => void;
  /** 카드 선택 (cardPick 페이즈에서만) */
  pickCard: (cardId: string) => void;
  cycleSpeed: () => void;
  useSkill: () => void;
  reset: () => void;
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
  deaths: 0,
  clearTime: 0,
  goldEarned: 0,
  reviveLeft: 0,
  pickedCards: {},
  pickChoices: [],
  pickTimeLeft: 0,

  startStage: (stage, difficulty = 'normal') => {
    const config = getStageConfig(stage, difficulty);
    // 영웅 메타 스탯 적용
    const progress = useProgressStore.getState();
    const baseHero = HEROES[0];
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
      deaths: 0,
      clearTime: 0,
      goldEarned: 0,
      reviveLeft: 0,
      pickedCards: {},
      pickChoices: [],
      pickTimeLeft: 0,
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
    const skillCooldown = Math.max(0, s.skillCooldown - scaled);

    if (timeLeft <= 0) {
      const elapsed = s.config ? s.config.timeLimit : 600;
      const gold = calcGoldReward(s.config?.stage ?? 1, s.kills, false);
      set({ timeLeft: 0, phase: 'defeat', clearTime: elapsed, goldEarned: gold });
      return;
    }
    set({ timeLeft, skillCooldown, clearTime: (s.config?.timeLimit ?? 600) - timeLeft });
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
          heroLevel: engine.level,
          exp: engine.expInLevel,
          expToNext: engine.expToNext,
        });
        return;
      }
      engine.pendingPicks = 0; // 풀 고갈 — 선택 생략 (TODO: 재화 카드)
    }

    // 영웅 사망 감지: reviveLeft가 새로 생겼으면 사망 1회
    const prevRevive = s.reviveLeft;
    const newRevive = engine.reviveLeft;
    const deathDelta = prevRevive === 0 && newRevive > 0 ? 1 : 0;

    const isVictory = engine.result === 'victory';
    const goldEarned = isVictory
      ? calcGoldReward(s.config?.stage ?? 1, engine.kills, true)
      : s.goldEarned;

    set({
      towerHp: engine.towerHp,
      heroHp: engine.hero.hp,
      heroMaxHp: engine.hero.maxHp,
      heroLevel: engine.level,
      exp: engine.expInLevel,
      expToNext: engine.expToNext,
      kills: engine.kills,
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
        set({ pickedCards, pickChoices, pickTimeLeft: CARD_PICK_SECONDS });
        return;
      }
      engine.pendingPicks = 0;
    }
    set({ pickedCards, phase: 'running', pickChoices: [] });
  },

  cycleSpeed: () => {
    const { speed } = get();
    // x4는 유료/광고 — 프로토타입에서는 모두 개방
    const next: GameSpeed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
    set({ speed: next });
  },

  useSkill: () => {
    const s = get();
    if (s.skillCooldown > 0 || s.phase !== 'running') return;
    // 스킬 쿨타임 감소 카드 적용
    const cdr = s.engine ? s.engine.cards.cdrPct / 100 : 0;
    set({ skillCooldown: s.hero.skill.cooldown * (1 - cdr) });
  },

  reset: () => {
    set({ config: null, phase: 'ready', engine: null, pickChoices: [] });
  },
}));
