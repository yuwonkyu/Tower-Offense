import type { UnitDef } from '@/game/types';

/**
 * 신규 적 유닛 7종 (설계 12 — 인간 종족 확장).
 * unlockStage = 적측 첫 등장 스테이지 클리어 시 아군 카드 해금.
 * 마법사는 업그레이드 라인: 신규 등급 등장 시 이전 등급은 적 풀에서 점차 제외.
 * 원거리 사거리는 설계 원본 ×0.6 (가로 160 맵 재조정).
 */
export const NEW_ENEMY_UNITS: UnitDef[] = [
  {
    // 메타(가챠/유닛탭)에선 "마법사" 대표 — 인게임에선 Lv1 하급 → Lv3 중급 → Lv5 상급으로 진화
    id: 'mageLow',
    name: '마법사',
    concept: '마법 진화 라인 (하급→중급→상급)',
    // 15 / 1.75초 / 290 / 재생10 / 중거리 / 270 / 보통 (하급)
    stats: { atk: 15, def: 2, hp: 290, moveSpeed: 5.0, range: 9, atkSpeed: 0.57, aoe: 1 },
    regenPctPerSec: 3.45,
    priority: 'nearest',
    exp: 6,
    unlockStage: 11,
    enemyDebutStage: 11,
    special: '레벨업으로 중급·상급 마법사로 진화',
  },
  {
    id: 'mageMid',
    name: '중급 마법사',
    concept: '매직볼 (광역 소형)',
    // 20 / 1.75초 / 290 / 재생10 / 중거리 / 270 / 보통 (중급)
    stats: { atk: 20, def: 2, hp: 290, moveSpeed: 5.0, range: 9, atkSpeed: 0.57, aoe: 1.5 },
    regenPctPerSec: 3.45,
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
    // 25 / 1.75초 / 290 / 재생10 / 중거리 / 270 / 보통 (상급, 체인 라이트닝)
    stats: { atk: 25, def: 2, hp: 290, moveSpeed: 5.0, range: 9, atkSpeed: 0.57, aoe: 1.5 },
    regenPctPerSec: 3.45,
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
    // 50 / 2.2초 / 400 / 재생10 / 근거리 / 330 / 빠름
    stats: { atk: 50, def: 2, hp: 400, moveSpeed: 6.1, range: 1.5, atkSpeed: 0.45, aoe: 1 },
    regenPctPerSec: 2.5,
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
    // 110 / 자폭 / 450 / 재생10 / 근거리 / 330 / 빠름 (atk +10% — 피드백)
    stats: { atk: 110, def: 3, hp: 450, moveSpeed: 6.1, range: 0, atkSpeed: 1, aoe: 5 },
    regenPctPerSec: 2.22,
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
    // 25(=회복원) / 2초 / 290 / 재생20 / 중거리 / 270 / 보통. 공격X, 회복=공격력×0.5/초
    stats: { atk: 25, def: 2, hp: 290, moveSpeed: 5.0, range: 9, atkSpeed: 0.5, aoe: 1 },
    regenPctPerSec: 6.9,
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
    // 34 / 1.4초 / 520 / 재생15 / 근거리 / 350 / 느림
    stats: { atk: 34, def: 15, hp: 520, moveSpeed: 6.5, range: 1.5, atkSpeed: 0.71, aoe: 1 },
    regenPctPerSec: 2.88,
    priority: 'ranged',
    exp: 10,
    unlockStage: 24,
    enemyDebutStage: 24,
    special: '빠른 기동으로 원거리 위협, 원거리 공격에 취약',
  },
];

/** 폭탄병 자폭 후 EXP */
export const BOMBER_EXPLODED_EXP = 5;

/**
 * 마법사 진화 라인. 메타(가챠/유닛탭/강화)에선 mageLow가 "마법사" 대표 1종,
 * 중급/상급은 인게임 진화 전용이라 메타에서 숨김 — "마법사" 강화 시 진화 형태 전부에 적용.
 */
export const MAGE_EVOLUTION: UnitDef['id'][] = ['mageLow', 'mageMid', 'mageHigh'];
export const META_HIDDEN_UNITS = new Set<UnitDef['id']>(['mageMid', 'mageHigh']);
