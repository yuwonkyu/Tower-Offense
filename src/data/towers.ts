/**
 * 스테이지별 적 타워 스펙 (설계 08 — 일반 모드).
 * 타워는 공격하지 않음 (HP/방어력만 보유). 하드 모드 = HP × 2, 방어력 동일.
 * 인덱스 = 스테이지 - 1.
 */
export const TOWER_TABLE: { hp: number; def: number }[] = [
  { hp: 1_000, def: 0 }, // 1
  { hp: 1_500, def: 1 },
  { hp: 2_000, def: 2 },
  { hp: 3_000, def: 3 },
  { hp: 4_000, def: 5 }, // 5
  { hp: 5_500, def: 7 },
  { hp: 7_000, def: 9 },
  { hp: 8_500, def: 11 },
  { hp: 10_000, def: 13 },
  { hp: 12_000, def: 15 }, // 10
  { hp: 15_000, def: 17 },
  { hp: 17_500, def: 19 },
  { hp: 19_000, def: 21 },
  { hp: 21_000, def: 23 },
  { hp: 25_000, def: 25 }, // 15
  { hp: 28_000, def: 27 },
  { hp: 31_000, def: 30 },
  { hp: 35_000, def: 33 },
  { hp: 40_000, def: 37 },
  { hp: 45_000, def: 40 }, // 20
  { hp: 50_000, def: 43 },
  { hp: 55_000, def: 46 },
  { hp: 60_000, def: 49 },
  { hp: 65_000, def: 52 },
  { hp: 70_000, def: 55 }, // 25
  { hp: 76_000, def: 58 },
  { hp: 82_000, def: 61 },
  { hp: 88_000, def: 64 },
  { hp: 94_000, def: 67 },
  { hp: 100_000, def: 70 }, // 30
];

/** 타워 외관 단계 (설계 01): HP % 기준. 프로토타입은 색상만 변화 */
export const TOWER_VISUAL_STAGES = [
  { minHpPct: 0.6, label: '정상' },
  { minHpPct: 0.3, label: '일부 균열' },
  { minHpPct: 0.001, label: '심한 손상' },
  { minHpPct: 0, label: '파괴' },
] as const;
