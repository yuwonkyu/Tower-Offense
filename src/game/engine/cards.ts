import { ALL_CARDS, CARD_MAX_LEVEL, cardById, GLOBAL_CARDS, TRAIT_CARDS } from '@/data/cards';
import type { CardDef, UnitId } from '@/game/types';

export const CARD_SLOTS = 8;

/**
 * 인게임 카드 보유/풀 관리 (설계 04, 05, 07).
 * - 등급 확률: 일반 75% / 고급 25% (하드 70/30)
 * - 같은 카드 5회 = Lv5 MAX → 풀에서 제외
 * - 유닛 카드는 1회성 (뽑으면 생성 시작, 스택 없음)
 * - 슬롯 8개 가득 차면 보유 카드 강화만 등장
 * - 미보유 유닛의 특성 카드는 풀에서 제외
 * - 중첩: 유닛 특성 + 글로벌 = 단순 합산 (additive)
 */
export interface UnitMods {
  atkPct: number;
  defPct: number;
  hpPct: number;
  atkSpeedPct: number;
  moveSpeedPct: number;
  rangePct: number;
  aoePct: number;
  critChance: number;
  evadePct: number;
  lifestealPct: number;
  regenPctPerSec: number;
  frenzyAtkPct: number;
  // ── 프록 효과 (설계 04, 05) ──
  /** 도발 확률 % — 공격 시 주변 적 타깃을 자신으로 전환 */
  tauntChance: number;
  /** 관통 확률 % — 1마리 추가 타격 */
  pierceChance: number;
  /** 추가피해 발동 확률 % (추가타/불화살) */
  bonusChance: number;
  /** 추가피해량 — 공격력 대비 % 고정 (방어 미적용) */
  bonusDmgPct: number;
  /** 출혈 발동 확률 % */
  bleedChance: number;
  /** 출혈 초당 피해 — 대상 최대체력 % (3초, 타워/구조물 제외) */
  bleedDotPct: number;
  /** 받는 피해 감소 % */
  dmgReductionPct: number;
  /** 돌진 — 이동 후 첫 타 추가피해 % + 접근 이속 보너스 */
  chargeDmgPct: number;
  /** 화상 발동 확률 % */
  burnChance: number;
  /** 화상 초당 피해 — 대상 최대체력 % (3초, 타워/구조물 제외) */
  burnPct: number;
  /** 타격 시 기절 (초) */
  stunSec: number;
  /** 불굴 — 치명적 피해 시 HP 1 생존 쿨타임 (0 = 미보유) */
  undyingCooldownSec: number;
}

const MOD_KEYS: (keyof UnitMods)[] = [
  'atkPct',
  'defPct',
  'hpPct',
  'atkSpeedPct',
  'moveSpeedPct',
  'rangePct',
  'aoePct',
  'critChance',
  'evadePct',
  'lifestealPct',
  'regenPctPerSec',
  'frenzyAtkPct',
  'tauntChance',
  'pierceChance',
  'dmgReductionPct',
  'chargeDmgPct',
  'stunSec',
];

export function zeroMods(): UnitMods {
  return {
    atkPct: 0,
    defPct: 0,
    hpPct: 0,
    atkSpeedPct: 0,
    moveSpeedPct: 0,
    rangePct: 0,
    aoePct: 0,
    critChance: 0,
    evadePct: 0,
    lifestealPct: 0,
    regenPctPerSec: 0,
    frenzyAtkPct: 0,
    tauntChance: 0,
    pierceChance: 0,
    bonusChance: 0,
    bonusDmgPct: 0,
    bleedChance: 0,
    bleedDotPct: 0,
    dmgReductionPct: 0,
    chargeDmgPct: 0,
    burnChance: 0,
    burnPct: 0,
    stunSec: 0,
    undyingCooldownSec: 0,
  };
}

function addEffects(acc: UnitMods, effect: Record<string, number>) {
  for (const key of MOD_KEYS) {
    if (effect[key] !== undefined) acc[key] += effect[key];
  }
  // chance 페어형 프록: 같이 실린 보조 키로 종류 판별
  if (effect.chance !== undefined) {
    if (effect.bonusDmgPct !== undefined) {
      // 추가타(창병 50%) / 불화살(활병 130%) — 발동 확률 합산, 피해량은 최대값
      acc.bonusChance += effect.chance;
      acc.bonusDmgPct = Math.max(acc.bonusDmgPct, effect.bonusDmgPct);
    }
    if (effect.dotPct !== undefined) {
      acc.bleedChance += effect.chance;
      acc.bleedDotPct += effect.dotPct;
    }
    if (effect.burnPct !== undefined) {
      acc.burnChance += effect.chance;
      acc.burnPct += effect.burnPct;
    }
  }
  // 불굴: 쿨타임은 낮을수록 강함 — 최소값 채택
  if (effect.cooldownSec !== undefined) {
    acc.undyingCooldownSec =
      acc.undyingCooldownSec === 0
        ? effect.cooldownSec
        : Math.min(acc.undyingCooldownSec, effect.cooldownSec);
  }
}

