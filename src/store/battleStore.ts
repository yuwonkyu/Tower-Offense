import { create } from 'zustand';
import type { GameSpeed } from '@/game/formulas';
import { expToNextLevel } from '@/game/formulas';
import type { StageConfig, StageDifficulty } from '@/game/types';
import { getStageConfig } from '@/data/stages';
import { HEROES } from '@/data/heroes';
import type { HeroDef } from '@/game/types';

export type BattlePhase = 'ready' | 'running' | 'cardPick' | 'victory' | 'defeat';

interface BattleState {
  config: StageConfig | null;
  hero: HeroDef;
  phase: BattlePhase;
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
  /** 선택한 카드 (cardId → 레벨) */
  pickedCards: Record<string, number>;

  startStage: (stage: number, difficulty?: StageDifficulty) => void;
  tick: (dt: number) => void;
  cycleSpeed: () => void;
  useSkill: () => void;
  reset: () => void;
}

export const useBattleStore = create<BattleState>((set, get) => ({
  config: null,
  hero: HEROES[0],
  phase: 'ready',
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
  pickedCards: {},

  startStage: (stage, difficulty = 'normal') => {
    const config = getStageConfig(stage, difficulty);
    const hero = HEROES[0];
    set({
      config,
      hero,
      phase: 'running',
      timeLeft: config.timeLimit,
      towerHp: config.tower.hp,
      heroHp: hero.stats.hp,
      heroMaxHp: hero.stats.hp,
      heroLevel: 1,
      exp: 0,
      expToNext: expToNextLevel(1),
      skillCooldown: 0,
      kills: 0,
      pickedCards: {},
    });
  },

  tick: (dt) => {
    const s = get();
    if (s.phase !== 'running' || !s.config) return;
    const scaled = dt * s.speed;

    const timeLeft = Math.max(0, s.timeLeft - scaled);
    const skillCooldown = Math.max(0, s.skillCooldown - scaled);

    if (timeLeft <= 0) {
      set({ timeLeft: 0, phase: 'defeat' });
      return;
    }
    set({ timeLeft, skillCooldown });
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
    set({ skillCooldown: s.hero.skill.cooldown });
  },

  reset: () => {
    set({ config: null, phase: 'ready' });
  },
}));
