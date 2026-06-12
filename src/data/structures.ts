import type { StructureKind } from '@/game/types';

/**
 * 구조물 시스템 (설계 11).
 * - 모두 파괴 가능 (HP 보유), 처치 시 경험치
 * - 성벽: 타워 주변 고정 — 부숴야 타워 공격 가능
 * - 바리케이트: 맵 전체 랜덤 — 동선 방해
 * - 트랩: 타워 반경 내 랜덤 — 접근 시 피해 + 1초 기절, 1회 발동 후 소멸
 */
export interface StructureSpec {
  name: string;
  hp: number;
  def: number;
  exp: number;
  /** 몸체 반경 (렌더링/충돌) */
  radius: number;
}

export const STRUCTURE_SPECS: Record<StructureKind, StructureSpec> = {
  wall: { name: '성벽', hp: 200, def: 5, exp: 5, radius: 3 },
  barricade: { name: '바리케이트', hp: 80, def: 0, exp: 3, radius: 2.2 },
  trap: { name: '트랩', hp: 30, def: 0, exp: 1, radius: 1.2 },
};

/** 트랩 발동: 반경 내 아군 진입 시 피해 + 기절 (설계 11) */
export const TRAP_TRIGGER = {
  radius: 2.5,
  /** 피해 = atk × statMultiplier × ratio */
  atk: 50,
  ratio: 0.8,
  stunSec: 1,
} as const;

/** 스테이지별 구조물 수량 (설계 11) */
export function structureCounts(stage: number): { walls: number; barricades: number; traps: number } {
  if (stage <= 5) return { walls: 2, barricades: 3, traps: 2 };
  if (stage <= 10) return { walls: 4, barricades: 5, traps: 4 };
  if (stage <= 15) return { walls: 4, barricades: 7, traps: 6 };
  if (stage <= 20) return { walls: 4, barricades: 9, traps: 8 };
  if (stage <= 25) return { walls: 4, barricades: 12, traps: 10 };
  return { walls: 4, barricades: 15, traps: 12 };
}

/** 구조물 HP 스케일: × (1 + 0.1 × 스테이지) */
export function structureHpScale(stage: number): number {
  return 1 + 0.1 * stage;
}
