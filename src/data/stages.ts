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
  // 6~10 기사 구간 (배치형 · 총량 30 · garrison 지속보충)
  { units: ['shield', 'swordsman'], formation: { shield: 15, swordsman: 15 } }, // 6
  { units: ['spear', 'archer'], formation: { spear: 15, archer: 15 } }, // 7
  { units: ['shield', 'swordsman', 'archer'], formation: { shield: 10, swordsman: 10, archer: 10 } }, // 8
  { units: ['shield', 'spear', 'archer', 'catapult'], formation: { shield: 9, spear: 9, archer: 9, catapult: 3 } }, // 9
  { units: BASE5, formation: { shield: 7, swordsman: 7, spear: 7, archer: 6, catapult: 3 } }, // 10 ⭐기사 보스
  // 11~20 마법사 시대 (총량 40)
  { units: ['shield', 'spear', 'mageLow'], formation: { shield: 14, spear: 14, mageLow: 12 }, unlocksUnit: 'mageLow' }, // 11
  { units: ['swordsman', 'archer', 'mageLow'], formation: { swordsman: 14, archer: 14, mageLow: 12 } }, // 12
  { units: [...BASE5, 'mageLow'], formation: { shield: 8, swordsman: 8, spear: 7, archer: 8, catapult: 3, mageLow: 6 } }, // 13
  { units: ['swordsman', 'shield', 'assassin'], formation: { swordsman: 15, shield: 15, assassin: 10 }, unlocksUnit: 'assassin' }, // 14
  { units: ['archer', 'spear', 'assassin'], formation: { archer: 15, spear: 15, assassin: 10 } }, // 15
  { units: [...BASE5, 'assassin', 'mageLow'], formation: { shield: 7, swordsman: 7, spear: 6, archer: 7, catapult: 3, assassin: 5, mageLow: 5 } }, // 16
  { units: [...BASE5, 'assassin', 'mageLow'], formation: { shield: 7, swordsman: 6, spear: 6, archer: 7, catapult: 4, assassin: 5, mageLow: 5 } }, // 17 — 투석 강화
  { units: [...BASE5, 'mageMid', 'bomber'], formation: { shield: 7, swordsman: 6, spear: 6, archer: 6, catapult: 3, mageMid: 6, bomber: 6 }, unlocksUnit: 'mageMid' }, // 18
  { units: [...BASE5, 'mageMid', 'bomber', 'assassin'], formation: { shield: 6, swordsman: 6, spear: 5, archer: 6, catapult: 3, mageMid: 5, bomber: 5, assassin: 4 } }, // 19
  { units: [...BASE5, 'mageMid', 'bomber', 'assassin'], formation: { shield: 6, swordsman: 6, spear: 5, archer: 6, catapult: 3, mageMid: 5, bomber: 5, assassin: 4 } }, // 20 ⭐마법사 보스
  // 21~30 팔라딘 시대 (총량 50)
  { units: [...BASE5, 'mageMid', 'healer'], formation: { shield: 9, swordsman: 8, spear: 8, archer: 8, catapult: 4, mageMid: 7, healer: 6 }, unlocksUnit: 'healer' }, // 21
  { units: [...BASE5, 'mageMid', 'healer', 'bomber'], formation: { shield: 8, swordsman: 7, spear: 7, archer: 7, catapult: 4, mageMid: 6, healer: 6, bomber: 5 } }, // 22
  { units: [...BASE5, 'healer', 'assassin', 'bomber'], formation: { shield: 8, swordsman: 7, spear: 7, archer: 7, catapult: 4, healer: 6, assassin: 6, bomber: 5 } }, // 23
  { units: [...BASE5, 'cavalry', 'healer'], formation: { shield: 9, swordsman: 8, spear: 8, archer: 8, catapult: 5, cavalry: 6, healer: 6 }, unlocksUnit: 'cavalry' }, // 24
  {
    units: [...BASE5, 'mageHigh', 'cavalry', 'healer'],
    formation: { shield: 8, swordsman: 7, spear: 7, archer: 7, catapult: 4, mageHigh: 6, cavalry: 6, healer: 5 },
    miniBosses: ['knightMini'],
    unlocksUnit: 'mageHigh',
  }, // 25
  { units: [...BASE5, 'mageHigh', 'cavalry', 'healer'], formation: { shield: 8, swordsman: 7, spear: 7, archer: 7, catapult: 4, mageHigh: 6, cavalry: 6, healer: 5 }, miniBosses: ['knightMini'] }, // 26
  { units: [...BASE5, 'mageHigh', 'cavalry', 'bomber'], formation: { shield: 8, swordsman: 7, spear: 6, archer: 7, catapult: 4, mageHigh: 6, cavalry: 6, bomber: 6 }, miniBosses: ['mageMini'] }, // 27
  {
    units: [...BASE5, 'mageHigh', 'assassin', 'bomber', 'healer', 'cavalry'],
    formation: { shield: 7, swordsman: 6, spear: 6, archer: 6, catapult: 3, mageHigh: 5, assassin: 5, bomber: 4, healer: 4, cavalry: 4 },
    miniBosses: ['knightMini'],
  }, // 28
  {
    units: [...BASE5, 'mageHigh', 'assassin', 'bomber', 'healer', 'cavalry'],
    formation: { shield: 6, swordsman: 6, spear: 6, archer: 6, catapult: 3, mageHigh: 5, assassin: 5, bomber: 4, healer: 5, cavalry: 4 },
    miniBosses: ['knightMini', 'mageMini'],
  }, // 29
  {
    units: [...BASE5, 'mageHigh', 'assassin', 'bomber', 'healer', 'cavalry'],
    formation: { shield: 6, swordsman: 6, spear: 6, archer: 6, catapult: 3, mageHigh: 5, assassin: 5, bomber: 4, healer: 5, cavalry: 4 },
    miniBosses: ['knightMini', 'mageMini'],
    bossAppearances: [120, 360],
  }, // 30 ⭐팔라딘 최종 보스
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
