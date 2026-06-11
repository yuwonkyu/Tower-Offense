/**
 * 게임 전역 공식 모음.
 * 출처: docs/design/08 (피해), PROGRESS 2026-06-11 (EXP 곡선 / 강화 비용).
 */

/** 실제피해 = 공격력 × (100 / (100 + 방어력)) */
export function damage(atk: number, def: number): number {
  return atk * (100 / (100 + Math.max(0, def)));
}

/** 레벨 L 도달에 필요한 누적 EXP = (L-1) × (10L + 50) */
export function expTotalForLevel(level: number): number {
  return (level - 1) * (10 * level + 50);
}

/** 레벨 L → L+1 필요 EXP = 50 + 20L */
export function expToNextLevel(level: number): number {
  return 50 + 20 * level;
}

/** 누적 EXP 로 현재 레벨 계산 */
export function levelFromExp(totalExp: number): number {
  let level = 1;
  while (expTotalForLevel(level + 1) <= totalExp) level++;
  return level;
}

/** 유닛 카드 강화: n레벨 도달에 필요한 카드 수 (최대 999) */
export function unitUpgradeCardCost(targetLevel: number): number {
  return Math.min(999, Math.round(2 * Math.pow(targetLevel / 2, 1.59)));
}

/** 유닛 카드 강화: n레벨 도달에 필요한 금화 (최대 100,000) */
export function unitUpgradeGoldCost(targetLevel: number): number {
  return Math.min(100_000, Math.round(200 * Math.pow(targetLevel / 2, 1.59)));
}

/** 유닛 강화 보너스: 레벨당 기초 스탯 +1% (Lv1 = +0%) */
export function unitUpgradeStatBonus(level: number): number {
  return (level - 1) * 0.01;
}

/** 구간 테이블 선형 보간 */
function lerpTable(table: [number, number][], stage: number): number {
  const first = table[0];
  const last = table[table.length - 1];
  if (stage <= first[0]) return first[1];
  if (stage >= last[0]) return last[1];
  for (let i = 0; i < table.length - 1; i++) {
    const [s0, v0] = table[i];
    const [s1, v1] = table[i + 1];
    if (stage >= s0 && stage <= s1) {
      return v0 + ((v1 - v0) * (stage - s0)) / (s1 - s0);
    }
  }
  return last[1];
}

/** 적 유닛 스탯 배수 (설계 10): 1→×1.0 ... 30→×2.3 */
export function enemyStatMultiplier(stage: number): number {
  return lerpTable(
    [
      [1, 1.0],
      [5, 1.2],
      [10, 1.4],
      [15, 1.6],
      [20, 1.8],
      [25, 2.0],
      [30, 2.3],
    ],
    stage,
  );
}

/** 초당 총 스폰율 (설계 10): 1→0.5 ... 30→5.0 */
export function spawnRateForStage(stage: number): number {
  return lerpTable(
    [
      [1, 0.5],
      [5, 1.0],
      [10, 1.8],
      [15, 2.5],
      [20, 3.2],
      [25, 4.0],
      [30, 5.0],
    ],
    stage,
  );
}

/** 처치 EXP 배수: 스테이지 1 = ×1.0 → 30 = ×1.5 선형 */
export function expMultiplierForStage(stage: number): number {
  return 1 + ((Math.min(30, Math.max(1, stage)) - 1) * 0.5) / 29;
}

/** 하드 모드 보정 */
export const HARD_MODE = {
  towerHpMultiplier: 2,
  enemyStatBonus: 0.2,
  rewardMultiplier: 2,
  extraCardChoice: 1,
} as const;

/** 스테이지 제한 시간 (초) — 10분 확정 */
export const STAGE_TIME_LIMIT = 600;

/** 영웅 부활 시간 (초) */
export const HERO_REVIVE_SECONDS = 90;

/** 카드 선택 제한 시간 (초) */
export const CARD_PICK_SECONDS = 30;

/** 카드 등급 등장 확률 */
export const CARD_RARITY_WEIGHT = {
  normal: { common: 0.75, rare: 0.25 },
  hard: { common: 0.7, rare: 0.3 },
} as const;

/** 배속 옵션: x1/x2 무료, x4 유료 또는 광고 */
export const SPEED_OPTIONS = [1, 2, 4] as const;
export type GameSpeed = (typeof SPEED_OPTIONS)[number];
