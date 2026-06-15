import type { EnemyHeroDef, EnemyHeroId, MiniBossId } from '@/game/types';

/**
 * 적 영웅 종족별 시각 구분 (피드백 6 — 스테이지대별 적 영웅 식별).
 * 전투 상단 엠블럼 + 홈 스테이지 셀 공용.
 */
export const ENEMY_HERO_VISUAL: Record<EnemyHeroId, { icon: string; color: string; tag: string }> = {
  knight: { icon: '⚔️', color: '#e8c468', tag: '정통파' },
  mage: { icon: '🔮', color: '#b06fe8', tag: '광역 마법' },
  paladin: { icon: '👑', color: '#ffd700', tag: '엔드 보스' },
};

/**
 * 적 영웅 3종 (설계 09).
 * - 타워 위 고정, HP = 타워 HP 동기화 (시각 연출용)
 * - 카드 없음, 스테이지별 자동 성장
 */
export const ENEMY_HEROES: EnemyHeroDef[] = [
  {
    id: 'knight',
    name: '기사',
    concept: '인간 종족의 얼굴 — 정통파 균형형 (학습 구간)',
    stageRange: [1, 10],
    stats: { atk: 25, def: 30, hp: 200, range: 2, atkSpeed: 1.0, aoe: 2 },
    skills: [
      {
        name: '성주변 휩쓸기',
        description: '반경 5 광역, 공격력 120% 피해 — 성 주변 거대 검기 회전',
        cooldown: 20,
      },
    ],
    growthPerStage: { hp: 20, atk: 2, skillCdr: 0.5, spawnRate: 0.05 },
  },
  {
    id: 'mage',
    name: '마법사',
    concept: '인간의 비전 — 지식 탐구, 광역 마법 폭격',
    stageRange: [11, 20],
    // 원거리 사거리 ×0.6 재조정 (18→11)
    stats: { atk: 30, def: 10, hp: 220, range: 11, atkSpeed: 0.8, aoe: 1 },
    skills: [
      {
        name: '필드 랜덤 메테오',
        description: '5발, 발당 공격력 200%, 반경 3',
        cooldown: 30,
      },
    ],
    growthPerStage: { hp: 30, atk: 3, skillCdr: 1, spawnRate: 0.05 },
  },
  {
    id: 'paladin',
    name: '팔라딘',
    concept: '기사 + 신성력 종합 — 엔드게임 보스',
    stageRange: [21, 30],
    stats: { atk: 35, def: 25, hp: 240, range: 3, atkSpeed: 1.2, aoe: 2 },
    skills: [
      {
        name: '신성 광역',
        description: '반경 6 광역, 공격력 180% 피해',
        cooldown: 25,
      },
      {
        name: '회복 오라 (패시브)',
        description: '반경 5 내 아군 HP/초 회복 = 공격력 × 0.3',
      },
      {
        name: '무적기',
        description: '5초 무적, 쿨 60초 (타워 HP 50% 이하 시 1회 자동 발동)',
        cooldown: 60,
      },
    ],
    growthPerStage: { hp: 50, atk: 4, skillCdr: 1, spawnRate: 0.05 },
  },
];

/** 미니보스 — 다운그레이드 영웅, 10초 쿨 스폰 (설계 13) */
export const MINI_BOSSES: Record<
  MiniBossId,
  { name: string; baseHero: 'knight' | 'mage'; exp: number; spawnCooldown: number }
> = {
  knightMini: { name: '기사 미니보스', baseHero: 'knight', exp: 30, spawnCooldown: 10 },
  mageMini: { name: '마법사 미니보스', baseHero: 'mage', exp: 40, spawnCooldown: 10 },
};

/** 30스테이지 팔라딘 직접 등장: 처치 EXP (회당) */
export const PALADIN_BOSS_EXP = 100;

export function enemyHeroForStage(stage: number): EnemyHeroDef {
  return (
    ENEMY_HEROES.find((h) => stage >= h.stageRange[0] && stage <= h.stageRange[1]) ??
    ENEMY_HEROES[ENEMY_HEROES.length - 1]
  );
}
