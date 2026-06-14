import type { CardDef } from '@/game/types';

/**
 * 인게임 카드 풀 (설계 04, 05, 07 + 카드 개편).
 * - 슬롯 8개 (유닛 Lv트랙 + 글로벌 통합)
 * - 유닛 카드 = Lv1→Lv5 업그레이드 트랙 (특성 흡수):
 *   Lv1 생성 / Lv2·Lv4 스탯업 / Lv3·Lv5 특수기술 (Lv5 = MAX, 추가 선택권 1회)
 * - 각 레벨 효과 = 그 레벨에서 활성화되는 누적 보정치 전체 (현재 레벨 1개만 적용)
 * - 글로벌 카드 = Lv1~Lv5 누적 강화
 * - 중첩: 유닛 트랙 + 글로벌 = 단순 합산 (additive)
 * - 출혈/화염 등 % 피해형은 타워/구조물 미적용
 */

/**
 * 유닛 카드 5종 — Lv1 뽑으면 생성 시작, 같은 카드 반복 시 Lv5까지 강화.
 * 특수기술 매핑: 방패 도발/수호오라 · 활 불화살/멀티샷 · 창 돌진/출혈 · 투석 화염/기절 · 검 흡혈/버서커
 */
export const UNIT_CARDS: CardDef[] = [
  {
    id: 'unit_shield', kind: 'unit', rarity: 'common', name: '방패병', unitId: 'shield',
    description: '근접 탱커 — 받쳐주는 전선 유지',
    levelNames: ['생성', '체·방 강화', '도발', '체·방 강화 II', '수호 오라'],
    levels: [
      {},
      { hpPct: 16, defPct: 16 },
      { hpPct: 16, defPct: 16, tauntChance: 30 },
      { hpPct: 32, defPct: 32, tauntChance: 30 },
      { hpPct: 32, defPct: 32, tauntChance: 30, auraDmgReductionPct: 15 },
    ],
  },
  {
    id: 'unit_archer', kind: 'unit', rarity: 'common', name: '활병', unitId: 'archer',
    description: '원거리 딜러 — 후방 화력',
    levelNames: ['생성', '공·공속 강화', '불화살', '공·공속 강화 II', '멀티샷'],
    excludesTower: true,
    levels: [
      {},
      { atkPct: 16, atkSpeedPct: 12 },
      { atkPct: 16, atkSpeedPct: 12, chance: 50, bonusDmgPct: 130 },
      { atkPct: 32, atkSpeedPct: 24, chance: 50, bonusDmgPct: 130 },
      { atkPct: 32, atkSpeedPct: 24, chance: 50, bonusDmgPct: 130, multishot: 1 },
    ],
  },
  {
    id: 'unit_spear', kind: 'unit', rarity: 'common', name: '창병', unitId: 'spear',
    description: '중근거리 — 돌진/출혈 압박',
    levelNames: ['생성', '공·체 강화', '돌진', '공·체 강화 II', '출혈'],
    excludesTower: true,
    levels: [
      {},
      { atkPct: 16, hpPct: 12 },
      { atkPct: 16, hpPct: 12, chargeDmgPct: 15 },
      { atkPct: 32, hpPct: 24, chargeDmgPct: 15 },
      { atkPct: 32, hpPct: 24, chargeDmgPct: 15, chance: 30, dotPct: 5 },
    ],
  },
  {
    id: 'unit_catapult', kind: 'unit', rarity: 'common', name: '투석기', unitId: 'catapult',
    description: '광역 공성 — 구조물/밀집 강함',
    levelNames: ['생성', '공·범위 강화', '화염 공격', '공·범위 강화 II', '기절'],
    excludesTower: true,
    levels: [
      {},
      { atkPct: 16, aoePct: 14 },
      { atkPct: 16, aoePct: 14, chance: 35, burnPct: 2 },
      { atkPct: 32, aoePct: 26, chance: 35, burnPct: 2 },
      { atkPct: 32, aoePct: 26, chance: 35, burnPct: 2, stunSec: 0.8 },
    ],
  },
  {
    id: 'unit_swordsman', kind: 'unit', rarity: 'common', name: '검사', unitId: 'swordsman',
    description: '근거리 딜러 — 흡혈/버서커 폭딜',
    levelNames: ['생성', '공·체 강화', '흡혈', '공·체 강화 II', '버서커'],
    levels: [
      {},
      { atkPct: 16, hpPct: 12 },
      { atkPct: 16, hpPct: 12, lifestealPct: 10 },
      { atkPct: 32, hpPct: 24, lifestealPct: 10 },
      { atkPct: 80, hpPct: 24, lifestealPct: 10, defPct: -60, atkSpeedPct: 40, moveSpeedPct: 30 },
    ],
  },
];

/**
 * 해금형 유닛 카드 7종 (신규 적 유닛 = 가챠/스테이지로 해금 시 전투 카드 풀 등장).
 * 기본 5종처럼 Lv1 생성 / Lv2·4 스탯업 / Lv3·5 특수기술 트랙.
 */
