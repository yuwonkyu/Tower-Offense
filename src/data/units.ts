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
    // 근접 유지력↑ (피드백): hp 60→78, def 40→46, 내재 체젠 1%/s (아군·적 공통)
    stats: { atk: 2, def: 46, hp: 78, moveSpeed: 3.5, range: 1, atkSpeed: 0.6, aoe: 1 },
    regenPctPerSec: 1,
    priority: 'nearest',
    exp: 2,
    unlockStage: 0,
    enemyDebutStage: 1,
  },
  {
    id: 'archer',
    name: '활병',
    concept: '원거리 딜러',
    stats: { atk: 24, def: 5, hp: 40, moveSpeed: 5, range: 12, atkSpeed: 1.2, aoe: 1 },
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
    // 원거리 사거리 ×0.6 재조정 (45→27) — 가로 160 맵 기준, 설계 02 원본은 가로 100 시절 수치
    stats: { atk: 45, def: 35, hp: 90, moveSpeed: 1.5, range: 27, atkSpeed: 0.33, aoe: 5 },
    // 투사체 지면 조준: 비행 중 이동한 타깃은 빗나감 (공성 무기 — 정지 목표에 강함)
    projectileSpeed: 20,
    mechanical: true, // 기계 — 회복 불가
    priority: 'tank',
    exp: 4,
    unlockStage: 0,
    enemyDebutStage: 1,
  },
  {
    id: 'swordsman',
    name: '검사',
    concept: '근거리 딜러',
    // 근접 유지력↑ (피드백): hp 50→62, def 25→30, 내재 체젠 0.8%/s (아군·적 공통)
    stats: { atk: 20, def: 30, hp: 62, moveSpeed: 5, range: 1.5, atkSpeed: 1, aoe: 1 },
    regenPctPerSec: 0.8,
    priority: 'nearest',
    exp: 2,
    unlockStage: 0,
    enemyDebutStage: 1,
  },
];
