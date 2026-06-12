import type { HeroDef, StageConfig, TargetPriority, UnitDef, UnitId } from '@/game/types';
import { BASE_UNITS } from '@/data/units';
import { CARD_BONUS } from '@/data/cards';
import { BOMBER_EXPLODED_EXP, NEW_ENEMY_UNITS } from '@/data/enemyUnits';
import { HEROES } from '@/data/heroes';
import { damage, expTotalForLevel, expToNextLevel } from '@/game/formulas';
import { spawnWeightsForStage, type SpawnWeight } from '@/data/spawnWeights';
import { CardSystem, type UnitMods } from './cards';

/** 전체 유닛 정의 룩업 */
const UNIT_DEFS = new Map<UnitId, UnitDef>(
  [...BASE_UNITS, ...NEW_ENEMY_UNITS].map((u) => [u.id, u]),
);

export function unitDef(id: UnitId): UnitDef {
  return UNIT_DEFS.get(id)!;
}

/**
 * 논리 좌표계: 가로 160 고정, 세로 = 160 × (화면 비율).
 * 유닛 사거리/이속(설계 02, 12)을 그대로 논리 단위로 사용.
 * 가로 160 = 화면 약 40% 축소 부감 시점 (먼 거리에서 내려다보는 전장).
 */
export interface FieldLayout {
  width: number;
  height: number;
  towerX: number;
  towerY: number;
  towerRadius: number;
  heroX: number;
  heroY: number;
  heroRadius: number;
}

export function makeFieldLayout(aspectRatio: number): FieldLayout {
  const width = 160;
  const height = width * aspectRatio;
  return {
    width,
    height,
    towerX: width / 2,
    towerY: height * 0.34,
    towerRadius: 11,
    heroX: width / 2,
    heroY: height * 0.74,
    heroRadius: 3,
  };
}

export type Side = 'ally' | 'enemy';
export type EntityState = 'moving' | 'attacking' | 'dead';

/** 타깃 식별: 양수 = 엔티티 id */
const NO_TARGET = -1;
const TOWER_TARGET = -2;

export interface CombatEntity {
  id: number;
  side: Side;
  kind: UnitId | 'hero';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  range: number;
  atkSpeed: number;
  moveSpeed: number;
  aoe: number;
  priority: TargetPriority;
  /** 회피율 0~1 (암살자 기본 0.3) */
  evade: number;
  /** 처치 시 경험치 (적측만 의미, 배수 적용 전) */
  killExp: number;
  /** 치명타 확률 0~1 (배수 1.5배) */
  critChance: number;
  /** 가한 피해 % 회복 0~1 */
  lifestealPct: number;
  /** 초당 최대 체력 % 재생 */
  regenPctPerSec: number;
  /** HP 50% 이하 시 공격력 증가 % */
  frenzyAtkPct: number;
  attackCd: number;
  retargetCd: number;
  targetId: number;
  state: EntityState;
}

const ENEMY_MAX_ALIVE = 350;
const ALLY_MAX_ALIVE = 80;
/** 유닛 카드 보유 시 기본 초당 생성률 — 카드가 점진 획득되는 초반 열세 보정 */
const ALLY_SPAWN_BASE = 1.0;
/** 유닛 카드 1장당 추가 생성률 (설계 07: 카드마다 독립 생성) */
const ALLY_SPAWN_RATE_PER_CARD = 0.5;
/** 사거리 + α 안의 적을 탐지 (밖이면 아군은 타워로 진군) */
const AGGRO_BONUS = 14;
/** 영웅 탐지 범위 — 근접 영웅도 원거리 포격에 대응하도록 넓게 */
const HERO_AGGRO = 35;
/** 원거리 판정 기준 사거리 (암살자/기마병 우선타깃용) */
const RANGED_THRESHOLD = 10;
/** 치유사 초당 회복 — 설계상 공격력×0.5인데 기본 공격력 0이라 임시 보정값 사용 */
const HEALER_HEAL_PER_SEC = 10;
/** 엔티티 몸체 반경 (충돌 판정용) */
const BODY_RADIUS = 2;
/** 적 스폰 워밍업: 시작 40% → 90초에 100% (카드가 점진 획득되는 초반 진형 구축 시간 확보) */
const ENEMY_SPAWN_WARMUP_SECONDS = 90;
const ENEMY_SPAWN_WARMUP_START = 0.4;