export const EXTRA_UNIT_CARDS: CardDef[] = [
  {
    // 마법사 = 진화형 단일 카드: Lv1 하급 → Lv3 중급 → Lv5 상급 (생성 유닛 자체가 진화)
    id: 'unit_mage', kind: 'unit', rarity: 'rare', name: '마법사', unitId: 'mageLow',
    description: '레벨업으로 진화 — 하급→중급→상급', excludesTower: true,
    evolve: [
      { atLevel: 1, unitId: 'mageLow' },
      { atLevel: 3, unitId: 'mageMid' },
      { atLevel: 5, unitId: 'mageHigh' },
    ],
    levelNames: ['하급 마법사', '마력 강화', '중급 마법사 (진화)', '마력 강화 II', '상급 마법사 (진화)'],
    levels: [
      {},
      { atkPct: 14, atkSpeedPct: 8 },
      { atkPct: 14, atkSpeedPct: 8, chance: 35, burnPct: 2 },
      { atkPct: 26, atkSpeedPct: 16, chance: 35, burnPct: 2 },
      { atkPct: 26, atkSpeedPct: 16, chance: 35, burnPct: 2, multishot: 1, critChance: 20 },
    ],
  },
  {
    id: 'unit_assassin', kind: 'unit', rarity: 'rare', name: '암살자', unitId: 'assassin',
    description: '원거리 사냥꾼 — 회피/기동',
    levelNames: ['생성', '예기 강화', '치명타', '예기 강화 II', '흡혈'],
    levels: [
      {},
      { atkPct: 14, evadePct: 8 },
      { atkPct: 14, evadePct: 8, critChance: 25 },
      { atkPct: 28, evadePct: 14, moveSpeedPct: 12, critChance: 25 },
      { atkPct: 28, evadePct: 14, moveSpeedPct: 12, critChance: 35, lifestealPct: 12 },
    ],
  },
  {
    id: 'unit_bomber', kind: 'unit', rarity: 'rare', name: '폭탄병', unitId: 'bomber',
    description: '자폭 광역 — 밀집 처리', excludesTower: true,
    levelNames: ['생성', '폭약 강화', '소이탄', '폭약 강화 II', '충격파'],
    levels: [
      {},
      { atkPct: 14, aoePct: 10 },
      { atkPct: 14, aoePct: 10, chance: 40, burnPct: 2 },
      { atkPct: 28, aoePct: 18, chance: 40, burnPct: 2 },
      { atkPct: 28, aoePct: 18, chance: 40, burnPct: 2, stunSec: 0.8 },
    ],
  },
  {
    id: 'unit_healer', kind: 'unit', rarity: 'rare', name: '치유사', unitId: 'healer',
    description: '아군 회복 지원 — 유지력',
    levelNames: ['생성', '치유 강화', '집중 치유', '치유 강화 II', '수호 오라'],
    levels: [
      {},
      { hpPct: 14, defPct: 10 },
      { hpPct: 14, defPct: 10, healBonusPct: 50 },
      { hpPct: 26, defPct: 18, healBonusPct: 50 },
      { hpPct: 26, defPct: 18, healBonusPct: 120, auraDmgReductionPct: 12 },
    ],
  },
  {
    id: 'unit_cavalry', kind: 'unit', rarity: 'rare', name: '기마병', unitId: 'cavalry',
    description: '고속 기동 — 원거리 위협', excludesTower: true,
    levelNames: ['생성', '기동 강화', '돌격', '기동 강화 II', '창상'],
    levels: [
      {},
      { atkPct: 12, hpPct: 10 },
      { atkPct: 12, hpPct: 10, chargeDmgPct: 18 },
      { atkPct: 24, hpPct: 18, moveSpeedPct: 12, chargeDmgPct: 18 },
      { atkPct: 24, hpPct: 18, moveSpeedPct: 14, chargeDmgPct: 18, chance: 30, dotPct: 5 },
    ],
  },
];

/** 전투 카드 풀 등장에 해금이 필요한 유닛 (신규 7종) */
export const REQUIRES_UNLOCK = new Set<string>(EXTRA_UNIT_CARDS.map((c) => c.unitId!));

const pct = (key: string, values: number[]) => values.map((v) => ({ [key]: v }));

