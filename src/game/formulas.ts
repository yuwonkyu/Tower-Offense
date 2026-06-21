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
  // 승률 ~66%(3판 2승) 목표로 후반 적 스케일 하향 — 비대칭(적 약화)이 전선 돌파에 직접 작용
  return lerpTable(
    [
      [1, 1.0],
      [5, 1.15],
      [10, 1.3],
      [15, 1.4],
      [20, 1.5],
      [25, 1.75],
      [30, 1.95],
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

/** 영웅 부활 시간 (초) — 폰 피드백으로 90→30 단축 */
export const HERO_REVIVE_SECONDS = 30;

/** 영웅 기본 체력 재생 (초당 최대체력 %) — 폰 피드백으로 추가, 카드 회복과 합산 */
export const HERO_BASE_REGEN_PCT = 1;

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

// ── 영웅 메타 레벨 (전투 외 성장) ──────────────────────────────
/** 메타 레벨 L → L+1 필요 EXP = L × 100 */
export function heroMetaExpToNext(level: number): number {
  return level * 100;
}

/** 누적 EXP → { level, expInLevel, expToNext } */
export function heroMetaLevelFromExp(totalExp: number): {
  level: number;
  expInLevel: number;
  expToNext: number;
} {
  let level = 1;
  let remaining = totalExp;
  while (remaining >= heroMetaExpToNext(level)) {
    remaining -= heroMetaExpToNext(level);
    level++;
  }
  return { level, expInLevel: remaining, expToNext: heroMetaExpToNext(level) };
}

/** 스테이지 종료 시 영웅 메타 EXP: 클리어 stage×20, 패배 stage×5 */
export function heroMetaExpForStage(stage: number, victory: boolean): number {
  return victory ? stage * 20 : Math.floor(stage * 5);
}

/** 영웅 스탯 초기화 비용 (다이아) */
export const HERO_RESET_DIAMONDS = 50;

/** 유닛 가챠 1회 비용 (다이아) — 10장 지급 */
export const UNIT_GACHA_COST = 50;
/** 영웅 가챠 1회 비용 (다이아) — 영웅 1회 소환 */
export const HERO_GACHA_COST = 100;
/** 중복 영웅 소환 시 지급 EXP */
export const HERO_DUPE_EXP = 100;
/** 유닛 가챠 1회 지급 카드 수 */
export const UNIT_GACHA_CARDS = 10;

/** 묶음 소환 단위 + 묶음 할인 (설계 06 — x10 -5%, x100 -10%) */
export const GACHA_TIERS = [
  { times: 1, label: 'x1', discountPct: 0 },
  { times: 10, label: 'x10', discountPct: 5 },
  { times: 100, label: 'x100', discountPct: 10 },
] as const;

/** 묶음 소환 총 비용 (다이아) — floor(기본비용 × 횟수 × (1 - 할인)) */
export function bulkGachaCost(baseCost: number, times: number, discountPct: number): number {
  return Math.floor(baseCost * times * (1 - discountPct / 100));
}

/** 골드 상점: 다이아로 골드 구매 (현금 X). 묶음일수록 보너스 골드↑ */
export const GOLD_SHOP_PACKS = [
  { diamonds: 10, gold: 1000, bonusLabel: '' },
  { diamonds: 50, gold: 5500, bonusLabel: '+10%' },
  { diamonds: 100, gold: 12000, bonusLabel: '+20%' },
] as const;

/** 일일 무료 선물 (매일 접속 1회) */
export const DAILY_GIFT = { gold: 500, diamonds: 10 } as const;
