import type { UnitId } from '@/game/types';

/**
 * 적 유닛 구성 비율 (설계 10) — 기본 5종, 스테이지 구간별 %.
 * 스테이지 패턴(설계 13)에 등장하는 유닛만 필터 후 재정규화.
 */
const BASE_RATIO_RANGES: { maxStage: number; ratio: Partial<Record<UnitId, number>> }[] = [
  { maxStage: 3, ratio: { shield: 40, archer: 0, spear: 40, catapult: 0, swordsman: 20 } },
  { maxStage: 7, ratio: { shield: 30, archer: 20, spear: 30, catapult: 0, swordsman: 20 } },
  { maxStage: 10, ratio: { shield: 25, archer: 25, spear: 20, catapult: 5, swordsman: 25 } },
  { maxStage: 15, ratio: { shield: 20, archer: 25, spear: 20, catapult: 10, swordsman: 25 } },
  { maxStage: 20, ratio: { shield: 20, archer: 25, spear: 15, catapult: 15, swordsman: 25 } },
  { maxStage: 30, ratio: { shield: 15, archer: 30, spear: 15, catapult: 20, swordsman: 20 } },
];

/** 신규 유닛(마법사/암살자 등) 가중치 — 임시값, 밸런스 테스트 후 조정 */
const NEW_UNIT_WEIGHT = 12;

/**
 * 유닛별 생성 빈도 배수 (1 = 기본). 원거리/공성/기마는 ↓ → 근접 위주의 백병전 연출 + 밸런스.
 * 아군·적군 양측 공통 적용 (피드백: 투석기/원거리/기마병 생성속도 하향).
 */
export const SPAWN_FREQ: Partial<Record<UnitId, number>> = {
  // "조금" 하향 — 공성 화력(투석기) 급감 방지하면서 근접 비중↑ (시뮬: 과하면 타워 미타격)
  catapult: 0.7,
  archer: 0.8,
  mageLow: 0.8,
  mageMid: 0.8,
  mageHigh: 0.8,
  assassin: 0.8,
  cavalry: 0.7,
  bomber: 0.85,
  healer: 0.85,
};

export function spawnFreq(unitId: UnitId): number {
  return SPAWN_FREQ[unitId] ?? 1;
}

export interface SpawnWeight {
  unitId: UnitId;
  weight: number;
}

export function spawnWeightsForStage(stage: number, units: UnitId[]): SpawnWeight[] {
  const range =
    BASE_RATIO_RANGES.find((r) => stage <= r.maxStage) ??
    BASE_RATIO_RANGES[BASE_RATIO_RANGES.length - 1];

  let weights = units.map((unitId) => ({
    unitId,
    weight: (range.ratio[unitId] ?? NEW_UNIT_WEIGHT) * spawnFreq(unitId),
  }));

  // 단일 유닛 스테이지에서 비율표가 0이면 균등 분배 (빈도 배수 반영)
  if (weights.reduce((sum, w) => sum + w.weight, 0) <= 0) {
    weights = units.map((unitId) => ({ unitId, weight: spawnFreq(unitId) }));
  }
  return weights;
}