export type EngineResult = 'ongoing' | 'victory';

export class BattleEngine {
  entities: CombatEntity[] = [];
  hero: CombatEntity;
  towerHp: number;
  kills = 0;
  totalExp = 0;
  level = 1;
  reviveLeft = 0;
  result: EngineResult = 'ongoing';
  /** 경과 게임 시간 (초) */
  time = 0;
  /** 쌓인 카드 선택권 — 전투 시작 시 1회 + 레벨업마다 1회 */
  pendingPicks = 1;
  /** 인게임 카드 보유/풀 (설계 04, 05, 07) */
  readonly cards: CardSystem;

  private spawnAcc = 0;
  private allySpawnAcc = 0;
  private nextId = 1;
  private readonly weights: SpawnWeight[];
  private readonly totalWeight: number;
  private readonly heroDef: HeroDef;
  private readonly byId = new Map<number, CombatEntity>();

  constructor(
    readonly config: StageConfig,
    readonly field: FieldLayout,
    heroDef: HeroDef = HEROES[0],
  ) {
    this.weights = spawnWeightsForStage(config.stage, config.enemyUnits);
    this.totalWeight = this.weights.reduce((sum, w) => sum + w.weight, 0);
    this.heroDef = heroDef;
    this.towerHp = config.tower.hp;
    this.cards = new CardSystem(config.difficulty === 'hard');
    this.hero = this.makeHero();
    this.addEntity(this.hero);
  }

  /** 현재 생성 가능한 아군 유닛 (보유 유닛 카드) */
  get activeUnitCards(): UnitId[] {
    return this.cards.ownedUnits;
  }

  /** 카드 선택권 소비. Lv5 MAX 도달 시 추가 선택권 (설계 07) */
  pickCard(cardId: string) {
    if (this.pendingPicks <= 0) return;
    this.pendingPicks--;
    const { maxed } = this.cards.pick(cardId);
    if (maxed) this.pendingPicks += CARD_BONUS.maxLevelExtraPick;
    this.refreshHeroStats();
  }

  /** dt = 게임 시간 기준 경과 초 (배속 적용 후) */
  tick(dt: number) {
    if (this.result !== 'ongoing') return;
    this.time += dt;
    this.spawnEnemies(dt);
    this.spawnAllies(dt);
    this.updateRevive(dt);
    this.act(dt);
    this.removeDead();
  }

  // ── 생성 ──────────────────────────────────────────────

  private makeHero(): CombatEntity {
    const s = this.heroDef.stats;
    return {
      id: this.nextId++,
      side: 'ally',
      kind: 'hero',
      x: this.field.heroX,
      y: this.field.heroY,
      hp: s.hp,
      maxHp: s.hp,
      atk: s.atk,
      def: s.def,
      range: s.range,
      atkSpeed: s.atkSpeed,
      moveSpeed: s.moveSpeed,
      aoe: s.aoe,
      priority: 'nearest',
      evade: 0,
      killExp: 0,
      critChance: 0,
      lifestealPct: 0,
      regenPctPerSec: 0,
      frenzyAtkPct: 0,
      attackCd: 0,
      retargetCd: 0,
      targetId: NO_TARGET,
      state: 'moving',
    };
  }