/** 글로벌 버프 카드 17장 (일반 10 + 고급 7) — 설계 05 */
export const GLOBAL_CARDS: CardDef[] = [
  { id: 'g_atk', kind: 'global', rarity: 'common', name: '공격력 증가', description: '전체 아군 공격력 증가', levels: pct('atkPct', [6, 12, 18, 24, 30]) },
  { id: 'g_def', kind: 'global', rarity: 'common', name: '방어력 증가', description: '전체 아군 방어력 증가', levels: pct('defPct', [6, 12, 18, 24, 30]) },
  { id: 'g_hp', kind: 'global', rarity: 'common', name: '체력 증가', description: '전체 아군 체력 증가', levels: pct('hpPct', [6, 12, 18, 24, 30]) },
  { id: 'g_movespeed', kind: 'global', rarity: 'common', name: '이동속도 증가', description: '전체 아군 이동속도 증가', levels: pct('moveSpeedPct', [4, 8, 12, 16, 20]) },
  { id: 'g_range', kind: 'global', rarity: 'common', name: '사거리 증가', description: '전체 아군 사거리 증가', levels: pct('rangePct', [4, 8, 12, 16, 20]) },
  { id: 'g_atkspeed', kind: 'global', rarity: 'common', name: '공격속도 증가', description: '전체 아군 공격속도 증가', levels: pct('atkSpeedPct', [5, 10, 15, 20, 25]) },
  { id: 'g_exp', kind: 'global', rarity: 'common', name: '경험치 획득 증가', description: '경험치 획득량 증가', levels: pct('expPct', [8, 16, 24, 32, 40]) },
  { id: 'g_spawnspeed', kind: 'global', rarity: 'common', name: '유닛 생성속도 증가', description: '아군 유닛 생성속도 증가', levels: pct('spawnSpeedPct', [5, 10, 15, 20, 25]) },
  { id: 'g_cdr', kind: 'global', rarity: 'common', name: '스킬 쿨타임 감소', description: '영웅 스킬 쿨타임 감소', levels: pct('cdrPct', [5, 10, 15, 20, 25]) },
  { id: 'g_gold', kind: 'global', rarity: 'common', name: '골드 획득 증가', description: '골드 획득량 증가', levels: pct('goldPct', [10, 18, 26, 34, 42]) },
  // 고급 7장
  { id: 'g_crit', kind: 'global', rarity: 'rare', name: '치명타 확률', description: '전체 아군 치명타 확률 (배수 1.5배)', levels: pct('critChance', [5, 10, 15, 20, 25]) },
  { id: 'g_lifesteal', kind: 'global', rarity: 'rare', name: '흡혈', description: '전체 아군, 가한 데미지의 % 회복', levels: pct('lifestealPct', [2, 4, 6, 8, 10]) },
  { id: 'g_evade', kind: 'global', rarity: 'rare', name: '회피율', description: '전체 아군 회피율 증가', levels: pct('evadePct', [5, 9, 13, 17, 21]) },
  { id: 'g_hero', kind: 'global', rarity: 'rare', name: '영웅 강화', description: '영웅 스탯 전반 증가 (영웅 전용)', levels: pct('heroStatPct', [10, 18, 26, 34, 42]) },
  { id: 'g_frenzy', kind: 'global', rarity: 'rare', name: '광폭화', description: 'HP 50% 이하 시 공격력 증가', levels: pct('frenzyAtkPct', [15, 25, 35, 45, 55]) },
  { id: 'g_undying', kind: 'global', rarity: 'rare', name: '불굴', description: '치명적 피해 시 HP 1로 생존 (쿨타임 초)', levels: [{ cooldownSec: 30 }, { cooldownSec: 25 }, { cooldownSec: 20 }, { cooldownSec: 15 }, { cooldownSec: 10 }] },
  { id: 'g_revive', kind: 'global', rarity: 'rare', name: '영웅 부활 시간 감소', description: '영웅 부활 대기 시간 감소', levels: pct('reviveCdrPct', [10, 18, 26, 34, 42]) },
];

export const ALL_CARDS: CardDef[] = [...UNIT_CARDS, ...EXTRA_UNIT_CARDS, ...GLOBAL_CARDS];

export const CARD_MAX_LEVEL = 5;

/**
 * 유닛 ID → 유닛 카드 (Lv트랙 mods 조회용) — 기본 5종 + 해금 카드.
 * 진화 유닛(마법사)은 진화 대상(중급/상급)도 같은 카드로 매핑 → 진화 후에도 mods가 카드에서 조회됨.
 */
const UNIT_CARD_BY_UNIT = new Map<string, CardDef>();
for (const c of [...UNIT_CARDS, ...EXTRA_UNIT_CARDS]) {
  if (c.unitId) UNIT_CARD_BY_UNIT.set(c.unitId, c);
  if (c.evolve) for (const e of c.evolve) UNIT_CARD_BY_UNIT.set(e.unitId, c);
}

export function unitCardByUnit(unitId: string): CardDef | undefined {
  return UNIT_CARD_BY_UNIT.get(unitId);
}

/** 카드의 현재 레벨 기준 생성 유닛 ID (진화 반영 — 마법사 하급/중급/상급) */
export function evolvedUnitId(card: CardDef, level: number): string {
  let result = card.unitId!;
  if (card.evolve) {
    for (const e of card.evolve) if (level >= e.atLevel) result = e.unitId;
  }
  return result;
}

/** 카드 풀 고갈 시 등장하는 재화 카드 */
export const RESOURCE_CARDS = [
  { id: 'res_gold', name: '골드 카드', description: '즉시 골드 획득' },
  { id: 'res_diamond', name: '다이아 카드', description: '낮은 확률 등장, 즉시 다이아 획득' },
] as const;

/** MAX 도달 시 추가 카드 선택권 1회, 매 선택 5% 확률 보너스 뽑기 */
export const CARD_BONUS = { maxLevelExtraPick: 1, bonusPickChance: 0.05 } as const;

export function cardById(id: string): CardDef | undefined {
  return ALL_CARDS.find((c) => c.id === id);
}