export class CardSystem {
  /** cardId → 보유 레벨 */
  readonly owned = new Map<string, number>();

  constructor(private readonly hard = false) {}

  level(cardId: string): number {
    return this.owned.get(cardId) ?? 0;
  }

  get slotsUsed(): number {
    return this.owned.size;
  }

  get slotsFull(): boolean {
    return this.owned.size >= CARD_SLOTS;
  }

  /** 보유한 유닛 카드의 유닛들 (생성 활성화) */
  get ownedUnits(): UnitId[] {
    const units: UnitId[] = [];
    for (const [id, lv] of this.owned) {
      const card = cardById(id);
      if (card?.kind === 'unit' && card.unitId && lv > 0) units.push(card.unitId);
    }
    return units;
  }

  private maxLevelOf(card: CardDef): number {
    return card.kind === 'unit' ? 1 : CARD_MAX_LEVEL;
  }

  private isPickable(card: CardDef): boolean {
    const lv = this.level(card.id);
    if (lv >= this.maxLevelOf(card)) return false;
    if (this.slotsFull && lv === 0) return false; // 슬롯 풀 → 강화만
    if (card.kind === 'trait' && card.unitId && !this.ownedUnits.includes(card.unitId)) {
      return false; // 미보유 유닛 특성 제외
    }
    return true;
  }

  /** 선택지 생성: 등급 확률 적용, 등급 내 완전 균등, 중복 없음 */
  rollChoices(count = 3): CardDef[] {
    let pool = ALL_CARDS.filter((c) => this.isPickable(c));
    // 보유 유닛 0개 = 아군 생성 불가 → 첫 선택은 유닛 카드 보장
    if (this.ownedUnits.length === 0) {
      const unitsOnly = pool.filter((c) => c.kind === 'unit');
      if (unitsOnly.length > 0) pool = unitsOnly;
    }
    const rareWeight = this.hard ? 0.3 : 0.25;
    const out: CardDef[] = [];
    const used = new Set<string>();

    for (let i = 0; i < count; i++) {
      const commons = pool.filter((c) => c.rarity === 'common' && !used.has(c.id));
      const rares = pool.filter((c) => c.rarity === 'rare' && !used.has(c.id));
      let bucket = Math.random() < rareWeight ? rares : commons;
      if (bucket.length === 0) bucket = bucket === rares ? commons : rares;
      if (bucket.length === 0) break; // 풀 고갈 — TODO: 골드/다이아 재화 카드
      const pick = bucket[Math.floor(Math.random() * bucket.length)];
      out.push(pick);
      used.add(pick.id);
    }
    return out;
  }

  /** 카드 획득/강화. maxed = Lv5 도달 (MAX 보너스 대상 — 유닛 카드 제외) */
  pick(cardId: string): { maxed: boolean } {
    const card = cardById(cardId);
    if (!card) return { maxed: false };
    const lv = Math.min(this.maxLevelOf(card), this.level(cardId) + 1);
    this.owned.set(cardId, lv);
    return { maxed: card.kind !== 'unit' && lv >= CARD_MAX_LEVEL };
  }

  // ── 효과 집계 ─────────────────────────────────────────

  private globalMods(): UnitMods {
    const acc = zeroMods();
    for (const card of GLOBAL_CARDS) {
      const lv = this.level(card.id);
      if (lv > 0) addEffects(acc, card.levels[lv - 1]);
    }
    return acc;
  }

  /** 해당 유닛의 합산 보정치 (유닛 특성 + 글로벌) */
  unitMods(unitId: UnitId): UnitMods {
    const acc = this.globalMods();
    for (const card of TRAIT_CARDS) {
      if (card.unitId !== unitId) continue;
      const lv = this.level(card.id);
      if (lv > 0) addEffects(acc, card.levels[lv - 1]);
    }
    return acc;
  }

  /** 영웅 보정치 (글로벌 + 영웅 강화 카드) */
  heroMods(): UnitMods {
    const acc = this.globalMods();
    const heroPct = this.globalValue('heroStatPct');
    acc.atkPct += heroPct;
    acc.defPct += heroPct;
    acc.hpPct += heroPct;
    acc.atkSpeedPct += heroPct;
    acc.moveSpeedPct += heroPct;
    acc.rangePct += heroPct;
    return acc;
  }

  private globalValue(key: string): number {
    let sum = 0;
    for (const card of GLOBAL_CARDS) {
      const lv = this.level(card.id);
      if (lv > 0 && card.levels[lv - 1][key] !== undefined) sum += card.levels[lv - 1][key];
    }
    return sum;
  }

  get expPct(): number {
    return this.globalValue('expPct');
  }
  get spawnSpeedPct(): number {
    return this.globalValue('spawnSpeedPct');
  }
  get cdrPct(): number {
    return this.globalValue('cdrPct');
  }
  get reviveCdrPct(): number {
    return this.globalValue('reviveCdrPct');
  }
  get goldPct(): number {
    return this.globalValue('goldPct');
  }
}
