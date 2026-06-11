import type { StageConfig, UnitDef, UnitId } from '@/game/types';
import { BASE_UNITS } from '@/data/units';
import { NEW_ENEMY_UNITS } from '@/data/enemyUnits';
import { spawnWeightsForStage, type SpawnWeight } from '@/data/spawnWeights';

/** 전체 유닛 정의 룩업 */
const UNIT_DEFS = new Map<UnitId, UnitDef>(
  [...BASE_UNITS, ...NEW_ENEMY_UNITS].map((u) => [u.id, u]),
);

export function unitDef(id: UnitId): UnitDef {
  return UNIT_DEFS.get(id)!;
}

/**
 * 논리 좌표계: 가로 100 고정, 세로 = 100 × (화면 비율).
 * 유닛 사거리/이속(설계 02, 12)을 그대로 논리 단위로 사용.
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
  const width = 100;
  const height = width * aspectRatio;
  return {
    width,
    height,
    towerX: 50,
    towerY: height * 0.34,
    towerRadius: 11,
    heroX: 50,
    heroY: height * 0.74,
    heroRadius: 3,
  };
}

export type EnemyState = 'moving' | 'attacking';

export interface EnemyEntity {
  id: number;
  unitId: UnitId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  moveSpeed: number;
  range: number;
  state: EnemyState;
}

/** 전투(사망) 미구현 단계의 임시 동시 생존 상한 */
const MAX_ALIVE = 350;

export class BattleEngine {
  enemies: EnemyEntity[] = [];

  private spawnAcc = 0;
  private nextId = 1;
  private readonly weights: SpawnWeight[];
  private readonly totalWeight: number;

  constructor(
    readonly config: StageConfig,
    readonly field: FieldLayout,
  ) {
    this.weights = spawnWeightsForStage(config.stage, config.enemyUnits);
    this.totalWeight = this.weights.reduce((sum, w) => sum + w.weight, 0);
  }

  /** dt = 게임 시간 기준 경과 초 (배속 적용 후) */
  tick(dt: number) {
    this.spawn(dt);
    this.move(dt);
  }

  private spawn(dt: number) {
    this.spawnAcc += this.config.spawnRate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.length >= MAX_ALIVE) continue;
      this.spawnOne();
    }
  }

  private spawnOne() {
    const def = unitDef(this.pickUnit());
    const { towerX, towerY, towerRadius, width } = this.field;
    const angle = Math.random() * Math.PI * 2;
    const r = towerRadius + 2;
    const mult = this.config.statMultiplier;

    this.enemies.push({
      id: this.nextId++,
      unitId: def.id,
      x: Math.min(width - 3, Math.max(3, towerX + Math.cos(angle) * r)),
      y: towerY + Math.sin(angle) * r,
      hp: def.stats.hp * mult,
      maxHp: def.stats.hp * mult,
      moveSpeed: def.stats.moveSpeed,
      range: def.stats.range,
      state: 'moving',
    });
  }

  private pickUnit(): UnitId {
    let roll = Math.random() * this.totalWeight;
    for (const w of this.weights) {
      roll -= w.weight;
      if (roll <= 0) return w.unitId;
    }
    return this.weights[this.weights.length - 1].unitId;
  }

  /** 적 유닛은 영웅을 향해 직진, 사거리에 도달하면 공격 상태 */
  private move(dt: number) {
    const { heroX, heroY, heroRadius } = this.field;
    for (const e of this.enemies) {
      const dx = heroX - e.x;
      const dy = heroY - e.y;
      const dist = Math.hypot(dx, dy);
      const stopDist = Math.max(e.range, 1) + heroRadius;

      if (dist <= stopDist) {
        e.state = 'attacking';
        continue;
      }
      e.state = 'moving';
      const step = Math.min(e.moveSpeed * dt, dist - stopDist);
      e.x += (dx / dist) * step;
      e.y += (dy / dist) * step;
    }
  }
}
