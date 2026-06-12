import type { UnitDef } from '@/game/types';

/**
 * 신규 적 유닛 7종 (설계 12 — 인간 종족 확장).
 * unlockStage = 적측 첫 등장 스테이지 클리어 시 아군 카드 해금.
 * 마법사는 업그레이드 라인: 신규 등급 등장 시 이전 등급은 적 풀에서 점차 제외.
 * 원거리 사거리는 설계 원본 ×0.6 (가로 160 맵 재조정).
 */
export const NEW_ENEMY_UNITS: UnitDef[] = [
  {
    id: 'mageLow',
    name: '하급 마법사',
    concept: '매직미사일 (단일)',
    stats: { atk: 30, def: 5, hp: 40, moveSpeed: 4, range: 9, atkSpeed: 0.7, aoe: 1 },
    priority: 'nearest',
    exp: 6,
    unlockStage: 11,
    enemyDebutStage: 11,
    special: '매직미사일 단일 공격',
  },
  {
    id: 'mageMid',
    name: '중급 마법사',
    concept: '매직볼 (광역 소형)',
    stats: { atk: 40, def: 5, hp: 50, moveSpeed: 4, range: 10, atkSpeed: 0.7, aoe: 1.5 },
    priority: 'nearest',
    exp: 10,
    unlockStage: 18,
    enemyDebutStage: 18,
    special: '매직볼 광역 — 등장 시 하급 마법사 점차 제외',
  },
  {
    id: 'mageHigh',
    name: '상급 마법사',
    concept: '체인 라이트닝',
    stats: { atk: 55, def: 5, hp: 60, moveSpeed: 4, range: 10, atkSpeed: 0.7, aoe: 1.5 },
    priority: 'nearest',
    exp: 15,
    unlockStage: 25,
    enemyDebutStage: 25,
    special: '체인 라이트닝 3회 튕김 고정 — 등장 시 중급 마법사 점차 제외',
  },
  {
    id: 'assassin',
    name: '암살자',
    concept: '원거리 사냥꾼',
    stats: { atk: 40, def: 5, hp: 30, moveSpeed: 7, range: 1, atkSpeed: 1.5, aoe: 1 },
    priority: 'ranged',
    exp: 8,
    unlockStage: 14,
    enemyDebutStage: 14,
    special: '회피 30% (캡 없음), 원거리 유닛 우선 타깃',
  },
  {
    id: 'bomber',
    name: '폭탄병',
    concept: '자폭 광역',
    stats: { atk: 80, def: 5, hp: 50, moveSpeed: 4, range: 0, atkSpeed: 0, aoe: 4 },
    priority: 'cluster',
    exp: 10,
    unlockStage: 18,
    enemyDebutStage: 18,
    special: '자폭 전 처치 EXP 100% / 자폭 후 50% (EXP 5)',
  },
  {
    id: 'healer',
    name: '치유사',
    concept: '아군 회복 지원',
    stats: { atk: 0, def: 10, hp: 60, moveSpeed: 4, range: 5, atkSpeed: 1, aoe: 1 },
    priority: 'healAlly',
    exp: 12,
    unlockStage: 21,
    enemyDebutStage: 21,
    special: '공격 X, 회복량 = 공격력 × 0.5/초 (공격력 카드로 회복량 증가)',
  },
  {
    id: 'cavalry',
    name: '기마병',
    concept: '고속 기동',
    stats: { atk: 45, def: 30, hp: 100, moveSpeed: 9, range: 1.5, atkSpeed: 1, aoe: 1 },
    priority: 'ranged',
    exp: 10,
    unlockStage: 24,
    enemyDebutStage: 24,
    special: '빠른 기동으로 원거리 위협, 원거리 공격에 취약',
  },
];

/** 폭탄병 자폭 후 EXP */
export const BOMBER_EXPLODED_EXP = 5;
