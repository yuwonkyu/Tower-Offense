import type { UnitDef } from '@/game/types';

/**
 * 유저 기본 유닛 5종 (설계 02). 적측도 동일 풀 사용 (스탯 배수만 차등).
 * 신규 7종은 enemyUnits.ts — 적측 첫 등장 스테이지 클리어 시 아군 해금.
 *
 * 워3 유닛 기반 재구성 (밸런스 개편):
 * - atkSpeed = 1 / (초당 공격 간격)  ·  moveSpeed = WC3속도 / 54  (270→5.0)
 * - 사거리 범주 매핑: 근거리 1.5 / 중근거리 4 / 중거리 9 / 장거리 18
 * - regenPctPerSec = (초당 체력재생 flat) / hp * 100
 * - 방어력은 추천값(원 표에 없음). 젠속도 = SPAWN_FREQ (spawnWeights.ts)
 */
export const BASE_UNITS: UnitDef[] = [
  {
    id: 'shield',
    name: '방패병',
    concept: '근접 탱커',
    // 12.5 / 1.35초 / 420 / 재생10 / 근거리 / 270 / 빠름 (def 추천 30 — 실질 탱킹)
    stats: { atk: 12.5, def: 30, hp: 420, moveSpeed: 5.0, range: 1.5, atkSpeed: 0.74, aoe: 1 },
    regenPctPerSec: 2.38,
    priority: 'nearest',
    exp: 2,
    unlockStage: 0,
    enemyDebutStage: 1,
  },
  {
    id: 'archer',
    name: '활병',
    concept: '원거리 딜러',
    // 21 / 1.4초 / 535 / 재생10 / 중거리 / 270 / 보통
    stats: { atk: 21, def: 2, hp: 535, moveSpeed: 5.0, range: 9, atkSpeed: 0.71, aoe: 1 },
    regenPctPerSec: 1.87,
    priority: 'nearest',
    exp: 2,
    unlockStage: 0,
    enemyDebutStage: 1,
  },
  {
    id: 'spear',
    name: '창병',
    concept: '중근거리',
    // 20 / 1.9초 / 600 / 재생10 / 중근거리 / 300 / 빠름
    stats: { atk: 20, def: 10, hp: 600, moveSpeed: 5.6, range: 4, atkSpeed: 0.53, aoe: 1 },
    regenPctPerSec: 1.67,
    priority: 'nearest',
    exp: 2,
    unlockStage: 0,
    enemyDebutStage: 1,
  },
  {
    id: 'catapult',
    name: '투석기',
    concept: '광역 공성',
    // 79 / 3.5초 / 360 / 재생10 / 장거리 / 270 / 느림. mechanical 제거(표에 재생 명시) — 회복 가능
    // range 18→22: 공성 무기 사거리 확대 (먼 적 우선 타격, CATAPULT_MIN_RANGE와 함께 — 피드백)
    stats: { atk: 79, def: 5, hp: 360, moveSpeed: 5.0, range: 22, atkSpeed: 0.29, aoe: 5 },
    regenPctPerSec: 2.78,
    projectileSpeed: 20, // 지면 조준 투사체 — 이동 타깃 회피, 정지 목표 명중
    priority: 'tank',
    exp: 4,
    unlockStage: 0,
    enemyDebutStage: 1,
  },
  {
    id: 'swordsman',
    name: '검사',
    concept: '근거리 딜러',
    // 17 / 1.4초 / 420 / 재생10 / 근거리 / 270 / 빠름
    stats: { atk: 17, def: 8, hp: 420, moveSpeed: 5.0, range: 1.5, atkSpeed: 0.71, aoe: 1 },
    regenPctPerSec: 2.38,
    priority: 'nearest',
    exp: 2,
    unlockStage: 0,
    enemyDebutStage: 1,
  },
];
