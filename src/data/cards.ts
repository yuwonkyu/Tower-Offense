import type { CardDef } from '@/game/types';

/**
 * 인게임 카드 풀 (설계 04, 05, 07).
 * - 슬롯 8개 (유닛 + 특성 + 글로벌 통합)
 * - 같은 카드 5회 = Lv5 MAX (골드 프레임 + 추가 선택권 1회)
 * - 미보유 유닛의 특성 카드는 풀에서 자동 제외
 * - 중첩: 유닛 특성 + 글로벌 = 단순 합산 (additive)
 * - 출혈/화염 등 % 피해형은 타워/구조물 미적용
 */

/** 유닛 카드 5장 — 뽑으면 해당 유닛이 영웅 주변 360° 랜덤 생성 시작 */
export const UNIT_CARDS: CardDef[] = [
  { id: 'unit_shield', kind: 'unit', rarity: 'common', name: '방패병', description: '방패병 생성 시작', unitId: 'shield', levels: [] },
  { id: 'unit_archer', kind: 'unit', rarity: 'common', name: '활병', description: '활병 생성 시작', unitId: 'archer', levels: [] },
  { id: 'unit_spear', kind: 'unit', rarity: 'common', name: '창병', description: '창병 생성 시작', unitId: 'spear', levels: [] },
  { id: 'unit_catapult', kind: 'unit', rarity: 'common', name: '투석기', description: '투석기 생성 시작', unitId: 'catapult', levels: [] },
  { id: 'unit_swordsman', kind: 'unit', rarity: 'common', name: '검사', description: '검사 생성 시작', unitId: 'swordsman', levels: [] },
];

const pct = (key: string, values: number[]) => values.map((v) => ({ [key]: v }));

