import type { MiniBossId, StageConfig, StageDifficulty, UnitId } from '@/game/types';
import {
  enemyStatMultiplier,
  expMultiplierForStage,
  HARD_MODE,
  spawnRateForStage,
  STAGE_TIME_LIMIT,
} from '@/game/formulas';
import { enemyHeroForStage } from './enemyHeroes';
import { TOWER_TABLE } from './towers';

const BASE5: UnitId[] = ['shield', 'archer', 'spear', 'catapult', 'swordsman'];

interface StagePattern {
  units: UnitId[];
  miniBosses?: MiniBossId[];
  unlocksUnit?: UnitId;
  /** 30스테이지: 팔라딘 등장 시점 (초). 10분 게임 기준 2분/6분 */
  bossAppearances?: number[];
  /** 배치형 수비 진형 (종류별 마릿수). 설정 시 연속 스폰 대신 일괄 배치 + 보충 */
  formation?: Partial<Record<UnitId, number>>;
  /** 배치형 분당 보충률 % (0/미설정 = 일회성 돌파) */
  reinforcePctPerMin?: number;
}

/**
 * 스테이지별 유닛 조합 패턴 (설계 13).
 * 인덱스 = 스테이지 - 1.
 */
const STAGE_PATTERNS: StagePattern[] = [
  // 1~5 배치형 튜토리얼 (단일 종족 30 배치 · 보충 0 · 일회성 돌파)
  { units: ['shield'], formation: { shield: 30 } }, // 1
  { units: ['swordsman'], formation: { swordsman: 30 } }, // 2
  { units: ['spear'], formation: { spear: 30 } }, // 3
  { units: ['archer'], formation: { archer: 30 } }, // 4
  { units: ['catapult'], formation: { catapult: 30 } }, // 5
  { units: ['swordsman', 'shield'] }, // 6
  { units: ['archer', 'spear'] }, // 7
  { units: ['shield', 'swordsman', 'archer'] }, // 8
  { units: ['shield', 'catapult', 'archer', 'spear'] }, // 9
  { units: BASE5 }, // 10 — 기사 BOSS 스테이지
  // 11~20 마법사 시대
  { units: ['shield', 'spear', 'mageLow'], unlocksUnit: 'mageLow' }, // 11
  { units: ['swordsman', 'archer', 'mageLow'] }, // 12
  { units: [...BASE5, 'mageLow'] }, // 13
  { units: ['swordsman', 'shield', 'assassin'], unlocksUnit: 'assassin' }, // 14
  { units: ['archer', 'spear', 'assassin'] }, // 15
  { units: [...BASE5, 'assassin', 'mageLow'] }, // 16
  { units: [...BASE5, 'assassin', 'mageLow'] }, // 17 — 투석기 강화
  { units: [...BASE5, 'mageMid', 'bomber'], unlocksUnit: 'mageMid' }, // 18 — 폭탄병도 동시 등장
  { units: [...BASE5, 'mageMid', 'bomber', 'assassin'] }, // 19
  { units: [...BASE5, 'mageMid', 'bomber', 'assassin'] }, // 20 — 마법사 BOSS 스테이지
  // 21~30 팔라딘 시대
  { units: [...BASE5, 'mageMid', 'healer'], unlocksUnit: 'healer' }, // 21
  { units: [...BASE5, 'mageMid', 'healer', 'bomber'] }, // 22
  { units: [...BASE5, 'healer', 'assassin', 'bomber'] }, // 23
  { units: [...BASE5, 'cavalry', 'healer'], unlocksUnit: 'cavalry' }, // 24
  {
    units: [...BASE5, 'mageHigh', 'cavalry', 'healer'],
    miniBosses: ['knightMini'],
    unlocksUnit: 'mageHigh',
  }, // 25
  { units: [...BASE5, 'mageHigh', 'cavalry', 'healer'], miniBosses: ['knightMini'] }, // 26
  { units: [...BASE5, 'mageHigh', 'cavalry', 'bomber'], miniBosses: ['mageMini'] }, // 27
  {
    units: [...BASE5, 'mageHigh', 'assassin', 'bomber', 'healer', 'cavalry'],
    miniBosses: ['knightMini'],
  }, // 28
  {
    units: [...BASE5, 'mageHigh', 'assassin', 'bomber', 'healer', 'cavalry'],
    miniBosses: ['knightMini', 'mageMini'],
  }, // 29
  {
    units: [...BASE5, 'mageHigh', 'assassin', 'bomber', 'healer', 'cavalry'],
    miniBosses: ['knightMini', 'mageMini'],
    bossAppearances: [120, 360],
  }, // 30 — 팔라딘 최종 보스
];

/** 폭탄병 18 스테이지 클리어 시 해금 (mageMid 와 동시 등장 — 둘 다 해금) */
export const EXTRA_UNLOCKS: Record<number, UnitId[]> = {
  18: ['mageMid', 'bomber'],
};

export const TOTAL_STAGES = 30;

export function getStageConfig(stage: number, difficulty: StageDifficulty = 'normal'): StageConfig {
  const idx = Math.min(TOTAL_STAGES, Math.max(1, stage)) - 1;
  const pattern = STAGE_PATTERNS[idx];
  const tower = TOWER_TABLE[idx];
  const hard = difficulty === 'hard';

  return {
    stage,
    difficulty,
    timeLimit: STAGE_TIME_LIMIT,
    tower: {
      hp: hard ? tower.hp * HARD_MODE.towerHpMultiplier : tower.hp,
      def: tower.def,
    },
    enemyHero: enemyHeroForStage(stage).id,
    enemyUnits: pattern.units,
    formation: pattern.formation,
    reinforcePctPerMin: pattern.reinforcePctPerMin,
    spawnRate: spawnRateForStage(stage),
    statMultiplier: enemyStatMultiplier(stage) * (hard ? 1 + HARD_MODE.enemyStatBonus : 1),
    expMultiplier: expMultiplierForStage(stage),
    miniBosses: pattern.miniBosses ?? [],
    unlocksUnit: pattern.unlocksUnit,
    bossAppearances: pattern.bossAppearances,
  };
}

/** 하드 모드 해금: 일반 N클리어마다 하드 (N-9)~N 10개 오픈 */
export function hardStagesUnlocked(normalCleared: number): number {
  return Math.floor(normalCleared / 10) * 10;
}
