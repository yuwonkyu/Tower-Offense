import type { HeroDef } from '@/game/types';
import { HERO_REVIVE_SECONDS } from '@/game/formulas';

/**
 * 아군 영웅 3종 (설계 03).
 * - 인게임: 선형 성장, 레벨업 시 HP 25% 회복, 이속/사거리/범위 성장 X
 * - 메타: 영웅별 독립 레벨 (스테이지 클리어 + 중복 뽑기 EXP),
 *   레벨업 시 스탯 포인트 +1 (1포인트 = 해당 스탯 +1%),
 *   5레벨마다 스킬 포인트 +1, 초기화 = 다이아
 */
export const HEROES: HeroDef[] = [
  {
    id: 'maruhan',
    name: '마루한',
    concept: '돌격대장 (탱커/근접 광역)',
    // 유닛 평균 ~3배 스케일 (HP avg~428→1500, ATK avg~38→95). 탱커=고방어
    stats: { atk: 95, def: 60, hp: 1500, moveSpeed: 6, range: 2, atkSpeed: 1.2, aoe: 2 },
    growth: { atk: 3, def: 4, hp: 45, atkSpeed: 0.02 },
    skill: {
      name: '용맹',
      description: '1분간 주변 아군 전체 + 자신의 모든 스탯 % 증가 (광역 버프형)',
      ratio: 0.1,
      cooldown: 60,
      duration: 60,
    },
    passive: {
      name: '강철 의지',
      description: '받는 피해 -15% (상시)',
      dmgReductionPct: 15,
    },
    reviveSeconds: HERO_REVIVE_SECONDS,
  },
  {
    id: 'mir',
    name: '미르',
    concept: '궁사 (원거리)',
    // 유닛 평균 ~3배 스케일 · 원거리 사거리 12 (활병 9 < 미르 12 < 투석기 18)
    stats: { atk: 125, def: 20, hp: 1150, moveSpeed: 6.5, range: 12, atkSpeed: 1.4, aoe: 1 },
    growth: { atk: 5, def: 1, hp: 30, atkSpeed: 0.03 },
    skill: {
      name: '살소나기',
      description: '광역 범위에 화살비 (150% 피해)',
      ratio: 1.5,
      cooldown: 60,
    },
    passive: {
      name: '매의 눈',
      description: '치명타 확률 +20% (상시, 치명타 1.5배)',
      critPct: 20,
    },
    reviveSeconds: HERO_REVIVE_SECONDS,
  },
  {
    id: 'noeul',
    name: '노을',
    concept: '암살자',
    // 유닛 평균 ~3배 스케일 · 고공속 암살자
    stats: { atk: 140, def: 20, hp: 1200, moveSpeed: 7, range: 1.5, atkSpeed: 2, aoe: 1 },
    growth: { atk: 6, def: 1, hp: 32, atkSpeed: 0.04 },
    skill: {
      name: '피노을',
      description: '지정 위치로 이동 + 광역 피해(130%) + 공격력 디버프',
      ratio: 1.3,
      cooldown: 60,
    },
    passive: {
      name: '그림자 보',
      description: '이동속도 +25% · 회피 +20% (상시)',
      moveSpeedPct: 25,
      evadePct: 20,
    },
    reviveSeconds: HERO_REVIVE_SECONDS,
  },
];

/** 스킬 강화: 기본 계수 10% + 스킬 레벨당 +2% */
export function skillBonusPct(skillLevel: number): number {
  return 0.1 + (skillLevel - 1) * 0.02;
}