  private makeUnit(side: Side, unitId: UnitId, x: number, y: number): CombatEntity {
    const def = unitDef(unitId);
    const mult = side === 'enemy' ? this.config.statMultiplier : 1;
    const m = side === 'ally' ? this.cards.unitMods(unitId) : null;
    const f = (pct: number | undefined) => 1 + (pct ?? 0) / 100;
    return {
      id: this.nextId++,
      side,
      kind: unitId,
      x,
      y,
      hp: def.stats.hp * mult * f(m?.hpPct),
      maxHp: def.stats.hp * mult * f(m?.hpPct),
      atk: def.stats.atk * mult * f(m?.atkPct),
      def: def.stats.def * mult * f(m?.defPct),
      range: def.stats.range * f(m?.rangePct),
      atkSpeed: def.stats.atkSpeed * f(m?.atkSpeedPct),
      moveSpeed: def.stats.moveSpeed * f(m?.moveSpeedPct),
      aoe: def.stats.aoe * f(m?.aoePct),
      priority: def.priority,
      evade: (unitId === 'assassin' ? 0.3 : 0) + (m?.evadePct ?? 0) / 100,
      killExp: def.exp,
      critChance: (m?.critChance ?? 0) / 100,
      lifestealPct: (m?.lifestealPct ?? 0) / 100,
      regenPctPerSec: m?.regenPctPerSec ?? 0,
      frenzyAtkPct: m?.frenzyAtkPct ?? 0,
      attackCd: Math.random() * 0.5,
      retargetCd: Math.random() * 0.2,
      targetId: NO_TARGET,
      state: 'moving',
    };
  }

  private addEntity(e: CombatEntity) {
    this.entities.push(e);
    this.byId.set(e.id, e);
  }

