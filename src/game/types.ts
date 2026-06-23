/** 공통 유닛/영웅 스탯. 설계 문서 02, 03, 12 기준. */
export interface CombatStats {
  /** 공격력 */
  atk: number;
  /** 방어력 */
  def: number;
  /** 최대 체력 */
  hp: number;
  /** 이동속도 */
  moveSpeed: number;
  /** 사거리 */
  range: number;
  /** 공격속도 (초당 횟수) */
  atkSpeed: number;
  /** 공격범위 (광역 반경, 단일 = 1) */
  aoe: number;
}

export type UnitId =
  | 'shield' // 방패병
  | 'archer' // 활병
  | 'spear' // 창병
  | 'catapult' // 투석기
  | 'swordsman' // 검사
  | 'mageLow' // 하급 마법사
  | 'mageMid' // 중급 마법사
  | 'mageHigh' // 상급 마법사
  | 'assassin' // 암살자
  | 'bomber' // 폭탄병
  | 'healer' // 치유사
  | 'cavalry'; // 기마병

export type HeroId = 'maruhan' | 'mir' | 'noeul';
export type EnemyHeroId = 'knight' | 'mage' | 'paladin';
export type MiniBossId = 'knightMini' | 'mageMini';

/** 유닛 우선타깃 규칙 (설계 14) */
export type TargetPriority =
  | 'nearest' // 기본: 가까운 적
  | 'tank' // 투석기 → 탱커 우선
  | 'ranged' // 암살자/기마병 → 원거리 우선
  | 'cluster' // 폭탄병 → 밀집 위치
  | 'healAlly'; // 치유사 → HP 낮은 아군 회복

export interface UnitDef {
  id: UnitId;
  name: string;
  concept: string;
  stats: CombatStats;
  priority: TargetPriority;
  /** 처치 시 기본 경험치 (설계 10) */
  exp: number;
  /** 아군 해금 스테이지 (0 = 시작부터 보유) */
  unlockStage: number;
  /** 적측 첫 등장 스테이지 (기본 5종은 1) */
  enemyDebutStage: number;
  /**
   * 투사체 속도 (논리 단위/초). 설정 시 지면 조준 — 비행 중 타깃이 움직이면 빗나감.
   * 미설정 = 즉시 명중 (히트스캔)
   */
  projectileSpeed?: number;
  /** 내재 체력 재생 — 초당 최대 체력 % (근접병 유지력, 카드 보정과 합산). 미설정 = 0 */
  regenPctPerSec?: number;
  /** 기계 유닛 — 회복 불가 (투석기 등 비생물). 치유/재생/흡혈 대상 제외 */
  mechanical?: boolean;
  special?: string;
}

/** 구조물 종류 (설계 11) */
export type StructureKind = 'wall' | 'barricade' | 'trap';

export interface HeroGrowth {
  atk: number;
  def: number;
  hp: number;
  atkSpeed: number;
}

export interface HeroDef {
  id: HeroId;
  name: string;
  concept: string;
  stats: CombatStats;
  /** 레벨당 선형 성장 (설계 03) */
  growth: HeroGrowth;
  skill: {
    name: string;
    description: string;
    /** 스킬 계수 (예: 1.5 = 150% 피해) */
    ratio: number;
    cooldown: number;
    duration?: number;
  };
  /** 영웅 고유 패시브 (상시 자기 강화) */
  passive: {
    name: string;
    description: string;
    dmgReductionPct?: number;
    critPct?: number;
    evadePct?: number;
    moveSpeedPct?: number;
    atkPct?: number;
  };
  /** 부활 시간 (초) */
  reviveSeconds: number;
}

export interface EnemyHeroDef {
  id: EnemyHeroId;
  name: string;
  concept: string;
  /** 담당 스테이지 [시작, 끝] */
  stageRange: [number, number];
  stats: Omit<CombatStats, 'moveSpeed'>;
  skills: { name: string; description: string; cooldown?: number }[];
  /** 스테이지당 자동 성장 (설계 09) */
  growthPerStage: { hp: number; atk: number; skillCdr: number; spawnRate: number };
}

export type CardKind = 'unit' | 'trait' | 'global';
export type CardRarity = 'common' | 'rare';

/** 카드 1레벨당 효과 수치 묶음 (예: { hpPct: 8 } / { chance: 12, dmgPct: 2 }) */
export type CardLevelEffect = Record<string, number>;

export interface CardDef {
  id: string;
  kind: CardKind;
  rarity: CardRarity;
  name: string;
  description: string;
  /** trait 카드의 대상 유닛 */
  unitId?: UnitId;
  /** Lv1~Lv5 효과 (각 레벨 = 그 레벨에서 활성화되는 누적 보정치 전체). unit 카드도 Lv트랙 사용 */
  levels: CardLevelEffect[];
  /** 유닛 Lv트랙 각 레벨 이름 (Lv1~Lv5) — CardPickModal 표시용 */
  levelNames?: string[];
  /** 유닛 진화: 카드 레벨이 atLevel 이상이면 해당 유닛으로 생성 (마법사 하급→중급→상급) */
  evolve?: { atLevel: number; unitId: UnitId }[];
  /** 타워/구조물 미적용 여부 (출혈/화염 등 % 피해형) */
  excludesTower?: boolean;
}

export type StageDifficulty = 'normal' | 'hard';

export interface StageConfig {
  stage: number;
  difficulty: StageDifficulty;
  /** 제한 시간 (초) — 10분 */
  timeLimit: number;
  tower: { hp: number; def: number };
  enemyHero: EnemyHeroId;
  /** 등장 적 유닛 풀 */
  enemyUnits: UnitId[];
  /**
   * 배치형 수비 진형 (종류별 마릿수). 설정 시 "배치 vs 스폰" 모드:
   * 시작에 일괄 배치 + reinforcePctPerMin로 보충(연속 스폰 X). 미설정 시 기존 spawnRate 스폰.
   */
  formation?: Partial<Record<UnitId, number>>;
  /** 배치형 분당 보충률 % (진형 총량 대비, 캡=진형 마릿수). 0/미설정 = 보충 없음(일회성 돌파) */
  reinforcePctPerMin?: number;
  /** 초당 총 스폰율 (스폰형 전용) */
  spawnRate: number;
  /** 적 유닛 스탯 배수 (공/방/HP) */
  statMultiplier: number;
  /** 처치 EXP 배수 */
  expMultiplier: number;
  /** 미니보스 (10초 쿨 스폰) */
  miniBosses: MiniBossId[];
  /** 클리어 시 해금되는 아군 유닛 */
  unlocksUnit?: UnitId;
  /** 30스테이지: 팔라딘 직접 등장 (초 단위 시점) */
  bossAppearances?: number[];
}
