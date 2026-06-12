import type { UnitDef } from '@/game/types';

/**
 * 유저 기본 유닛 5종 (설계 02). 적측도 동일 풀 사용 (스탯 배수만 차등).
 * 신규 7종은 enemyUnits.ts — 적측 첫 등장 스테이지 클리어 시 아군 해금.
 */
export const BASE_UNITS: UnitDef[] = [
  {
    id: 'shield',
    name: '방패병',
    concept: '근접 탱커',
    stats: { atk: 2, def: 40, hp: 60, moveSpeed: 3.5, range: 1, atkSpeed: 0.6, aoe: 1 },
    priority: 'nearest',
    exp: 2,
    unlockStage: 0,
    enemyDebutStage: 1,
  },
  {
    id: 'archer',
    name: '활병',
    concept: '원거리 딜러',
    stats: { atk: 24, def: 5, hp: 40, moveSpeed: 5, range: 20, atkSpeed: 1.2, aoe: 1 },
    priority: 'nearest',
    exp: 2,
    unlockStage: 0,
    enemyDebutStage: 1,
  },
  {
    id: 'spear',
    name: '창병',
    concept: '중근거리',
    stats: { atk: 27, def: 17, hp: 50, moveSpeed: 5, range: 3, atkSpeed: 0.8, aoe: 1 },
    priority: 'nearest',
    exp: 2,
    unlockStage: 0,
    enemyDebutStage: 1,
  },
  {
    id: 'catapult',
    name: '투석기',
    concept: '광역 공성',
    // 사거리 45 → 26: 가로 160 맵에서 45는 28%를 덮어 적 투석기 스테이지가 공략 불가 (시뮬 검증)
    stats: { atk: 45, def: 35, hp: 90, moveSpeed: 1.5, range: 26, atkSpeed: 0.33, aoe: 5 },
    priority: 'tank',
    exp: 4,
    unlockStage: 0,
    enemyDebutStage: 1,
  },
  {
    id: 'swordsman',
    name: '검사',
    concept: '근거리 딜러',
    stats: { atk: 20, def: 25, hp: 50, moveSpeed: 5, range: 1.5, atkSpeed: 1, aoe: 1 },
    priority: 'nearest',
    exp: 2,
    unlockStage: 0,
    enemyDebutStage: 1,
  },
];