/** 유닛 특성 카드 25장 (5유닛 × 5) — 설계 04 */
export const TRAIT_CARDS: CardDef[] = [
  // 방패병 (탱커)
  { id: 'shield_hp', kind: 'trait', rarity: 'common', unitId: 'shield', name: '체력 증가', description: '방패병 체력 증가', levels: pct('hpPct', [8, 16, 24, 32, 40]) },
  { id: 'shield_regen', kind: 'trait', rarity: 'common', unitId: 'shield', name: '체력 회복', description: '초당 최대 체력 % 회복', levels: pct('regenPctPerSec', [0.5, 1, 1.5, 2, 2.5]) },
  { id: 'shield_def', kind: 'trait', rarity: 'common', unitId: 'shield', name: '방어 강화', description: '방패병 방어력 증가', levels: pct('defPct', [8, 16, 24, 32, 40]) },
  { id: 'shield_speed', kind: 'trait', rarity: 'common', unitId: 'shield', name: '이동 속도 증가', description: '방패병 이동 속도 증가', levels: pct('moveSpeedPct', [5, 10, 15, 20, 25]) },
  { id: 'shield_taunt', kind: 'trait', rarity: 'rare', unitId: 'shield', name: '도발', description: '주변 적 도발 확률', levels: pct('tauntChance', [15, 22, 30, 38, 45]) },
  // 활병 (원거리)
  { id: 'archer_pierce', kind: 'trait', rarity: 'common', unitId: 'archer', name: '관통', description: '1마리 관통 확률', levels: pct('pierceChance', [25, 35, 45, 55, 65]) },
  { id: 'archer_atkspeed', kind: 'trait', rarity: 'common', unitId: 'archer', name: '공격속도 증가', description: '활병 공격속도 증가', levels: pct('atkSpeedPct', [8, 16, 24, 32, 40]) },
  { id: 'archer_range', kind: 'trait', rarity: 'common', unitId: 'archer', name: '사거리 증가', description: '활병 사거리 증가', levels: pct('rangePct', [5, 10, 15, 20, 25]) },
  { id: 'archer_crit', kind: 'trait', rarity: 'common', unitId: 'archer', name: '치명타 확률', description: '치명타 확률 증가 (배수 1.5배)', levels: pct('critChance', [6, 12, 18, 24, 30]) },
  { id: 'archer_firearrow', kind: 'trait', rarity: 'rare', unitId: 'archer', name: '불화살', description: '발동 시 추가피해 130% 고정', excludesTower: true, levels: [{ chance: 30, bonusDmgPct: 130 }, { chance: 45, bonusDmgPct: 130 }, { chance: 60, bonusDmgPct: 130 }, { chance: 75, bonusDmgPct: 130 }, { chance: 90, bonusDmgPct: 130 }] },
  // 창병 (중근거리)
  { id: 'spear_extra', kind: 'trait', rarity: 'common', unitId: 'spear', name: '추가타', description: '확률로 추가피해 50% 고정', levels: [{ chance: 15, bonusDmgPct: 50 }, { chance: 25, bonusDmgPct: 50 }, { chance: 35, bonusDmgPct: 50 }, { chance: 45, bonusDmgPct: 50 }, { chance: 55, bonusDmgPct: 50 }] },
  { id: 'spear_atk', kind: 'trait', rarity: 'common', unitId: 'spear', name: '공격력 증가', description: '창병 공격력 증가', levels: pct('atkPct', [8, 16, 24, 32, 40]) },
  { id: 'spear_bleed', kind: 'trait', rarity: 'common', unitId: 'spear', name: '출혈', description: '확률로 출혈 피해 (타워 제외)', excludesTower: true, levels: [{ chance: 12, dotPct: 2 }, { chance: 18, dotPct: 3 }, { chance: 24, dotPct: 4 }, { chance: 30, dotPct: 5 }, { chance: 36, dotPct: 6 }] },
  { id: 'spear_reduce', kind: 'trait', rarity: 'common', unitId: 'spear', name: '피해량 감소', description: '받는 피해 감소', levels: pct('dmgReductionPct', [4, 8, 12, 16, 20]) },
  { id: 'spear_charge', kind: 'trait', rarity: 'rare', unitId: 'spear', name: '돌진', description: '사거리 내 빠른 접근 + 추가피해', levels: pct('chargeDmgPct', [5, 9, 13, 17, 22]) },
  // 투석기 (광역) — 고급 2장
  { id: 'catapult_range', kind: 'trait', rarity: 'common', unitId: 'catapult', name: '사거리 증가', description: '투석기 사거리 증가', levels: pct('rangePct', [5, 10, 15, 20, 25]) },
  { id: 'catapult_atk', kind: 'trait', rarity: 'common', unitId: 'catapult', name: '공격력 증가', description: '투석기 공격력 증가', levels: pct('atkPct', [8, 16, 24, 32, 40]) },
  { id: 'catapult_aoe', kind: 'trait', rarity: 'common', unitId: 'catapult', name: '타격범위 증가', description: '광역 타격 범위 증가', levels: pct('aoePct', [8, 14, 20, 26, 32]) },
  { id: 'catapult_fire', kind: 'trait', rarity: 'rare', unitId: 'catapult', name: '화염공격', description: '추가공격 + 3초 화상 (타워 제외)', excludesTower: true, levels: [{ chance: 15, burnPct: 1 }, { chance: 25, burnPct: 1.5 }, { chance: 35, burnPct: 2 }, { chance: 45, burnPct: 2.5 }, { chance: 55, burnPct: 3 }] },
  { id: 'catapult_stun', kind: 'trait', rarity: 'rare', unitId: 'catapult', name: '기절', description: '타격 시 기절 (최대 1.2초)', levels: [{ stunSec: 0.4 }, { stunSec: 0.6 }, { stunSec: 0.8 }, { stunSec: 1.0 }, { stunSec: 1.2 }] },
  // 검사 (근거리 딜러) — 고급 2장
  { id: 'sword_atk', kind: 'trait', rarity: 'common', unitId: 'swordsman', name: '공격력 증가', description: '검사 공격력 증가', levels: pct('atkPct', [8, 16, 24, 32, 40]) },
  { id: 'sword_hp', kind: 'trait', rarity: 'common', unitId: 'swordsman', name: '체력 증가', description: '검사 체력 증가', levels: pct('hpPct', [8, 16, 24, 32, 40]) },
  { id: 'sword_evade', kind: 'trait', rarity: 'common', unitId: 'swordsman', name: '회피력 증가', description: '검사 회피율 증가', levels: pct('evadePct', [8, 14, 20, 26, 32]) },
  { id: 'sword_lifesteal', kind: 'trait', rarity: 'rare', unitId: 'swordsman', name: '흡혈', description: '가한 데미지의 % 회복', levels: pct('lifestealPct', [4, 7, 10, 13, 16]) },
  { id: 'sword_berserker', kind: 'trait', rarity: 'rare', unitId: 'swordsman', name: '버서커', description: '공/공속/이속 대폭 증가, 방어 감소 (최대 -95%)', levels: [{ atkPct: 25, defPct: -40, atkSpeedPct: 10, moveSpeedPct: 10 }, { atkPct: 50, defPct: -55, atkSpeedPct: 20, moveSpeedPct: 20 }, { atkPct: 75, defPct: -70, atkSpeedPct: 30, moveSpeedPct: 30 }, { atkPct: 100, defPct: -85, atkSpeedPct: 40, moveSpeedPct: 40 }, { atkPct: 130, defPct: -95, atkSpeedPct: 50, moveSpeedPct: 50 }] },
];

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

export const ALL_CARDS: CardDef[] = [...UNIT_CARDS, ...TRAIT_CARDS, ...GLOBAL_CARDS];

export const CARD_MAX_LEVEL = 5;

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