  private spawnEnemies(dt: number) {
    const warmup = Math.min(
      1,
      ENEMY_SPAWN_WARMUP_START + (1 - ENEMY_SPAWN_WARMUP_START) * (this.time / ENEMY_SPAWN_WARMUP_SECONDS),
    );
    this.spawnAcc += this.config.spawnRate * warmup * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.countSide('enemy') >= ENEMY_MAX_ALIVE) continue;
      const { towerX, towerY, towerRadius, width } = this.field;
      const angle = Math.random() * Math.PI * 2;
      const r = towerRadius + 2;
      const x = Math.min(width - 3, Math.max(3, towerX + Math.cos(angle) * r));
      const y = towerY + Math.sin(angle) * r;
      this.addEntity(this.makeUnit('enemy', this.pickEnemyUnit(), x, y));
    }
  }

  private spawnAllies(dt: number) {
    const unitCards = this.activeUnitCards;
    if (unitCards.length === 0) return;
    const spawnBoost = 1 + this.cards.spawnSpeedPct / 100;
    const rate = ALLY_SPAWN_BASE + ALLY_SPAWN_RATE_PER_CARD * unitCards.length;
    this.allySpawnAcc += rate * spawnBoost * dt;
    while (this.allySpawnAcc >= 1) {
      this.allySpawnAcc -= 1;
      if (this.countSide('ally') - 1 >= ALLY_MAX_ALIVE) continue;
      const unitId = unitCards[Math.floor(Math.random() * unitCards.length)];
      // 영웅 주변 360° 랜덤 생성 (설계 07)
      const cx = this.hero.state === 'dead' ? this.field.heroX : this.hero.x;
      const cy = this.hero.state === 'dead' ? this.field.heroY : this.hero.y;
      const angle = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 4;
      const x = Math.min(this.field.width - 3, Math.max(3, cx + Math.cos(angle) * r));
      const y = Math.min(this.field.height - 3, Math.max(3, cy + Math.sin(angle) * r));
      this.addEntity(this.makeUnit('ally', unitId, x, y));
    }
  }

  private pickEnemyUnit(): UnitId {
    let roll = Math.random() * this.totalWeight;
    for (const w of this.weights) {
      roll -= w.weight;
      if (roll <= 0) return w.unitId;
    }
    return this.weights[this.weights.length - 1].unitId;
  }

  private countSide(side: Side): number {
    let n = 0;
    for (const e of this.entities) if (e.side === side && e.state !== 'dead') n++;
    return n;
  }

  // ── 영웅 부활 ─────────────────────────────────────────

  private updateRevive(dt: number) {
    if (this.hero.state !== 'dead') return;
    this.reviveLeft = Math.max(0, this.reviveLeft - dt);
    if (this.reviveLeft <= 0) {
      this.hero.hp = this.hero.maxHp;
      this.hero.x = this.field.heroX;
      this.hero.y = this.field.heroY;
      this.hero.state = 'moving';
      this.hero.targetId = NO_TARGET;
    }
  }

  // ── 행동 (타깃 → 이동 → 공격) ─────────────────────────

  private act(dt: number) {
    for (const e of this.entities) {
      if (e.state === 'dead') continue;
      e.attackCd = Math.max(0, e.attackCd - dt);
      e.retargetCd -= dt;
      if (e.regenPctPerSec > 0 && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + (e.maxHp * e.regenPctPerSec * dt) / 100);
      }

      if (e.priority === 'healAlly') {
        this.actHealer(e, dt);
        continue;
      }
      if (e.kind === 'bomber') {
        this.actBomber(e, dt);
        continue;
      }

      if (e.retargetCd <= 0 || !this.isTargetValid(e)) {
        this.acquireTarget(e);
        e.retargetCd = 0.15 + Math.random() * 0.15;
      }

      if (e.targetId === TOWER_TARGET) {
        this.moveAttackTower(e, dt);
      } else if (e.targetId !== NO_TARGET) {
        const target = this.byId.get(e.targetId);
        if (target) this.moveAttackEntity(e, target, dt);
      } else {
        e.state = 'moving';
      }
    }
  }

  private isTargetValid(e: CombatEntity): boolean {
    if (e.targetId === TOWER_TARGET) return true;
    if (e.targetId === NO_TARGET) return false;
    const t = this.byId.get(e.targetId);
    return !!t && t.state !== 'dead';
  }

  /** 우선타깃 시스템 (설계 14) */
  private acquireTarget(e: CombatEntity) {
    const aggro = e.kind === 'hero' ? Math.max(e.range + AGGRO_BONUS, HERO_AGGRO) : e.range + AGGRO_BONUS;
    let best: CombatEntity | null = null;
    let bestScore = Infinity;

    for (const c of this.entities) {
      if (c.side === e.side || c.state === 'dead') continue;
      const dist = Math.hypot(c.x - e.x, c.y - e.y);
      if (dist > aggro) continue;

      let score = dist;
      if (e.priority === 'tank') score -= c.def * 0.5; // 방어력 높은 탱커 우선
      if (e.priority === 'ranged' && c.range >= RANGED_THRESHOLD) score -= 30; // 원거리 우선
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }

    if (best) {
      e.targetId = best.id;
    } else if (e.side === 'ally') {
      // 영웅은 단독 돌진 금지 — 생성 거점을 지키며 아군과 함께 싸움 (시뮬: 초반 폭사 방지)
      e.targetId = e.kind === 'hero' ? NO_TARGET : TOWER_TARGET;
    } else {
      // 적측: 탐지 범위 밖이면 가장 가까운 아군에게 전진
      let nearest: CombatEntity | null = null;
      let nearestDist = Infinity;
      for (const c of this.entities) {
        if (c.side === 'enemy' || c.state === 'dead') continue;
        const dist = Math.hypot(c.x - e.x, c.y - e.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = c;
        }
      }
      e.targetId = nearest ? nearest.id : NO_TARGET;
    }
  }

  private moveToward(e: CombatEntity, tx: number, ty: number, stopDist: number, dt: number) {
    const dx = tx - e.x;
    const dy = ty - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= stopDist) return true;
    const step = Math.min(e.moveSpeed * dt, dist - stopDist);
    e.x += (dx / dist) * step;
    e.y += (dy / dist) * step;
    return false;
  }

  private moveAttackEntity(e: CombatEntity, target: CombatEntity, dt: number) {
    const stopDist = Math.max(e.range, 1) + BODY_RADIUS;
    const inRange = this.moveToward(e, target.x, target.y, stopDist, dt);
    e.state = inRange ? 'attacking' : 'moving';
    if (inRange && e.attackCd <= 0 && e.atkSpeed > 0) {
      e.attackCd = 1 / e.atkSpeed;
      this.performAttack(e, target);
    }
  }

  private moveAttackTower(e: CombatEntity, dt: number) {
    const { towerX, towerY, towerRadius } = this.field;
    const stopDist = towerRadius + Math.max(e.range, 1);
    const inRange = this.moveToward(e, towerX, towerY, stopDist, dt);
    e.state = inRange ? 'attacking' : 'moving';
    if (inRange && e.attackCd <= 0 && e.atkSpeed > 0) {
      e.attackCd = 1 / e.atkSpeed;
      this.damageTower(e.atk);
    }
  }

  private damageTower(atk: number) {
    this.towerHp = Math.max(0, this.towerHp - damage(atk, this.config.tower.def));
    if (this.towerHp <= 0) this.result = 'victory';
  }

  /** 단일/광역 공격 수행. 회피 판정 포함 */
  private performAttack(attacker: CombatEntity, target: CombatEntity) {
    if (attacker.aoe > 1.5) {
      for (const c of this.entities) {
        if (c.side === attacker.side || c.state === 'dead') continue;
        if (Math.hypot(c.x - target.x, c.y - target.y) <= attacker.aoe) {
          this.applyDamage(attacker, c);
        }
      }
    } else {
      this.applyDamage(attacker, target);
    }
  }

  private applyDamage(attacker: CombatEntity, target: CombatEntity) {
    if (target.evade > 0 && Math.random() < target.evade) return;
    let atk = attacker.atk;
    // 광폭화: HP 50% 이하 시 공격력 증가
    if (attacker.frenzyAtkPct > 0 && attacker.hp <= attacker.maxHp * 0.5) {
      atk *= 1 + attacker.frenzyAtkPct / 100;
    }
    let dmg = damage(atk, target.def);
    if (attacker.critChance > 0 && Math.random() < attacker.critChance) dmg *= 1.5;
    target.hp -= dmg;
    if (attacker.lifestealPct > 0 && attacker.state !== 'dead') {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + dmg * attacker.lifestealPct);
    }
    if (target.hp <= 0) this.onDeath(target);
  }

  private onDeath(e: CombatEntity) {
    if (e.state === 'dead') return;
    e.state = 'dead';
    e.hp = 0;
    if (e.side === 'enemy') {
      this.kills++;
      this.gainExp(e.killExp);
    } else if (e.kind === 'hero') {
      // 영웅 부활 시간 감소 카드 적용
      this.reviveLeft = this.heroDef.reviveSeconds * (1 - this.cards.reviveCdrPct / 100);
    }
  }

  private gainExp(baseExp: number) {
    const cardBoost = 1 + this.cards.expPct / 100;
    this.totalExp += Math.round(baseExp * this.config.expMultiplier * cardBoost);
    while (this.totalExp >= expTotalForLevel(this.level + 1)) {
      this.level++;
      this.pendingPicks++;
      this.applyHeroGrowth();
    }
  }

  /** 레벨업: 선형 성장 + HP 25% 회복 (설계 03) */
  private applyHeroGrowth() {
    this.refreshHeroStats();
    const h = this.hero;
    if (h.state !== 'dead') {
      h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.25);
    }
  }

  /** 영웅 스탯 재계산: 기본 + 레벨 성장(설계 03) × 카드 보정(글로벌 + 영웅 강화) */
  private refreshHeroStats() {
    const s = this.heroDef.stats;
    const g = this.heroDef.growth;
    const lv = this.level - 1;
    const m: UnitMods = this.cards.heroMods();
    const f = (pct: number) => 1 + pct / 100;
    const h = this.hero;
    const hpRatio = h.maxHp > 0 ? h.hp / h.maxHp : 1;
    h.atk = (s.atk + g.atk * lv) * f(m.atkPct);
    h.def = (s.def + g.def * lv) * f(m.defPct);
    h.maxHp = (s.hp + g.hp * lv) * f(m.hpPct);
    h.hp = h.maxHp * hpRatio;
    h.atkSpeed = (s.atkSpeed + g.atkSpeed * lv) * f(m.atkSpeedPct);
    h.moveSpeed = s.moveSpeed * f(m.moveSpeedPct);
    h.range = s.range * f(m.rangePct);
    h.evade = m.evadePct / 100;
    h.critChance = m.critChance / 100;
    h.lifestealPct = m.lifestealPct / 100;
    h.regenPctPerSec = m.regenPctPerSec;
    h.frenzyAtkPct = m.frenzyAtkPct;
  }

  // ── 특수 유닛 ─────────────────────────────────────────

  /** 치유사: 공격 X, HP 비율 낮은 아군 회복 (설계 12/14) */
  private actHealer(e: CombatEntity, dt: number) {
    let target: CombatEntity | null = null;
    let lowest = 1;
    for (const c of this.entities) {
      if (c.side !== e.side || c.state === 'dead' || c.id === e.id) continue;
      const ratio = c.hp / c.maxHp;
      if (ratio < lowest && ratio < 0.999) {
        lowest = ratio;
        target = c;
      }
    }
    if (!target) {
      e.state = 'moving';
      return;
    }
    const inRange = this.moveToward(e, target.x, target.y, e.range + BODY_RADIUS, dt);
    e.state = inRange ? 'attacking' : 'moving';
    if (inRange) {
      target.hp = Math.min(target.maxHp, target.hp + HEALER_HEAL_PER_SEC * dt);
    }
  }

  /** 폭탄병: 가장 가까운 상대에게 접근 후 자폭 (자폭 시 EXP 50%) */
  private actBomber(e: CombatEntity, dt: number) {
    let nearest: CombatEntity | null = null;
    let nearestDist = Infinity;
    for (const c of this.entities) {
      if (c.side === e.side || c.state === 'dead') continue;
      const dist = Math.hypot(c.x - e.x, c.y - e.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = c;
      }
    }
    if (!nearest) {
      e.state = 'moving';
      return;
    }
    const reached = this.moveToward(e, nearest.x, nearest.y, e.aoe * 0.5, dt);
    if (!reached) {
      e.state = 'moving';
      return;
    }
    // 자폭: 반경 내 상대 전체 피해
    for (const c of this.entities) {
      if (c.side === e.side || c.state === 'dead') continue;
      if (Math.hypot(c.x - e.x, c.y - e.y) <= e.aoe) {
        this.applyDamage(e, c);
      }
    }
    e.state = 'dead';
    e.hp = 0;
    if (e.side === 'enemy') {
      this.kills++;
      this.gainExp(BOMBER_EXPLODED_EXP);
    }
  }

  // ── 정리 ──────────────────────────────────────────────

  private removeDead() {
    let needsClean = false;
    for (const e of this.entities) {
      if (e.state === 'dead' && e.kind !== 'hero') {
        this.byId.delete(e.id);
        needsClean = true;
      }
    }
    if (needsClean) {
      this.entities = this.entities.filter((e) => e.state !== 'dead' || e.kind === 'hero');
    }
  }

  // ── HUD 조회용 ────────────────────────────────────────

  get expInLevel(): number {
    return this.totalExp - expTotalForLevel(this.level);
  }

  get expToNext(): number {
    return expToNextLevel(this.level);
  }
}
