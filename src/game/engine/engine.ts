import type {
  EnemyHeroDef,
  HeroDef,
  MiniBossId,
  StageConfig,
  StructureKind,
  TargetPriority,
  UnitDef,
  UnitId,
} from '@/game/types';
import { BASE_UNITS } from '@/data/units';
import { CARD_BONUS } from '@/data/cards';
import { ENEMY_HEROES, MINI_BOSSES, PALADIN_BOSS_EXP } from '@/data/enemyHeroes';
import { BOMBER_EXPLODED_EXP, NEW_ENEMY_UNITS } from '@/data/enemyUnits';
import { HEROES } from '@/data/heroes';
import { STRUCTURE_SPECS, structureCounts, structureHpScale, TRAP_TRIGGER } from '@/data/structures';
import {
  damage,
  expTotalForLevel,
  expToNextLevel,
  HERO_BASE_REGEN_PCT,
} from '@/game/formulas';
import { spawnWeightsForStage, supplyCost, type SpawnWeight } from '@/data/spawnWeights';
import { CardSystem, type UnitMods } from './cards';

/** 전체 유닛 정의 룩업 */
const UNIT_DEFS = new Map<UnitId, UnitDef>(
  [...BASE_UNITS, ...NEW_ENEMY_UNITS].map((u) => [u.id, u]),
);

export function unitDef(id: UnitId): UnitDef {
  return UNIT_DEFS.get(id)!;
}

/**
 * 논리 좌표계: 가로 160 고정, 세로 = 160 × (화면 비율).
 * 유닛 사거리/이속(설계 02, 12)을 그대로 논리 단위로 사용.
 * 가로 160 = 화면 약 40% 축소 부감 시점 (먼 거리에서 내려다보는 전장).
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
  const width = 160;
  const height = width * aspectRatio;
  return {
    width,
    height,
    towerX: width / 2,
    // 타워를 화면 정중앙으로 (0.40→0.50) — cover 배경의 중앙 거점과 자동 정렬(모든 기기) +
    // 사방 360° 포위/공성 대칭. 워3 타워서바이벌식 센터 거점 (피드백)
    towerY: height * 0.5,
    towerRadius: 11,
    heroX: width / 2,
    heroY: height * 0.74,
    heroRadius: 3,
  };
}

export type Side = 'ally' | 'enemy';
export type EntityState = 'moving' | 'attacking' | 'dead';

/** 전투 엔티티 종류: 유닛 / 영웅 / 구조물 / 미니보스 / 30스테이지 팔라딘 보스 */
export type EntityKind = UnitId | 'hero' | StructureKind | MiniBossId | 'paladinBoss';

const STRUCTURE_KINDS: ReadonlySet<string> = new Set(['wall', 'barricade', 'trap']);

export function isStructure(kind: EntityKind): boolean {
  return STRUCTURE_KINDS.has(kind);
}

/** 보스류 (미니보스/팔라딘) — 일격 즉사 면역 */
const BOSS_KINDS: ReadonlySet<string> = new Set(['knightMini', 'mageMini', 'paladinBoss']);

/** 타깃 식별: 양수 = 엔티티 id */
const NO_TARGET = -1;
const TOWER_TARGET = -2;

export interface CombatEntity {
  id: number;
  side: Side;
  kind: EntityKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  range: number;
  atkSpeed: number;
  moveSpeed: number;
  aoe: number;
  priority: TargetPriority;
  /** 회피율 0~1 (암살자 기본 0.3) */
  evade: number;
  /** 원거리 공격 피해 감소 0~1 (방패병 0.4, 검사 0.3) */
  rangedDmgReduction: number;
  /** 공성(타워/구조물) 피해 배수 (마법사·암살자 감소, 기본 1.0) */
  siegeDmgMult: number;
  /** 유닛 대상 공격력 배수 (암살자 1.6, 마법사 1.3, 기본 1.0) */
  vsUnitMult: number;
  /** 원거리 유닛 대상 공격력 배수 (기마병 1.5, 기본 1.0) */
  vsRangedUnitMult: number;
  /** 원거리 공격에 대한 추가 회피율 (암살자 +0.3) */
  evadeVsRanged: number;
  /** 처치 시 경험치 (적측만 의미, 배수 적용 전) */
  killExp: number;
  /** 치명타 확률 0~1 (배수 1.5배) */
  critChance: number;
  /** 가한 피해 % 회복 0~1 */
  lifestealPct: number;
  /** 초당 최대 체력 % 재생 */
  regenPctPerSec: number;
  /** HP 50% 이하 시 공격력 증가 % */
  frenzyAtkPct: number;
  /** 남은 기절 시간 (트랩/기절 카드) */
  stunLeft: number;
  /** 투사체 속도 (0 = 히트스캔) — 지면 조준, 비행 중 이동한 타깃은 빗나감 */
  projectileSpeed: number;
  attackCd: number;
  retargetCd: number;
  targetId: number;
  state: EntityState;
  /** 생성 후 경과 시간(초) — 오래된 유닛은 분산 제외 (성 침범·밀림 방지) */
  age: number;

  // ── 프록 효과 (설계 04, 05 — 카드 부여) ──
  /** 받는 피해 감소 0~1 */
  dmgReduction: number;
  /** 도발 확률 0~1 — 공격 시 주변 적 타깃 전환 */
  taunt: number;
  /** 관통 확률 0~1 — 1마리 추가 타격 */
  pierce: number;
  /** 추가피해 발동 확률 0~1 (추가타/불화살) */
  bonusChance: number;
  /** 추가피해량 — atk 대비 % (방어 미적용 고정) */
  bonusDmgPct: number;
  /** 출혈 발동 확률 0~1 */
  bleedChance: number;
  /** 출혈 초당 피해 — 대상 최대체력 % */
  bleedDotPct: number;
  /** 돌진 첫 타 추가피해 % (이속 보너스 포함) */
  chargeDmgPct: number;
  /** 돌진 준비 완료 (이동→교전 전환 시 세팅, 첫 타에 소모) */
  chargeReady: boolean;
  /** 화상 발동 확률 0~1 (투사체) */
  burnChance: number;
  /** 화상 초당 피해 — 대상 최대체력 % */
  burnPct: number;
  /** 타격 시 기절 (초, 투사체) */
  stunOnHit: number;
  /** 불굴 쿨타임 최대값 (0 = 미보유) */
  undyingCdMax: number;
  /** 불굴 남은 쿨타임 */
  undyingCd: number;
  /** 용맹(마루한 스킬) 버프 남은 시간 (0 = 미적용) */
  buffLeft: number;
  /** 용맹 버프 적용 % (해제 시 되돌리기용) */
  buffPct: number;
  /** 수호 오라 제공량 0~1 (방패병 Lv5 — 주변 아군 피해감소) */
  auraValue: number;
  /** 매 틱 재계산: 받고 있는 수호 오라 피해감소 0~1 (제공자 중 최대) */
  auraShield: number;
  /** 멀티샷 추가 타격 대상 수 (활병 Lv5 = 1) */
  multishot: number;
  /** 이중공격 확률 0~1 (공속 카드 Lv5 MAX) */
  doubleStrikeChance: number;
  /** 치유량 증가 배율 0~ (치유사 — 0 = 기본) */
  healBonus: number;
  /** 일격 즉사 확률 0~1 (암살자 Lv5) */
  executeChance: number;
  /** 피해 반사 0~1 — 받은 피해의 일부를 공격자에게 (방어력 카드 MAX) */
  reflect: number;
  /** 가시 0~1 — 피격 시 주변 적에게 자신 최대체력 % 광역 (체력 카드 MAX) */
  thorns: number;
  /** 가시 발동 쿨타임 남은 시간 (초) — 매 틱 빈발 방지 */
  thornsCd: number;
  /** 카운터 0~ — 회피 시 공격자에게 공격력 배수 피해 (회피율 카드 MAX) */
  counter: number;
  /** 코인 폭발 0~ — 처치 시 주변 적에게 공격력 배수 광역 (골드 카드) */
  coinBlast: number;
  /** 처치 시 랜덤 일반 적 즉사 확률 0~1 (골드 카드 MAX) */
  goldExecute: number;
  /** 피격 플래시 남은 시간 (초) — 타격감 연출, 렌더 전용 */
  hitFlash: number;
  /** 폭탄병 폭발 1회 처리 플래그 (자폭/요격사망 중복 폭발 방지) */
  exploded?: boolean;
  /** 기계 유닛 — 회복 불가 (치유/재생/흡혈 대상 제외) */
  noHeal: boolean;
  // 상태이상 런타임 (피격측)
  bleedLeft: number;
  bleedRate: number; // HP/초
  burnLeft: number;
  burnRate: number; // HP/초
  // 적 배회 목표 (설계: 성에만 붙지 않고 주변 순찰 — 피드백 4)
  roamX?: number;
  roamY?: number;
}

/** hurt() 등 호출 후 사망 재확인용 — TS narrowing 우회 */
function isDead(e: CombatEntity): boolean {
  return e.state === 'dead';
}

/** 프록/상태이상 필드 기본값 — 카드 미보유 엔티티용 */
function zeroProcFields() {
  return {
    dmgReduction: 0,
    taunt: 0,
    pierce: 0,
    bonusChance: 0,
    bonusDmgPct: 0,
    bleedChance: 0,
    bleedDotPct: 0,
    chargeDmgPct: 0,
    chargeReady: false,
    burnChance: 0,
    burnPct: 0,
    stunOnHit: 0,
    undyingCdMax: 0,
    undyingCd: 0,
    buffLeft: 0,
    buffPct: 0,
    auraValue: 0,
    auraShield: 0,
    multishot: 0,
    doubleStrikeChance: 0,
    age: 0,
    healBonus: 0,
    executeChance: 0,
    reflect: 0,
    thorns: 0,
    thornsCd: 0,
    counter: 0,
    coinBlast: 0,
    goldExecute: 0,
    hitFlash: 0,
    noHeal: false,
    bleedLeft: 0,
    bleedRate: 0,
    burnLeft: 0,
    burnRate: 0,
    // 역할 기본값 (직업 특성 시스템 — makeUnit에서 직업별 오버라이드)
    rangedDmgReduction: 0,
    siegeDmgMult: 1,
    vsUnitMult: 1,
    vsRangedUnitMult: 1,
    evadeVsRanged: 0,
  };
}

/** 비행 중인 투사체 (투석기 등) — 발사 시점의 타깃 위치를 조준 */
export interface Projectile {
  id: number;
  side: Side;
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number;
  atk: number;
  aoe: number;
  critChance: number;
  /** 화상 프록 (투석기 화염공격 카드) */
  burnChance: number;
  burnPct: number;
  /** 타격 시 기절 (투석기 기절 카드) */
  stunSec: number;
  /** 발사자 id (피격 반격용) */
  attackerId: number;
  /** 타워 조준 (정지 목표 — 항상 명중) */
  targetTower: boolean;
  /** 호밍 대상 id — 설정 시 매 틱 타깃 위치 추적 (영웅 화살: 항상 명중) */
  homingId?: number;
  /** 영웅 화살 비주얼 플래그 (구분된 색 + 비행 잔상) */
  arrow?: boolean;
}

/** 전투 시각 이펙트 (스킬/광역 발동 위치 — 퍼지며 사라지는 링). 렌더 전용, 시뮬은 무시 */
export interface VisualEffect {
  id: number;
  x: number;
  y: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  /** true = 시전 경고(텔레그래프): 고정 반경 위험 표시(점점 진해짐). false/미지정 = 퍼지는 타격 링 */
  warning?: boolean;
}

/** 원거리 즉시타격 시각 트레이서 (활/마법 — 피해는 이미 즉시 적용, 시각만). 시뮬은 무시 */
export interface Tracer {
  id: number;
  fromX: number;
  fromY: number;
  tx: number;
  ty: number;
  life: number;
  maxLife: number;
  color: string;
}

/** 적 영웅 스킬 예약 타격 — 텔레그래프(경고) 후 delay 경과 시 광역 피해 발동 */
interface PendingStrike {
  delay: number;
  x: number;
  y: number;
  radius: number;
  dmg: number;
  color: string;
}

/** 동시 생존 캡 — 양측 동일 (포위 공성: 뭉치기 제거 후 대칭화). 폰 성능 균형점 200 (피드백) */
// 소모 인구수 캡 — 양측 동일. 살아있는 유닛의 supplyCost 합이 이 값 이하 (1코스트 기준 200기)
const SUPPLY_CAP = 200;
/** 헤드스타트 — 시작 카드 선택권 (1번째=유닛 보장[rollChoices], 2·3=랜덤). 영웅 단독 시작 방지 (피드백) */
const HEAD_START_PICKS = 3;
/** 유닛 카드 보유 시 기본 초당 생성률 — 물량 스트림으로 전선 상시 유지 (모여서 출발 대신 연속 젠) */
const ALLY_SPAWN_BASE = 2.0;
/** 유닛 카드 1장당 추가 생성률 (설계 07: 카드마다 독립 생성) */
const ALLY_SPAWN_RATE_PER_CARD = 1.0;
/** 사거리 + α 안의 적을 탐지 (밖이면 아군은 타워로 진군) */
const AGGRO_BONUS = 14;
/** 영웅 탐지 범위 — 근접 영웅도 원거리 포격에 대응하도록 넓게 */
const HERO_AGGRO = 35;
/** 영웅 원거리 투사체 속도 — 호밍이라 항상 명중, 빠른 비행 비주얼용 */
const HERO_PROJECTILE_SPEED = 30;
/** 적 영웅 스킬 시전 경고 시간 (초) — 텔레그래프 후 타격 (P2 위협 가독성) */
const METEOR_CAST = 0.9;
const SWEEP_CAST = 0.7;
/** 적 방어 반경: 타워에서 이 거리 안의 아군만 추격 (방어 유닛 운용 — 설계 10) */
const ENEMY_DEFEND_RADIUS = 60;
/** 적 대기 링: 추격 대상 없으면 타워 주변으로 귀환 */
const ENEMY_GUARD_RING = 8;
/** 적 배회 반경 — 추격 대상 없으면 타워 주변 이 범위를 순찰 (성에만 붙지 않게 — 피드백 4) */
const ENEMY_ROAM_MIN = 18;
const ENEMY_ROAM_MAX = 52;
/**
 * 성 외곽 keep-out 여유: 유닛 중심이 타워중심에서 (towerRadius + 이 값) 안으로 들어오지 못한다.
 * 성벽/흉벽 그래픽(≈towerRadius×1.2) 위로 유닛이 겹치지 않게 — 아군·적 공통 (피드백).
 */
const TOWER_KEEPOUT_MARGIN = 6;
/**
 * 아군 랠리: 이 수 이상 모이면 웨이브로 진군.
 * 폰 피드백 — "모여서 출발"이 어색 → 물량 스트림으로 전환. 대기 없이 즉시 진군(=1),
 * 손실은 상향된 스폰율(BASE 2.0/카드 1.0)로 보전.
 */
const ALLY_RALLY_SIZE = 1;
/** 원거리 판정 기준 사거리 (암살자/기마병 우선타깃용) */
const RANGED_THRESHOLD = 10;
/** 치유사 초당 회복 — 설계상 공격력×0.5인데 기본 공격력 0이라 임시 보정값 사용 */
const HEALER_HEAL_PER_SEC = 10;
/** 엔티티 몸체 반경 (충돌 판정용) */
const BODY_RADIUS = 2;
/** 적 스폰 워밍업: 시작 40% → 90초에 100% (카드가 점진 획득되는 초반 진형 구축 시간 확보) */
const ENEMY_SPAWN_WARMUP_SECONDS = 90;
const ENEMY_SPAWN_WARMUP_START = 0.4;
/** 출혈/화상 지속 시간 (초) — 설계 04 (화염공격 3초 화상) */
const DOT_DURATION = 3;
/** 도발 반경 — 발동 시 이 범위의 적 타깃을 도발 유닛으로 전환 */
const TAUNT_RADIUS = 6;
/** 관통: 본 타깃 주변 이 반경 내 적 1마리 추가 타격 */
const PIERCE_RADIUS = 3.5;
/** 돌진: 교전 접근 이동 속도 배수 */
const CHARGE_MOVE_MULT = 1.3;
/** 유닛 분산: 아군끼리 이 거리 이하면 서로 밀어냄 (뭉침 방지 — 피드백 1·9) */
const SEPARATION_RADIUS = 5;
/** 분산 grace: 생성 후 이 시간(초) 지난 유닛은 분산 제외 — 성 침범·밀림 방지 (피드백, 필요 시 60으로) */
const SEPARATION_GRACE = 30;
/** 분산 강도 (한 틱당 최대 밀어내기 거리 계수) */
const SEPARATION_FORCE = 0.5;
/** 투석기 발사 준비 시간 (초) — 배치 직후 즉시 사격 방지 (피드백 8) */
const CATAPULT_WIND_UP = 3.0;
/** 이 시간(초) 경과 후 경험치 2배 (피드백 6: 장기전 보상) */
const LATE_GAME_EXP_TIME = 300;
/** 원거리 공격자 판정 기준 (피해 반감·회피 적용) — 타깃 우선순위 RANGED_THRESHOLD와 별개 */
const RANGED_ATK_RANGE = 5;
/** 투석기 최소 사거리 — 이보다 가까운 적은 타격 안 함 (공성 무기 — 먼 적/구조물 위주, 피드백) */
const CATAPULT_MIN_RANGE = 6;
/** 생존 적 이 수 이하일 때 공성(타워) 피해 배수 (섬멸 마무리 보상) */
const SIEGE_CLEANUP_THRESHOLD = 30;
const SIEGE_CLEANUP_MULT = 1.5;
/** 용맹(마루한): 시전 이펙트 링 반경 (버프 자체는 전군 적용 — applyValorBuff) */
const VALOR_RADIUS = 44;
/** 수호 오라(방패병 Lv5): 이 반경 내 아군 피해감소 (카드 개편) */
const SHIELD_AURA_RADIUS = 12;
/** 치유사 내재 수호 오라 — 주변 아군 받는 피해 감소 0~1 (아군·적 공통) */
const HEALER_AURA_DR = 0.15;
/** 가시(체력 카드 MAX): 피격 광역 반경 + 발동 쿨타임(초) — 매 틱 빈발 방지 */
const THORNS_RADIUS = 6;
const THORNS_CD = 0.5;
/** 코인 폭발(골드 카드): 처치 시 광역 피해 반경 */
const COIN_BLAST_RADIUS = 7;
/** 골드 MAX 즉사 연쇄 최대 깊이 (스택 폭주 방지) */
const GOLD_EXECUTE_MAX_CHAIN = 6;
/** 멀티샷(활병 Lv5): 추가 타격 탐색 반경 = 사거리 + 이 보너스 */
const MULTISHOT_BONUS = 4;
/** 일격(암살자 Lv5): 보스는 즉사 면역 → 대신 공격력 × 이 배수의 큰 피해 (방어 무시) */
const EXECUTE_BOSS_MULT = 7;
/** 피격 플래시 지속(초) — 타격감 연출 (렌더 전용) */
const HIT_FLASH = 0.08;
const TOWER_FLASH = 0.14;

export type EngineResult = 'ongoing' | 'victory';

export class BattleEngine {
  entities: CombatEntity[] = [];
  projectiles: Projectile[] = [];
  /** 시각 이펙트 (스킬 발동 링) — BattleField가 렌더 */
  effects: VisualEffect[] = [];
  tracers: Tracer[] = [];
  /** 적 영웅 스킬 예약 타격 (텔레그래프 후 발동) */
  private pendingStrikes: PendingStrike[] = [];
  hero: CombatEntity;
  towerHp: number;
  kills = 0;
  totalExp = 0;
  level = 1;
  reviveLeft = 0;
  result: EngineResult = 'ongoing';
  /** 경과 게임 시간 (초) */
  time = 0;
  /** 쌓인 카드 선택권 — 전투 시작 시 헤드스타트 N회 + 레벨업마다 1회 */
  pendingPicks = HEAD_START_PICKS;
  /** 인게임 카드 보유/풀 (설계 04, 05, 07) */
  readonly cards: CardSystem;
  /** 타워 무적 잔여 시간 (팔라딘 무적기) */
  invulnLeft = 0;
  /** 타워 피격 플래시 남은 시간 (초) — 렌더 전용 */
  towerFlash = 0;
  /** 영웅 스킬 남은 쿨타임 (초) — HUD가 동기화 */
  heroSkillCd = 0;
  /** 투신(스탯 버프) 잔여 시간 */
  heroSkillBuffLeft = 0;
  /** 영웅 스킬 메타 레벨 (5레벨마다 +1, progressStore) — 레벨당 계수 +2% */
  heroSkillLevel = 1;
  private heroBuffPct = 0;

  private spawnAcc = 0;
  private reinforceAcc = 0; // 배치형 보충 누적
  private allySpawnAcc = 0;
  /** 아군 포위 생성 각도 누적 — 골든 앵글로 360° 골고루 분산 (피드백 5) */
  private allySpawnAngle = 0;
  private timeExpAcc = 0;
  private allyWaveReady = false;
  private nextId = 1;
  private readonly weights: SpawnWeight[];
  /** 적 유닛 종류 목록 (1/n 캡 + 결손우선 스폰 선택용) */
  private readonly enemyTypes: UnitId[];
  private readonly heroDef: HeroDef;
  private readonly byId = new Map<number, CombatEntity>();

  /** 적 영웅 (타워 위 고정, 설계 09) */
  private readonly enemyHero: EnemyHeroDef;
  private readonly enemyHeroAtk: number;
  private readonly enemyHeroSkillCdMax: number;
  private enemyHeroAtkCd = 0;
  private enemyHeroSkillCd: number;
  private invulnUsed = false;
  private readonly miniBossCd = new Map<MiniBossId, number>();
  private bossAppearIdx = 0;

  /** 유닛 메타 레벨 보너스: unitId → 추가 배수 (예: 0.05 = +5%) */
  private readonly unitMetaBonus: Map<string, number>;

  constructor(
    readonly config: StageConfig,
    readonly field: FieldLayout,
    heroDef: HeroDef = HEROES[0],
    unitMetaBonuses: Record<string, number> = {},
    unlockedUnits: UnitId[] = [],
  ) {
    this.unitMetaBonus = new Map(Object.entries(unitMetaBonuses));
    this.weights = spawnWeightsForStage(config.stage, config.enemyUnits);
    this.enemyTypes = this.weights.map((w) => w.unitId);
    this.heroDef = heroDef;
    this.towerHp = config.tower.hp;
    this.cards = new CardSystem(config.difficulty === 'hard', new Set(unlockedUnits));
    this.hero = this.makeHero();
    this.addEntity(this.hero);
    this.refreshHeroStats(); // 패시브(상시 자기 강화) 즉시 반영

    // 적 영웅: 스테이지별 자동 성장 (설계 09) — 스폰 가속은 스테이지 테이블에 이미 반영
    this.enemyHero = ENEMY_HEROES.find((h) => h.id === config.enemyHero) ?? ENEMY_HEROES[0];
    const offset = Math.max(0, config.stage - this.enemyHero.stageRange[0]);
    this.enemyHeroAtk = this.enemyHero.stats.atk + this.enemyHero.growthPerStage.atk * offset;
    const baseCd = this.enemyHero.skills[0].cooldown ?? 25;
    this.enemyHeroSkillCdMax = Math.max(8, baseCd - this.enemyHero.growthPerStage.skillCdr * offset);
    this.enemyHeroSkillCd = this.enemyHeroSkillCdMax;

    for (const id of config.miniBosses) {
      this.miniBossCd.set(id, MINI_BOSSES[id].spawnCooldown);
    }
    this.spawnStructures();
    if (this.deployMode) this.deployFormation();
  }

  /** 현재 생성 가능한 아군 유닛 (보유 유닛 카드) */
  get activeUnitCards(): UnitId[] {
    return this.cards.ownedUnits;
  }

  /** 성 외곽 keep-out 반경 (타워중심 기준) — 유닛이 이 안으로 들어오지 않음 (성 UI 겹침 방지) */
  private get towerKeepout(): number {
    return this.field.towerRadius + TOWER_KEEPOUT_MARGIN;
  }

  /** 배치형 모드 여부 — 진형(formation) 설정 시 연속 스폰 대신 일괄 배치 + 보충 */
  private get deployMode(): boolean {
    const f = this.config.formation;
    return !!f && Object.keys(f).length > 0;
  }

  /** 카드 선택권 소비. Lv5 MAX 도달 시 추가 선택권 (설계 07) */
  pickCard(cardId: string) {
    if (this.pendingPicks <= 0) return;
    this.pendingPicks--;
    const { maxed } = this.cards.pick(cardId);
    if (maxed) this.pendingPicks += CARD_BONUS.maxLevelExtraPick;
    this.refreshHeroStats();
  }

  /**
   * 아군 영웅 스킬 발동 (설계 03). 타깃 없으면 쿨타임 소모 없이 false.
   * - 마루한 투신: 60초간 전 스탯 % 버프
   * - 미르 살소나기: 적 밀집 지점 광역 150%
   * - 노을 피노을: 적 위치로 이동 + 광역 130% + 공격력 -20% 디버프
   */
  useHeroSkill(): boolean {
    if (this.heroSkillCd > 0 || this.hero.state === 'dead' || this.result !== 'ongoing') {
      return false;
    }
    const skill = this.heroDef.skill;
    // 스킬 강화: 계수 × (1 + 레벨당 2%) — heroes.ts skillBonusPct와 동일 규칙
    const ratio = skill.ratio * (1 + (this.heroSkillLevel - 1) * 0.02);

    if (this.heroDef.id === 'maruhan') {
      // 용맹: 자신 + 주변 아군 전체 스탯 버프 (피드백 7 — 광역 버프형)
      const duration = skill.duration ?? 60;
      const pct = ratio * 100;
      this.heroBuffPct = pct;
      this.heroSkillBuffLeft = duration;
      this.refreshHeroStats();
      this.applyValorBuff(pct, duration);
      this.spawnEffect(this.hero.x, this.hero.y, VALOR_RADIUS, 'rgba(255,210,90,0.9)'); // 용맹 = 황금 버프링
    } else {
      // 타깃 지점: 영웅 주변 가장 가까운 적 (없으면 발동 보류)
      const h = this.hero;
      let target: CombatEntity | null = null;
      let best = Infinity;
      for (const c of this.entities) {
        if (c.side !== 'enemy' || c.state === 'dead') continue;
        const d = Math.hypot(c.x - h.x, c.y - h.y);
        if (d < best && d <= HERO_AGGRO * 1.5) {
          best = d;
          target = c;
        }
      }
      if (!target) return false;

      const isNoeul = this.heroDef.id === 'noeul';
      if (isNoeul) {
        // 피노을: 지정 위치로 도약 — 출발→도착 경로 잔상 연출
        this.spawnLeapTrail(h.x, h.y, target.x, target.y);
        h.x = target.x;
        h.y = target.y;
      }
      const radius = isNoeul ? 4 : 6; // 살소나기는 더 넓은 화살비
      // 발동 위치 링: 노을=보라(도약/암살), 미르=하늘색(화살비)
      this.spawnEffect(target.x, target.y, radius, isNoeul ? 'rgba(200,90,230,0.95)' : 'rgba(150,210,255,0.95)');
      if (!isNoeul) this.spawnArrowRain(target.x, target.y, radius); // 살소나기 화살비
      const atk = h.atk * ratio;
      for (const c of this.entities) {
        if (c.side !== 'enemy' || c.state === 'dead') continue;
        if (Math.hypot(c.x - target.x, c.y - target.y) > radius) continue;
        this.hurt(c, damage(atk, c.def));
        if (isDead(c)) continue;
        if (isNoeul && !isStructure(c.kind)) c.atk *= 0.8; // 공격력 디버프
      }
    }

    this.heroSkillCd = skill.cooldown * (1 - this.cards.cdrPct / 100);
    return true;
  }

  /** 용맹: 아군 유닛 전군(영웅 제외 — 영웅은 heroBuffPct로 처리)에 스탯 % 버프 (피드백 — 반경 제한 없이 전체 적용) */
  private applyValorBuff(pct: number, duration: number) {
    for (const e of this.entities) {
      if (e.side !== 'ally' || e.kind === 'hero' || e.state === 'dead') continue;
      if (isStructure(e.kind)) continue;
      if (e.buffLeft > 0) this.removeValorBuff(e); // 재시전 — 기존 버프 갱신
      const f = 1 + pct / 100;
      const ratio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
      e.atk *= f;
      e.def *= f;
      e.maxHp *= f;
      e.hp = e.maxHp * ratio;
      e.atkSpeed *= f;
      e.moveSpeed *= f;
      e.range *= f;
      e.buffPct = pct;
      e.buffLeft = duration;
    }
  }

  /** 용맹 버프 해제 — 적용 % 만큼 되돌림 (HP 비율 유지) */
  private removeValorBuff(e: CombatEntity) {
    const f = 1 + e.buffPct / 100;
    const ratio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
    e.atk /= f;
    e.def /= f;
    e.maxHp /= f;
    e.hp = e.maxHp * ratio;
    e.atkSpeed /= f;
    e.moveSpeed /= f;
    e.range /= f;
    e.buffPct = 0;
    e.buffLeft = 0;
  }

  /**
   * 수호 오라 재계산 (방패병 Lv5): 매 틱, 아군이 받는 피해감소 = 반경 내 제공자 중 최대.
   * 제공자가 없으면 즉시 종료 (오버헤드 0).
   */
  private updateAuras() {
    const providers: CombatEntity[] = [];
    for (const e of this.entities) {
      if (e.auraShield > 0) e.auraShield = 0; // 이전 틱 값 초기화
      // 방패병 Lv5(아군 카드) + 치유사 내재 오라(아군·적 공통)
      if (e.state !== 'dead' && e.auraValue > 0) providers.push(e);
    }
    if (providers.length === 0) return;
    for (const e of this.entities) {
      if (e.state === 'dead' || isStructure(e.kind)) continue;
      for (const p of providers) {
        if (p.side !== e.side || p.auraValue <= e.auraShield) continue; // 같은 편만, 제공자 중 최대
        if (Math.hypot(e.x - p.x, e.y - p.y) <= SHIELD_AURA_RADIUS) e.auraShield = p.auraValue;
      }
    }
  }

  /** dt = 게임 시간 기준 경과 초 (배속 적용 후) */
  tick(dt: number) {
    if (this.result !== 'ongoing') return;
    this.time += dt;
    this.heroSkillCd = Math.max(0, this.heroSkillCd - dt);
    if (this.heroSkillBuffLeft > 0) {
      this.heroSkillBuffLeft -= dt;
      if (this.heroSkillBuffLeft <= 0) {
        this.heroSkillBuffLeft = 0;
        this.refreshHeroStats(); // 투신 종료 — 버프 해제
      }
    }
    // 시간 경과 EXP (초당 1): 처치 0이어도 레벨/카드가 돌게 하는 안전망
    this.timeExpAcc += dt;
    while (this.timeExpAcc >= 1) {
      this.timeExpAcc -= 1;
      this.gainExp(1);
    }
    if (this.deployMode) this.reinforceFormation(dt); // 배치형: 연속 스폰 X, 보충만
    else this.spawnEnemies(dt);
    this.spawnAllies(dt);
    this.updateMiniBosses(dt);
    this.updateBossAppearances();
    this.updateRevive(dt);
    this.updateEnemyHero(dt);
    this.updatePendingStrikes(dt);
    this.updateAuras();
    this.act(dt);
    this.applySeparation();
    this.clampOutsideTower();
    this.updateProjectiles(dt);
    this.updateTraps();
    this.removeDead();
    this.updateEffects(dt);
    this.updateTracers(dt);
  }

  /** 시각 이펙트 수명 갱신 (렌더 전용) */
  private updateEffects(dt: number) {
    if (this.towerFlash > 0) this.towerFlash -= dt;
    if (this.effects.length === 0) return;
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);
  }

  /** 원거리 즉시타격 트레이서 수명 갱신 (렌더 전용) */
  private updateTracers(dt: number) {
    if (this.tracers.length === 0) return;
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => t.life > 0);
  }

  /** 활/마법 즉시타격 시 발사 위치→타깃으로 짧은 시각 트레이서 (피드백 3) */
  private spawnTracer(attacker: CombatEntity, tx: number, ty: number) {
    const color = attacker.kind === 'archer' ? 'rgba(225,235,255,0.95)' : 'rgba(190,130,245,0.95)';
    this.tracers.push({
      id: this.nextId++,
      fromX: attacker.x,
      fromY: attacker.y,
      tx,
      ty,
      life: 0.13,
      maxLife: 0.13,
      color,
    });
  }

  /** 스킬/광역 발동 위치에 퍼지는 링 이펙트 추가 */
  private spawnEffect(x: number, y: number, maxRadius: number, color: string, life = 0.55) {
    this.effects.push({ id: this.nextId++, x, y, maxRadius, life, maxLife: life, color });
  }

  /** 피노을 도약 잔상: 출발→도착 경로에 작은 링 잔상 (도약 시각화) */
  private spawnLeapTrail(x1: number, y1: number, x2: number, y2: number) {
    const color = 'rgba(200,90,230,0.8)';
    this.spawnEffect(x1, y1, 4, color, 0.4); // 출발 지점 잔상
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1);
      this.spawnEffect(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 1.6, color, 0.18 + t * 0.2);
    }
  }

  /** 살소나기 화살비: 범위 내 흩뿌리는 작은 낙하 링 (화살비 시각화) */
  private spawnArrowRain(cx: number, cy: number, radius: number) {
    const color = 'rgba(150,210,255,0.9)';
    for (let i = 0; i < 8; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius; // 균일 분포
      this.spawnEffect(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 1.3, color, 0.3 + Math.random() * 0.3);
    }
  }

  /** 적 영웅 스킬 예약: 경고 텔레그래프 후 delay 경과 시 광역 피해 (위협 가독성) */
  private queueStrike(x: number, y: number, radius: number, dmg: number, delay: number, color: string) {
    // 경고 링: delay 동안 고정 반경으로 점점 진해지는 위험 표시
    this.effects.push({
      id: this.nextId++, x, y, maxRadius: radius, life: delay, maxLife: delay,
      color: 'rgba(255,70,50,0.85)', warning: true,
    });
    this.pendingStrikes.push({ delay, x, y, radius, dmg, color });
  }

  /** 예약된 적 영웅 스킬 타격 처리 — delay 경과 시 areaDamage + 타격 이펙트 */
  private updatePendingStrikes(dt: number) {
    if (this.pendingStrikes.length === 0) return;
    for (const s of this.pendingStrikes) s.delay -= dt;
    const ready = this.pendingStrikes.filter((s) => s.delay <= 0);
    this.pendingStrikes = this.pendingStrikes.filter((s) => s.delay > 0);
    for (const s of ready) {
      this.areaDamage(s.x, s.y, s.radius, s.dmg);
      this.spawnEffect(s.x, s.y, s.radius, s.color);
    }
  }

  // ── 생성 ──────────────────────────────────────────────

  private makeHero(): CombatEntity {
    const s = this.heroDef.stats;
    return {
      id: this.nextId++,
      side: 'ally',
      kind: 'hero',
      x: this.field.heroX,
      y: this.field.heroY,
      hp: s.hp,
      maxHp: s.hp,
      atk: s.atk,
      def: s.def,
      range: s.range,
      atkSpeed: s.atkSpeed,
      moveSpeed: s.moveSpeed,
      aoe: s.aoe,
      priority: 'nearest',
      evade: 0,
      killExp: 0,
      critChance: 0,
      lifestealPct: 0,
      regenPctPerSec: HERO_BASE_REGEN_PCT,
      frenzyAtkPct: 0,
      stunLeft: 0,
      // 원거리 영웅(미르 등 사거리≥6)은 호밍 화살 발사 — 시각 이펙트 + 항상 명중
      projectileSpeed: s.range >= 6 ? HERO_PROJECTILE_SPEED : 0,
      attackCd: 0,
      retargetCd: 0,
      targetId: NO_TARGET,
      state: 'moving',
      ...zeroProcFields(),
    };
  }

  private makeUnit(side: Side, unitId: UnitId, x: number, y: number): CombatEntity {
    const def = unitDef(unitId);
    const metaBonus = side === 'ally' ? (this.unitMetaBonus.get(unitId) ?? 0) : 0;
    const mult = (side === 'enemy' ? this.config.statMultiplier : 1) * (1 + metaBonus);
    const m = side === 'ally' ? this.cards.unitMods(unitId) : null;
    const f = (pct: number | undefined) => 1 + (pct ?? 0) / 100;
    return {
      id: this.nextId++,
      side,
      kind: unitId,
      x,
      y,
      hp: def.stats.hp * mult * f(m?.hpPct),
      maxHp: def.stats.hp * mult * f(m?.hpPct),
      atk: def.stats.atk * mult * f(m?.atkPct),
      def: def.stats.def * mult * f(m?.defPct),
      range: def.stats.range * f(m?.rangePct),
      atkSpeed: def.stats.atkSpeed * f(m?.atkSpeedPct),
      moveSpeed: def.stats.moveSpeed * f(m?.moveSpeedPct),
      aoe: def.stats.aoe * f(m?.aoePct) + (m?.bonusAoe ?? 0), // bonusAoe: 공격력 카드 Lv5 광역공격
      priority: def.priority,
      evade: (unitId === 'assassin' ? 0.3 : 0) + (m?.evadePct ?? 0) / 100,
      killExp: def.exp,
      critChance: (m?.critChance ?? 0) / 100,
      lifestealPct: (m?.lifestealPct ?? 0) / 100,
      // 내재 체젠(근접병) + 카드 보정 합산
      regenPctPerSec: (def.regenPctPerSec ?? 0) + (m?.regenPctPerSec ?? 0),
      frenzyAtkPct: m?.frenzyAtkPct ?? 0,
      stunLeft: 0,
      projectileSpeed: def.projectileSpeed ?? 0,
      // 투석기: 배치 직후 준비시간 후 첫 발사 (피드백 8)
      attackCd: unitId === 'catapult' ? CATAPULT_WIND_UP + Math.random() : Math.random() * 0.5,
      retargetCd: Math.random() * 0.2,
      targetId: NO_TARGET,
      state: 'moving',
      ...zeroProcFields(),
      // 프록 카드 보정 (아군 전용)
      dmgReduction: (m?.dmgReductionPct ?? 0) / 100,
      taunt: (m?.tauntChance ?? 0) / 100,
      pierce: (m?.pierceChance ?? 0) / 100,
      bonusChance: (m?.bonusChance ?? 0) / 100,
      bonusDmgPct: m?.bonusDmgPct ?? 0,
      bleedChance: (m?.bleedChance ?? 0) / 100,
      bleedDotPct: m?.bleedDotPct ?? 0,
      chargeDmgPct: m?.chargeDmgPct ?? 0,
      burnChance: (m?.burnChance ?? 0) / 100,
      burnPct: m?.burnPct ?? 0,
      stunOnHit: m?.stunSec ?? 0,
      undyingCdMax: m?.undyingCooldownSec ?? 0,
      // 치유사: 내재 수호 오라(받는 피해 감소) — 아군·적 공통, 카드 보정과 합산
      auraValue: (unitId === 'healer' ? HEALER_AURA_DR : 0) + (m?.auraDmgReductionPct ?? 0) / 100,
      multishot: m?.multishot ?? 0,
      doubleStrikeChance: (m?.doubleStrikeChance ?? 0) / 100,
      healBonus: (m?.healBonusPct ?? 0) / 100,
      executeChance: (m?.executeChance ?? 0) / 100,
      // 카드 MAX 트리거 효과 (아군 전용 — 카드는 아군에게만 적용)
      reflect: (m?.reflectPct ?? 0) / 100,
      thorns: (m?.thornsPct ?? 0) / 100,
      thornsCd: 0,
      counter: (m?.counterPct ?? 0) / 100,
      coinBlast: (m?.coinBlastPct ?? 0) / 100,
      goldExecute: (m?.goldExecuteChance ?? 0) / 100,
      noHeal: !!def.mechanical,
      // 직업 역할 특성 오버라이드 (zeroProcFields 기본값 1/0 위에 덮어씀)
      rangedDmgReduction:
        unitId === 'shield' ? 0.4 :
        unitId === 'swordsman' ? 0.3 : 0,
      siegeDmgMult:
        unitId === 'mageLow' || unitId === 'mageMid' || unitId === 'mageHigh' ? 0.4 :
        unitId === 'assassin' ? 0.3 : 1,
      vsUnitMult:
        unitId === 'assassin' ? 1.6 :
        unitId === 'mageLow' || unitId === 'mageMid' || unitId === 'mageHigh' ? 1.3 : 1,
      vsRangedUnitMult: unitId === 'cavalry' ? 1.5 : 1,
      evadeVsRanged: unitId === 'assassin' ? 0.3 : 0,
    };
  }

  // ── 구조물 / 미니보스 / 보스 (설계 09, 11) ───────────────

  private makeStructure(kind: StructureKind, x: number, y: number): CombatEntity {
    const spec = STRUCTURE_SPECS[kind];
    const hp = spec.hp * structureHpScale(this.config.stage);
    return {
      id: this.nextId++,
      side: 'enemy',
      kind,
      x,
      y,
      hp,
      maxHp: hp,
      atk: 0,
      def: spec.def,
      range: 0,
      atkSpeed: 0,
      moveSpeed: 0,
      aoe: 1,
      priority: 'nearest',
      evade: 0,
      killExp: spec.exp,
      critChance: 0,
      lifestealPct: 0,
      regenPctPerSec: 0,
      frenzyAtkPct: 0,
      stunLeft: 0,
      projectileSpeed: 0,
      attackCd: 0,
      retargetCd: 0,
      targetId: NO_TARGET,
      state: 'moving',
      ...zeroProcFields(),
    };
  }

  private spawnStructures() {
    const { walls, barricades, traps } = structureCounts(this.config.stage);
    const { towerX, towerY, towerRadius, width } = this.field;

    // 성벽: 타워 주변 균등 배치 — 남쪽(아군 진입 방향)부터
    for (let i = 0; i < walls; i++) {
      const angle = Math.PI / 2 + (i * 2 * Math.PI) / walls;
      const r = towerRadius + 5;
      this.addEntity(
        this.makeStructure('wall', towerX + Math.cos(angle) * r, towerY + Math.sin(angle) * r),
      );
    }

    // 바리케이트: 타워 주변 360° 환형 스캐터 — 하단 몰림 해소, 사방 동선 변화 (피드백)
    const baMinR = towerRadius + 14;
    const baMaxR = Math.min(width, this.field.height) * 0.42;
    for (let i = 0; i < barricades; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = baMinR + Math.random() * Math.max(8, baMaxR - baMinR);
      const x = Math.max(8, Math.min(width - 8, towerX + Math.cos(angle) * r));
      const y = Math.max(8, Math.min(this.field.height - 8, towerY + Math.sin(angle) * r));
      this.addEntity(this.makeStructure('barricade', x, y));
    }

    // 트랩: 타워 반경 내 랜덤 링
    for (let i = 0; i < traps; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = towerRadius + 6 + Math.random() * 12;
      this.addEntity(
        this.makeStructure('trap', towerX + Math.cos(angle) * r, towerY + Math.sin(angle) * r),
      );
    }
  }

  private makeMiniBoss(id: MiniBossId): CombatEntity {
    const mb = MINI_BOSSES[id];
    const base = ENEMY_HEROES.find((h) => h.id === mb.baseHero)!.stats;
    // 다운그레이드 영웅 — 본 보스보다 약함 (설계 10)
    const mult = this.config.statMultiplier * 0.6;
    const { towerX, towerY } = this.field;
    const angle = Math.random() * Math.PI * 2;
    const r = this.towerKeepout + 1; // 성 외곽 — keep-out 링 밖에서 등장
    return {
      id: this.nextId++,
      side: 'enemy',
      kind: id,
      x: towerX + Math.cos(angle) * r,
      y: towerY + Math.sin(angle) * r,
      hp: base.hp * mult,
      maxHp: base.hp * mult,
      atk: base.atk * mult,
      def: base.def * 0.6,
      range: base.range,
      atkSpeed: base.atkSpeed,
      moveSpeed: 4,
      aoe: base.aoe,
      priority: 'nearest',
      evade: 0,
      killExp: mb.exp,
      critChance: 0,
      lifestealPct: 0,
      regenPctPerSec: 0,
      frenzyAtkPct: 0,
      stunLeft: 0,
      projectileSpeed: 0,
      attackCd: 0,
      retargetCd: 0,
      targetId: NO_TARGET,
      state: 'moving',
      ...zeroProcFields(),
    };
  }

  private updateMiniBosses(dt: number) {
    for (const [id, cd] of this.miniBossCd) {
      const left = cd - dt;
      if (left > 0) {
        this.miniBossCd.set(id, left);
        continue;
      }
      this.miniBossCd.set(id, MINI_BOSSES[id].spawnCooldown);
      this.addEntity(this.makeMiniBoss(id));
    }
  }

  /** 30스테이지: 팔라딘이 타워에서 나와 직접 등장 (설계 09) */
  private updateBossAppearances() {
    const times = this.config.bossAppearances;
    if (!times || this.bossAppearIdx >= times.length) return;
    if (this.time < times[this.bossAppearIdx]) return;
    this.bossAppearIdx++;

    const def = ENEMY_HEROES.find((h) => h.id === 'paladin')!;
    const offset = Math.max(0, this.config.stage - def.stageRange[0]);
    const hp = def.stats.hp + def.growthPerStage.hp * offset;
    this.addEntity({
      id: this.nextId++,
      side: 'enemy',
      kind: 'paladinBoss',
      x: this.field.towerX,
      y: this.field.towerY + this.towerKeepout + 2, // 타워 정면 (성 외곽)
      hp,
      maxHp: hp,
      atk: def.stats.atk + def.growthPerStage.atk * offset,
      def: def.stats.def,
      range: def.stats.range,
      atkSpeed: def.stats.atkSpeed,
      moveSpeed: 4,
      aoe: def.stats.aoe,
      priority: 'nearest',
      evade: 0,
      killExp: PALADIN_BOSS_EXP,
      critChance: 0,
      lifestealPct: 0,
      regenPctPerSec: 0,
      frenzyAtkPct: 0,
      stunLeft: 0,
      projectileSpeed: 0,
      attackCd: 0,
      retargetCd: 0,
      targetId: NO_TARGET,
      state: 'moving',
      ...zeroProcFields(),
    });
  }

  private addEntity(e: CombatEntity) {
    this.entities.push(e);
    this.byId.set(e.id, e);
  }

  private spawnEnemies(dt: number) {
    const warmup = Math.min(
      1,
      ENEMY_SPAWN_WARMUP_START + (1 - ENEMY_SPAWN_WARMUP_START) * (this.time / ENEMY_SPAWN_WARMUP_SECONDS),
    );
    this.spawnAcc += this.config.spawnRate * warmup * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      // 1/n 캡 + 결손 우선 — 화면에 없는/적은 종류부터 채움 (피드백)
      const eUnit = this.pickSpawnUnit('enemy', this.enemyTypes);
      if (!eUnit) continue; // 모든 종류가 캡 도달 — 이번 스폰 스킵
      const { towerX, towerY, width, height } = this.field;
      const angle = Math.random() * Math.PI * 2;
      // 성 외곽 — keep-out 링 바깥에서 생성 (성벽 UI 위에 솟아나지 않게, 피드백)
      const r = this.towerKeepout + 1 + Math.random() * 3;
      const x = Math.min(width - 3, Math.max(3, towerX + Math.cos(angle) * r));
      const y = Math.min(height - 3, Math.max(3, towerY + Math.sin(angle) * r));
      this.addEntity(this.makeUnit('enemy', eUnit, x, y));
    }
  }

  /** 배치형: 시작 시 수비 진형을 타워 주변 동심 링에 일괄 배치 (방어 진형) */
  private deployFormation() {
    const f = this.config.formation;
    if (!f) return;
    const list: UnitId[] = [];
    for (const [u, n] of Object.entries(f)) {
      for (let i = 0; i < (n ?? 0); i++) list.push(u as UnitId);
    }
    const { towerX, towerY, width, height } = this.field;
    const baseR = this.towerKeepout + 4;
    let idx = 0;
    let ring = 0;
    while (idx < list.length && ring < 24) {
      const r = baseR + ring * 7;
      const cap = Math.max(6, Math.floor((2 * Math.PI * r) / 6)); // 둘레/간격(~6)
      const cnt = Math.min(cap, list.length - idx);
      for (let k = 0; k < cnt; k++) {
        const ang = (k / cnt) * Math.PI * 2 + ring * 0.5;
        const x = Math.min(width - 3, Math.max(3, towerX + Math.cos(ang) * r));
        const y = Math.min(height - 3, Math.max(3, towerY + Math.sin(ang) * r));
        this.addEntity(this.makeUnit('enemy', list[idx++], x, y));
      }
      ring++;
    }
  }

  /** 배치형 보충: 진형 손실분을 reinforcePctPerMin 속도로 캡(진형 마릿수)까지 외곽에서 충원 */
  private reinforceFormation(dt: number) {
    const f = this.config.formation;
    const pct = this.config.reinforcePctPerMin ?? 0;
    if (!f || pct <= 0) return;
    let totalTarget = 0;
    for (const n of Object.values(f)) totalTarget += n ?? 0;
    this.reinforceAcc += ((totalTarget * pct) / 100 / 60) * dt;
    while (this.reinforceAcc >= 1) {
      // 결손(목표−현재)이 큰 종류부터 보충
      let bestU: UnitId | null = null;
      let bestDeficit = 0;
      for (const [u, target] of Object.entries(f)) {
        const deficit = (target ?? 0) - this.countType('enemy', u as UnitId);
        if (deficit > bestDeficit) {
          bestDeficit = deficit;
          bestU = u as UnitId;
        }
      }
      if (!bestU) {
        this.reinforceAcc = Math.min(this.reinforceAcc, 2); // 진형 가득 — 누적 버스트 방지
        break;
      }
      this.reinforceAcc -= 1;
      const { towerX, towerY, width, height } = this.field;
      const ang = Math.random() * Math.PI * 2;
      const r = this.towerKeepout + 2 + Math.random() * 6;
      const x = Math.min(width - 3, Math.max(3, towerX + Math.cos(ang) * r));
      const y = Math.min(height - 3, Math.max(3, towerY + Math.sin(ang) * r));
      this.addEntity(this.makeUnit('enemy', bestU, x, y));
    }
  }

  /** 한 측 특정 종류의 생존 수 (배치형 보충 결손 판정용) */
  private countType(side: Side, unitId: UnitId): number {
    let n = 0;
    for (const e of this.entities) {
      if (e.side === side && e.kind === unitId && e.state !== 'dead') n++;
    }
    return n;
  }

  private spawnAllies(dt: number) {
    const unitCards = this.activeUnitCards;
    if (unitCards.length === 0) return;
    const spawnBoost = 1 + this.cards.spawnSpeedPct / 100;
    const rate = ALLY_SPAWN_BASE + ALLY_SPAWN_RATE_PER_CARD * unitCards.length;
    this.allySpawnAcc += rate * spawnBoost * dt;
    while (this.allySpawnAcc >= 1) {
      this.allySpawnAcc -= 1;
      // 1/n 캡 + 결손 우선 — 검50·방패50·활50·투석10 식 + 빈자리(없는 종류)부터 채움 (피드백)
      const unitId = this.pickSpawnUnit('ally', unitCards);
      if (!unitId) continue; // 모든 종류가 캡 도달 — 이번 스폰 스킵
      // 성 포위: 타워 기준 360° 골든 앵글로 화면 가장자리에서 생성 → 사방에서 공성 (피드백 5)
      this.allySpawnAngle = (this.allySpawnAngle + 2.39996323) % (Math.PI * 2);
      const { x, y } = this.edgePointFromTower(this.allySpawnAngle);
      this.addEntity(this.makeUnit('ally', unitId, x, y));
    }
  }

  /**
   * 1/n 인구수 캡 + 결손 우선 스폰 선택 (피드백):
   * - 각 유닛 종류는 (SUPPLY_CAP / 종류수)만큼만 운용 (고코스트가 저코스트에 밀려 안 나오는 문제 해결).
   *   예) 검·방패·활·투석 4종이면 각 50 인구수 → 검50·방패50·활50·투석10기.
   * - 캡 미달 종류 중 **결손(캡 대비 부족분)이 큰 종류를 우선** 뽑는다 → 화면에 없는/적은 유닛부터
   *   채워져 항상 다양하게 유지(전멸한 종류는 즉시 우선 보충). 딱 목표치 고정 X.
   * - 영웅·구조물·보스(미니영웅/적영웅)는 인구수에서 제외 (supplyByType).
   */
  private pickSpawnUnit(side: Side, types: UnitId[]): UnitId | null {
    if (types.length === 0) return null;
    const perTypeCap = SUPPLY_CAP / types.length;
    const supply = this.supplyByType(side);
    let total = 0;
    const cands: { u: UnitId; w: number }[] = [];
    for (const u of types) {
      const used = supply.get(u) ?? 0;
      if (used + supplyCost(u) > perTypeCap) continue; // 이 종류 캡 도달
      const w = Math.max(0.001, perTypeCap - used); // 결손이 클수록(없을수록) 우선
      cands.push({ u, w });
      total += w;
    }
    if (cands.length === 0) return null;
    let roll = Math.random() * total;
    for (const c of cands) {
      roll -= c.w;
      if (roll <= 0) return c.u;
    }
    return cands[cands.length - 1].u;
  }

  private countSide(side: Side): number {
    let n = 0;
    for (const e of this.entities) {
      if (e.side === side && e.state !== 'dead' && !isStructure(e.kind)) n++;
    }
    return n;
  }

  /**
   * 한 측의 유닛 종류별 현재 소모 인구수 합 (kind → supply). 1/n 캡 판정용.
   * 영웅·구조물·보스(미니영웅/적영웅)는 제외 — 인구수에 포함하지 않음 (피드백).
   */
  private supplyByType(side: Side): Map<UnitId, number> {
    const m = new Map<UnitId, number>();
    for (const e of this.entities) {
      if (e.side !== side || e.state === 'dead') continue;
      if (e.kind === 'hero' || isStructure(e.kind) || BOSS_KINDS.has(e.kind)) continue;
      const k = e.kind as UnitId;
      m.set(k, (m.get(k) ?? 0) + supplyCost(k));
    }
    return m;
  }

  /** 적 배회: 타워 주변 [MIN,MAX] 반경의 임의 지점을 순찰, 도달하면 새 지점 (피드백 4) */
  private roamAroundTower(e: CombatEntity, dt: number) {
    const { towerX, towerY, width, height } = this.field;
    const reached =
      e.roamX === undefined || Math.hypot(e.x - e.roamX, e.y - (e.roamY ?? e.y)) < 3;
    if (reached) {
      const ang = Math.random() * Math.PI * 2;
      const dist = ENEMY_ROAM_MIN + Math.random() * (ENEMY_ROAM_MAX - ENEMY_ROAM_MIN);
      e.roamX = Math.min(width - 3, Math.max(3, towerX + Math.cos(ang) * dist));
      e.roamY = Math.min(height - 3, Math.max(3, towerY + Math.sin(ang) * dist));
    }
    this.moveToward(e, e.roamX!, e.roamY!, 0, dt);
  }

  /** 타워 기준 angle 방향으로 화면(필드) 가장자리 지점 — 아군 포위 생성용 (피드백 5) */
  private edgePointFromTower(angle: number): { x: number; y: number } {
    const { towerX, towerY, width, height } = this.field;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const m = 3;
    let t = Infinity;
    if (cos > 1e-6) t = Math.min(t, (width - m - towerX) / cos);
    else if (cos < -1e-6) t = Math.min(t, (m - towerX) / cos);
    if (sin > 1e-6) t = Math.min(t, (height - m - towerY) / sin);
    else if (sin < -1e-6) t = Math.min(t, (m - towerY) / sin);
    if (!isFinite(t)) t = 0;
    return { x: towerX + cos * t, y: towerY + sin * t };
  }

  /**
   * 성 UI 침범 방지: 유닛 중심이 keep-out 반경 안에 들어오면 바깥 링으로 밀어낸다.
   * 아군·적·영웅 공통, 구조물(성벽 등 의도적 배치)·사망 엔티티는 제외. 스폰/분산/이동 후 마지막 보정.
   */
  private clampOutsideTower() {
    const { towerX, towerY } = this.field;
    const ko = this.towerKeepout;
    for (const e of this.entities) {
      if (e.state === 'dead' || isStructure(e.kind)) continue;
      const dx = e.x - towerX;
      const dy = e.y - towerY;
      const d = Math.hypot(dx, dy);
      if (d >= ko) continue;
      if (d > 1e-6) {
        e.x = towerX + (dx / d) * ko;
        e.y = towerY + (dy / d) * ko;
      } else {
        e.x = towerX + ko; // 정확히 중심: 임의 방향으로 밀어냄
        e.y = towerY;
      }
    }
  }

  // ── 영웅 부활 ─────────────────────────────────────────

  private updateRevive(dt: number) {
    if (this.hero.state !== 'dead') return;
    this.reviveLeft = Math.max(0, this.reviveLeft - dt);
    if (this.reviveLeft <= 0) {
      this.hero.hp = this.hero.maxHp;
      this.hero.x = this.field.heroX;
      this.hero.y = this.field.heroY;
      this.hero.state = 'moving';
      this.hero.targetId = NO_TARGET;
    }
  }

  // ── 행동 (타깃 → 이동 → 공격) ─────────────────────────

  private act(dt: number) {
    // 랠리 판정: 아군 유닛 수 (영웅 제외)
    this.allyWaveReady = this.countSide('ally') - (this.hero.state !== 'dead' ? 1 : 0) >= ALLY_RALLY_SIZE;
    for (const e of this.entities) {
      if (e.state === 'dead') continue;
      e.age += dt; // 생성 후 경과 — 분산 grace 판정용
      if (e.hitFlash > 0) e.hitFlash -= dt; // 피격 플래시 감쇠 (구조물 포함)
      if (isStructure(e.kind)) continue; // 구조물은 행동 없음 (트랩은 updateTraps)

      // 용맹 버프 만료 — 적용분 되돌림 (기절 중에도 진행)
      if (e.buffLeft > 0) {
        e.buffLeft -= dt;
        if (e.buffLeft <= 0) this.removeValorBuff(e);
      }
      // 상태이상 틱: 출혈/화상 DoT + 불굴 쿨다운 (기절 중에도 진행)
      if (e.undyingCd > 0) e.undyingCd -= dt;
      if (e.thornsCd > 0) e.thornsCd -= dt; // 가시 발동 쿨다운
      if (e.bleedLeft > 0) {
        e.bleedLeft -= dt;
        this.hurt(e, e.bleedRate * dt);
        if (isDead(e)) continue;
      }
      if (e.burnLeft > 0) {
        e.burnLeft -= dt;
        this.hurt(e, e.burnRate * dt);
        if (isDead(e)) continue;
      }

      if (e.stunLeft > 0) {
        e.stunLeft -= dt;
        continue;
      }
      e.attackCd = Math.max(0, e.attackCd - dt);
      e.retargetCd -= dt;
      if (e.regenPctPerSec > 0 && e.hp < e.maxHp && !e.noHeal) {
        e.hp = Math.min(e.maxHp, e.hp + (e.maxHp * e.regenPctPerSec * dt) / 100);
      }

      if (e.priority === 'healAlly') {
        this.actHealer(e, dt);
        continue;
      }
      if (e.kind === 'bomber') {
        this.actBomber(e, dt);
        continue;
      }

      if (e.retargetCd <= 0 || !this.isTargetValid(e)) {
        this.acquireTarget(e);
        e.retargetCd = 0.15 + Math.random() * 0.15;
      }

      if (e.targetId === TOWER_TARGET) {
        this.moveAttackTower(e, dt);
      } else if (e.targetId !== NO_TARGET) {
        const target = this.byId.get(e.targetId);
        if (target) this.moveAttackEntity(e, target, dt);
      } else {
        e.state = 'moving';
        if (e.side === 'enemy') {
          // 방어 태세 배회: 추격 대상 없으면 타워 주변을 순찰 (성에만 붙지 않게 — 피드백 4)
          this.roamAroundTower(e, dt);
        }
      }
    }
  }

  private isTargetValid(e: CombatEntity): boolean {
    if (e.targetId === TOWER_TARGET) return true;
    if (e.targetId === NO_TARGET) return false;
    const t = this.byId.get(e.targetId);
    return !!t && t.state !== 'dead';
  }

  /** 우선타깃 시스템 (설계 14) */
  private acquireTarget(e: CombatEntity) {
    if (e.side === 'ally' && e.kind !== 'hero') {
      this.acquireAllyTarget(e);
      return;
    }

    const aggro =
      e.kind === 'hero' ? Math.max(e.range + AGGRO_BONUS, HERO_AGGRO) : e.range + AGGRO_BONUS;
    let best: CombatEntity | null = null;
    let bestScore = Infinity;

    for (const c of this.entities) {
      if (c.side === e.side || c.state === 'dead') continue;
      const dist = Math.hypot(c.x - e.x, c.y - e.y);
      if (dist > aggro) continue;

      let score = dist;
      if (e.priority === 'tank') score -= c.def * 0.5; // 방어력 높은 탱커 우선
      if (e.priority === 'ranged' && c.range >= RANGED_THRESHOLD) score -= 30; // 원거리 우선
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }

    if (best) {
      e.targetId = best.id;
    } else if (e.kind === 'hero') {
      // 폰 피드백: 영웅도 성을 향해 공성 — 탐지(35) 내 적 없으면 진입로 성벽→타워로 진군.
      // 체력/방어 3배 + 체젠으로 단독 전진 생존성 확보 (기존 폭사 우려 해소)
      const blocking = this.blockingWall(e);
      e.targetId = blocking ? blocking.id : TOWER_TARGET;
    } else {
      // 적측 방어 태세 (설계 10): 타워 방어 반경 내 아군만 추격 — 맵 횡단 추격 금지
      const { towerX, towerY } = this.field;
      let nearest: CombatEntity | null = null;
      let nearestDist = Infinity;
      for (const c of this.entities) {
        if (c.side === 'enemy' || c.state === 'dead') continue;
        if (Math.hypot(c.x - towerX, c.y - towerY) > ENEMY_DEFEND_RADIUS) continue;
        const dist = Math.hypot(c.x - e.x, c.y - e.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = c;
        }
      }
      e.targetId = nearest ? nearest.id : NO_TARGET;
    }
  }

  /**
   * 아군 유닛 = 공성군 (시뮬 검증으로 확정한 룰):
   * 1) 자기 사거리 안의 적 유닛과 교전 (우선타깃 점수 적용)
   * 2) 사거리 안의 구조물 포격
   * 3) 아니면 성벽 → 타워로 진군 — 먼 적 추격 금지 (피격 시 retaliate로 응전)
   * 추격을 없애야 전선이 타워까지 전진함 (스폰 스트림에 발이 묶이는 교착 방지)
   */
  private acquireAllyTarget(e: CombatEntity) {
    const reach = Math.max(e.range, 1) + BODY_RADIUS;

    // 공성 우선: 타워가 사거리(+근접) 내면 누구든 우선 포격 — 포위하고도 타워 못 치는 문제 해결 (피드백).
    // 적 유닛 우선 → 타워 우선으로 전환: 사거리 안에 성이 들어오면 성을 친다(적 반격은 retaliate로 응전).
    // keep-out 링을 반영한 공성 사거리. 단, 내 진입로를 막는 성벽이 있으면 성벽부터 (벽 우회 방지)
    const towerStop = Math.max(this.field.towerRadius + Math.max(e.range, 1), this.towerKeepout);
    const tCenterDist = Math.hypot(this.field.towerX - e.x, this.field.towerY - e.y);
    if (tCenterDist <= towerStop + BODY_RADIUS && !this.blockingWall(e)) {
      e.targetId = TOWER_TARGET;
      return;
    }

    // 1) 사거리 내 적 유닛
    let best: CombatEntity | null = null;
    let bestScore = Infinity;
    for (const c of this.entities) {
      if (c.side === 'ally' || c.state === 'dead' || isStructure(c.kind)) continue;
      const dist = Math.hypot(c.x - e.x, c.y - e.y);
      if (dist > reach) continue;
      if (e.kind === 'catapult' && dist < CATAPULT_MIN_RANGE) continue; // 최소 사거리 — 먼 적만 타격
      let score = dist;
      if (e.priority === 'tank') score -= c.def * 0.5;
      if (e.priority === 'ranged' && c.range >= RANGED_THRESHOLD) score -= 30;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best) {
      e.targetId = best.id;
      return;
    }

    // 2) 사거리 내 구조물 (성벽/바리케이트/트랩 — 지나는 길에 파괴)
    let structure: CombatEntity | null = null;
    let structDist = Infinity;
    for (const c of this.entities) {
      if (c.state === 'dead' || !isStructure(c.kind)) continue;
      const dist = Math.hypot(c.x - e.x, c.y - e.y);
      if (dist <= reach && dist < structDist) {
        structDist = dist;
        structure = c;
      }
    }
    if (structure) {
      e.targetId = structure.id;
      return;
    }

    // 3) 진군 — 단, 웨이브 규모가 모일 때까지 거점 대기 (랠리)
    if (!this.allyWaveReady) {
      e.targetId = NO_TARGET;
      return;
    }
    // 내 진입 방위를 막는 성벽이 있으면 그 성벽부터, 아니면 타워 (섹터 차단 — 설계 11)
    const blocking = this.blockingWall(e);
    e.targetId = blocking ? blocking.id : TOWER_TARGET;
  }

  /**
   * 성벽은 자기 방위(섹터)만 차단: 공격자의 타워 기준 방위각과 가장 가까운
   * 생존 성벽이 섹터 반각(π/배치수) 안에 있으면 그 성벽이 길을 막음.
   * 남쪽 성벽을 부수면 남쪽 진입로가 열림 — 모든 성벽 파괴 강제 X
   */
  private blockingWall(e: CombatEntity): CombatEntity | null {
    const { towerX, towerY } = this.field;
    const wallTotal = structureCounts(this.config.stage).walls;
    if (wallTotal <= 0) return null;
    const halfSector = Math.PI / wallTotal;
    const angE = Math.atan2(e.y - towerY, e.x - towerX);
    let best: CombatEntity | null = null;
    let bestDelta = Infinity;
    for (const c of this.entities) {
      if (c.kind !== 'wall' || c.state === 'dead') continue;
      const angW = Math.atan2(c.y - towerY, c.x - towerX);
      let delta = Math.abs(angE - angW);
      if (delta > Math.PI) delta = Math.PI * 2 - delta;
      if (delta < bestDelta) {
        bestDelta = delta;
        best = c;
      }
    }
    return best && bestDelta <= halfSector ? best : null;
  }

  private moveToward(e: CombatEntity, tx: number, ty: number, stopDist: number, dt: number) {
    const dx = tx - e.x;
    const dy = ty - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= stopDist) return true;
    const step = Math.min(e.moveSpeed * dt, dist - stopDist);
    e.x += (dx / dist) * step;
    e.y += (dy / dist) * step;
    return false;
  }

  private moveAttackEntity(e: CombatEntity, target: CombatEntity, dt: number) {
    const stopDist = Math.max(e.range, 1) + BODY_RADIUS;
    // 돌진: 교전 접근 이동 가속 (창병)
    const moveDt = e.chargeDmgPct > 0 ? dt * CHARGE_MOVE_MULT : dt;
    const wasMoving = e.state === 'moving';
    const inRange = this.moveToward(e, target.x, target.y, stopDist, moveDt);
    e.state = inRange ? 'attacking' : 'moving';
    if (inRange && e.attackCd <= 0 && e.atkSpeed > 0) {
      // 돌진 추가피해: 이동 끝에 진입한 첫 타에 적용
      if (wasMoving && e.chargeDmgPct > 0) e.chargeReady = true;
      e.attackCd = 1 / e.atkSpeed;
      this.performAttack(e, target);
      // 이중공격 (공속 카드 Lv5 MAX): 확률로 즉시 한 번 더
      if (e.doubleStrikeChance > 0 && Math.random() < e.doubleStrikeChance) this.performAttack(e, target);
    }
  }

  private moveAttackTower(e: CombatEntity, dt: number) {
    const { towerX, towerY, towerRadius } = this.field;
    // 근접 유닛은 성 외곽 keep-out 링에서 공성 — 성벽 UI 위로 올라가지 않게 (피드백)
    const stopDist = Math.max(towerRadius + Math.max(e.range, 1), this.towerKeepout);
    const inRange = this.moveToward(e, towerX, towerY, stopDist, dt);
    e.state = inRange ? 'attacking' : 'moving';
    if (inRange && e.attackCd <= 0 && e.atkSpeed > 0) {
      e.attackCd = 1 / e.atkSpeed;
      this.siegeTower(e);
      // 이중공격 (공속 카드 Lv5 MAX)
      if (e.doubleStrikeChance > 0 && Math.random() < e.doubleStrikeChance) this.siegeTower(e);
    }
  }

  /** 타워 1회 공성 — 역할 배수 + 섬멸(적 30↓) 보너스. 투사체/히트스캔 분기 */
  private siegeTower(e: CombatEntity) {
    const { towerX, towerY, towerRadius } = this.field;
    const siegeAtk =
      e.atk * e.siegeDmgMult * (this.enemyAlive <= SIEGE_CLEANUP_THRESHOLD ? SIEGE_CLEANUP_MULT : 1);
    if (e.projectileSpeed > 0) {
      // 타워 가장자리 조준 — 정지 목표라 항상 명중
      const dx = e.x - towerX;
      const dy = e.y - towerY;
      const d = Math.hypot(dx, dy) || 1;
      this.launchProjectile(
        e,
        towerX + (dx / d) * towerRadius * 0.7,
        towerY + (dy / d) * towerRadius * 0.7,
        true,
        siegeAtk,
        undefined,
        e.kind === 'hero', // 영웅이면 타워 포격도 시안 화살 비주얼
      );
    } else {
      this.damageTower(siegeAtk);
    }
  }

  private damageTower(atk: number) {
    if (this.invulnLeft > 0) return; // 팔라딘 무적기
    this.towerHp = Math.max(0, this.towerHp - damage(atk, this.config.tower.def));
    this.towerFlash = TOWER_FLASH; // 타워 피격 플래시
    // 팔라딘: 타워 HP 50% 이하 시 무적 5초 1회 자동 발동 (설계 09)
    if (
      this.enemyHero.id === 'paladin' &&
      !this.invulnUsed &&
      this.towerHp > 0 &&
      this.towerHp <= this.config.tower.hp * 0.5
    ) {
      this.invulnUsed = true;
      this.invulnLeft = 5;
    }
    if (this.towerHp <= 0) this.result = 'victory';
  }

  /** 단일/광역 공격 수행. 회피 판정 포함 */
  private performAttack(attacker: CombatEntity, target: CombatEntity) {
    if (attacker.projectileSpeed > 0) {
      if (attacker.kind === 'hero') {
        // 영웅 화살: 호밍(항상 명중) + 전용 비주얼
        this.launchProjectile(attacker, target.x, target.y, false, undefined, target.id, true);
      } else {
        // 지면 조준 투사체(투석기): 발사 시점 타깃 위치로 비행 — 이동하면 빗나감
        this.launchProjectile(attacker, target.x, target.y, false);
      }
      return;
    }
    // 활/마법은 즉시타격이지만 발사 시각 트레이서를 남긴다 (피드백 3)
    const k = attacker.kind;
    if (k === 'archer' || k === 'mageLow' || k === 'mageMid' || k === 'mageHigh') {
      this.spawnTracer(attacker, target.x, target.y);
    }
    // 마법사 고급 = 체인 라이트닝 (본 타깃 + 인접 2회 튕김 + 점멸 이펙트, 피드백)
    if (k === 'mageHigh') {
      this.chainLightning(attacker, target);
      return;
    }
    if (attacker.aoe > 1.5) {
      for (const c of this.entities) {
        if (c.side === attacker.side || c.state === 'dead') continue;
        if (Math.hypot(c.x - target.x, c.y - target.y) <= attacker.aoe) {
          this.applyDamage(attacker, c);
        }
      }
    } else {
      this.applyDamage(attacker, target);
      // 관통: 본 타깃 근처 적 1마리 추가 타격 (활병)
      if (attacker.pierce > 0 && Math.random() < attacker.pierce) {
        let extra: CombatEntity | null = null;
        let best = Infinity;
        for (const c of this.entities) {
          if (c.side === attacker.side || c.state === 'dead' || c.id === target.id) continue;
          const d = Math.hypot(c.x - target.x, c.y - target.y);
          if (d <= PIERCE_RADIUS && d < best) {
            best = d;
            extra = c;
          }
        }
        if (extra) this.applyDamage(attacker, extra);
      }
      // 멀티샷: 사거리 내 추가 적 N마리 동시 타격 (활병 Lv5)
      if (attacker.multishot > 0) {
        this.multishotExtra(attacker, target.id, attacker.multishot);
      }
    }
    // 도발: 공격 시 확률로 주변 적 타깃을 자신으로 전환 (방패병)
    if (attacker.taunt > 0 && Math.random() < attacker.taunt) {
      for (const c of this.entities) {
        if (c.side === attacker.side || c.state === 'dead' || isStructure(c.kind)) continue;
        if (c.priority === 'healAlly' || c.kind === 'bomber') continue; // 고유 행동 유지
        if (Math.hypot(c.x - attacker.x, c.y - attacker.y) <= TAUNT_RADIUS) {
          c.targetId = attacker.id;
        }
      }
    }
  }

  /** 체인 라이트닝(마법사 고급): 본 타깃 → 인접 적으로 최대 2회 튕기며 타격 + 점멸 이펙트 */
  private chainLightning(attacker: CombatEntity, target: CombatEntity) {
    const CHAIN_RADIUS = 8;
    const hits: CombatEntity[] = [target];
    let from = target;
    for (let b = 0; b < 2; b++) {
      let best: CombatEntity | null = null;
      let bestD = Infinity;
      for (const c of this.entities) {
        if (c.side === attacker.side || c.state === 'dead' || isStructure(c.kind)) continue;
        if (hits.includes(c)) continue;
        const d = Math.hypot(c.x - from.x, c.y - from.y);
        if (d <= CHAIN_RADIUS && d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (!best) break;
      hits.push(best);
      from = best;
    }
    for (const h of hits) {
      this.applyDamage(attacker, h);
      this.spawnEffect(h.x, h.y, 2.2, 'rgba(150,210,255,0.95)', 0.22); // 라이트닝 점멸
    }
  }

  /** 멀티샷: 사거리(+보너스) 내 가까운 적 count마리를 본 타깃과 별개로 추가 타격 */
  private multishotExtra(attacker: CombatEntity, excludeId: number, count: number) {
    const reach = Math.max(attacker.range, 1) + MULTISHOT_BONUS;
    const hit = new Set<number>([excludeId]);
    for (let k = 0; k < count; k++) {
      let best: CombatEntity | null = null;
      let bestD = Infinity;
      for (const c of this.entities) {
        if (c.side === attacker.side || c.state === 'dead' || hit.has(c.id)) continue;
        if (isStructure(c.kind)) continue;
        const d = Math.hypot(c.x - attacker.x, c.y - attacker.y);
        if (d <= reach && d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (!best) break;
      hit.add(best.id);
      this.applyDamage(attacker, best);
    }
  }

  // ── 투사체 ────────────────────────────────────────────

  private launchProjectile(
    attacker: CombatEntity,
    tx: number,
    ty: number,
    targetTower: boolean,
    atkOverride?: number,
    homingId?: number,
    arrow?: boolean,
  ) {
    let atk = atkOverride ?? attacker.atk;
    if (attacker.frenzyAtkPct > 0 && attacker.hp <= attacker.maxHp * 0.5) {
      atk *= 1 + attacker.frenzyAtkPct / 100;
    }
    this.projectiles.push({
      id: this.nextId++,
      side: attacker.side,
      x: attacker.x,
      y: attacker.y,
      tx,
      ty,
      speed: attacker.projectileSpeed,
      atk,
      aoe: arrow ? attacker.aoe : Math.max(attacker.aoe, 1.5), // 영웅 화살=단일 타깃(궁사) / 투석탄=최소 1.5 광역
      critChance: attacker.critChance,
      burnChance: attacker.burnChance,
      burnPct: attacker.burnPct,
      stunSec: attacker.stunOnHit,
      attackerId: attacker.id,
      targetTower,
      homingId,
      arrow,
    });
  }

  private updateProjectiles(dt: number) {
    if (this.projectiles.length === 0) return;
    const flying: Projectile[] = [];
    for (const p of this.projectiles) {
      if (p.homingId !== undefined) {
        const t = this.byId.get(p.homingId);
        if (t && t.state !== 'dead') {
          p.tx = t.x;
          p.ty = t.y;
        }
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (step >= dist) {
        this.impactProjectile(p);
      } else {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
        flying.push(p);
      }
    }
    this.projectiles = flying;
  }

  /** 지면 폭발: 반경 내 상대측 전체 피해. 위치로 피하는 방식이라 회피(evade) 미적용 */
  private impactProjectile(p: Projectile) {
    if (p.targetTower) {
      if (p.side === 'ally') this.damageTower(p.atk);
      return;
    }
    const shooter = this.byId.get(p.attackerId);
    for (const c of this.entities) {
      if (c.side === p.side || c.state === 'dead') continue;
      if (Math.hypot(c.x - p.tx, c.y - p.ty) > p.aoe) continue;
      let dmg = damage(p.atk, c.def);
      if (p.critChance > 0 && Math.random() < p.critChance) dmg *= 1.5;
      this.hurt(c, dmg);
      if (isDead(c)) continue;
      // 화상/기절 (투석기 화염공격·기절 카드) — % 피해형은 구조물 미적용
      if (p.burnChance > 0 && !isStructure(c.kind) && Math.random() < p.burnChance) {
        c.burnLeft = DOT_DURATION;
        c.burnRate = (c.maxHp * p.burnPct) / 100;
      }
      if (p.stunSec > 0 && !isStructure(c.kind)) {
        c.stunLeft = Math.max(c.stunLeft, p.stunSec);
      }
      if (shooter && shooter.state !== 'dead') {
        this.retaliate(c, shooter.id);
      }
    }
    if (p.arrow) this.spawnEffect(p.tx, p.ty, 2.4, 'rgba(150,210,255,0.9)', 0.22); // 영웅 화살 명중 섬광
  }

  // ── 트랩 / 적 영웅 (설계 09, 11) ──────────────────────

  /** 트랩: 아군 접근 시 피해 + 1초 기절, 1회 발동 후 소멸 (발동 시 EXP 없음) */
  private updateTraps() {
    for (const t of this.entities) {
      if (t.kind !== 'trap' || t.state === 'dead') continue;
      for (const c of this.entities) {
        if (c.side !== 'ally' || c.state === 'dead') continue;
        if (Math.hypot(c.x - t.x, c.y - t.y) > TRAP_TRIGGER.radius) continue;
        const atk = TRAP_TRIGGER.atk * this.config.statMultiplier * TRAP_TRIGGER.ratio;
        this.hurt(c, damage(atk, c.def));
        c.stunLeft = Math.max(c.stunLeft, TRAP_TRIGGER.stunSec);
        t.state = 'dead';
        t.hp = 0;
        break;
      }
    }
  }

  /** 적 영웅: 타워 위 고정 — 기본 공격 + 스킬 (HP는 타워와 동기화, 연출용) */
  private updateEnemyHero(dt: number) {
    const def = this.enemyHero;
    const { towerX, towerY, towerRadius } = this.field;
    this.invulnLeft = Math.max(0, this.invulnLeft - dt);

    // 기본 공격: 타워에서 가장 가까운 아군
    this.enemyHeroAtkCd -= dt;
    if (this.enemyHeroAtkCd <= 0) {
      const reach = towerRadius + def.stats.range + BODY_RADIUS;
      let target: CombatEntity | null = null;
      let best = Infinity;
      for (const c of this.entities) {
        if (c.side !== 'ally' || c.state === 'dead') continue;
        const dist = Math.hypot(c.x - towerX, c.y - towerY);
        if (dist <= reach && dist < best) {
          best = dist;
          target = c;
        }
      }
      if (target) {
        this.enemyHeroAtkCd = 1 / def.stats.atkSpeed;
        if (def.stats.aoe > 1.5) {
          this.areaDamage(target.x, target.y, def.stats.aoe, this.enemyHeroAtk);
        } else {
          this.hurt(target, damage(this.enemyHeroAtk, target.def));
        }
      } else {
        this.enemyHeroAtkCd = 0.2; // 사거리 내 아군 없음 — 재탐색
      }
    }

    // 스킬: 경고 텔레그래프(시전 딜레이) 후 광역 타격 — 위협 가독성 (P2)
    this.enemyHeroSkillCd -= dt;
    if (this.enemyHeroSkillCd <= 0) {
      if (def.id === 'mage') {
        // 필드 랜덤 메테오 5발: 발당 공격력 200%, 반경 3 — 0.9초 낙하 경고
        const allies = this.entities.filter((c) => c.side === 'ally' && c.state !== 'dead');
        if (allies.length > 0) {
          for (let i = 0; i < 5; i++) {
            const at = allies[Math.floor(Math.random() * allies.length)];
            this.queueStrike(at.x, at.y, 3, this.enemyHeroAtk * 2, METEOR_CAST, 'rgba(255,90,90,0.95)');
          }
          this.enemyHeroSkillCd = this.enemyHeroSkillCdMax;
        }
      } else {
        // 기사 휩쓸기 (반경 5, 120%) / 팔라딘 신성 광역 (반경 6, 180%) — 0.7초 시전 경고
        const radius = towerRadius + (def.id === 'paladin' ? 6 : 5);
        const ratio = def.id === 'paladin' ? 1.8 : 1.2;
        const hasTarget = this.entities.some(
          (c) =>
            c.side === 'ally' &&
            c.state !== 'dead' &&
            Math.hypot(c.x - towerX, c.y - towerY) <= radius,
        );
        if (hasTarget) {
          this.queueStrike(towerX, towerY, radius, this.enemyHeroAtk * ratio, SWEEP_CAST, 'rgba(255,120,60,0.9)');
          this.enemyHeroSkillCd = this.enemyHeroSkillCdMax;
        }
      }
    }

    // 팔라딘 패시브: 회복 오라 — 타워 주변 적 유닛 HP/초 = 공격력 × 0.3
    if (def.id === 'paladin') {
      for (const c of this.entities) {
        if (c.side !== 'enemy' || c.state === 'dead' || isStructure(c.kind) || c.noHeal) continue;
        if (c.hp >= c.maxHp) continue;
        if (Math.hypot(c.x - towerX, c.y - towerY) <= towerRadius + 5) {
          c.hp = Math.min(c.maxHp, c.hp + this.enemyHeroAtk * 0.3 * dt);
        }
      }
    }
  }

  /** 적 영웅 스킬/투사체용 광역 피해 — 아군 측에 적용 (피해감소/불굴 hurt 경유) */
  private areaDamage(x: number, y: number, radius: number, atk: number) {
    for (const c of this.entities) {
      if (c.side !== 'ally' || c.state === 'dead') continue;
      if (Math.hypot(c.x - x, c.y - y) > radius) continue;
      this.hurt(c, damage(atk, c.def));
    }
  }

  /**
   * 최종 피해 적용 중앙화: 피해 감소(스펙) → HP 차감 → 불굴(HP 1 생존) → 사망.
   * 반환 = 실제 가해진 피해 (흡혈 계산용)
   */
  private hurt(target: CombatEntity, dmg: number): number {
    if (target.state === 'dead') return 0;
    target.hitFlash = HIT_FLASH; // 타격감 연출
    // 피해감소(스펙) + 수호 오라 = 곱연산 합성
    if (target.dmgReduction > 0 || target.auraShield > 0) {
      dmg *= (1 - target.dmgReduction) * (1 - target.auraShield);
    }
    target.hp -= dmg;
    if (target.hp <= 0) {
      // 불굴: 치명적 피해 시 HP 1로 생존 (쿨타임)
      if (target.undyingCdMax > 0 && target.undyingCd <= 0 && !isStructure(target.kind)) {
        target.hp = 1;
        target.undyingCd = target.undyingCdMax;
      } else {
        this.onDeath(target);
      }
    }
    return dmg;
  }

  private applyDamage(attacker: CombatEntity, target: CombatEntity) {
    const rangedAtk = attacker.range >= RANGED_ATK_RANGE;
    // 회피: 기본 + 원거리 공격에 추가 회피 (암살자)
    const totalEvade = target.evade + (rangedAtk ? target.evadeVsRanged : 0);
    if (totalEvade > 0 && Math.random() < totalEvade) {
      // 카운터(회피율 카드 MAX): 회피 시 공격자에게 공격력 배수 피해
      if (target.counter > 0 && attacker.state !== 'dead' && !isStructure(attacker.kind)) {
        this.hurt(attacker, damage(target.atk * target.counter, attacker.def));
        this.spawnEffect(attacker.x, attacker.y, 3, 'rgba(120,200,255,0.9)', 0.25);
      }
      return;
    }
    // 일격(암살자 Lv5): 확률 발동 — 일반 즉사 / 보스는 면역 대신 큰 피해(공격력×배수, 방어 무시)
    if (
      attacker.executeChance > 0 &&
      !isStructure(target.kind) &&
      Math.random() < attacker.executeChance
    ) {
      if (BOSS_KINDS.has(target.kind)) {
        this.hurt(target, attacker.atk * EXECUTE_BOSS_MULT);
      } else {
        this.onDeath(target);
      }
      this.spawnEffect(target.x, target.y, 4, 'rgba(255,80,80,0.95)', 0.35); // 일격 연출
      return;
    }
    let atk = attacker.atk;
    // 광폭화: HP 50% 이하 시 공격력 증가
    if (attacker.frenzyAtkPct > 0 && attacker.hp <= attacker.maxHp * 0.5) {
      atk *= 1 + attacker.frenzyAtkPct / 100;
    }
    // 역할 배수: 구조물 대상 vs 유닛 대상
    if (isStructure(target.kind)) {
      atk *= attacker.siegeDmgMult;
    } else {
      atk *= attacker.vsUnitMult;
      if (target.range >= RANGED_ATK_RANGE) atk *= attacker.vsRangedUnitMult;
    }
    let dmg = damage(atk, target.def);
    // 원거리 공격 피해 반감 (방패병 40%, 검사 30%)
    if (rangedAtk && target.rangedDmgReduction > 0) dmg *= 1 - target.rangedDmgReduction;
    if (attacker.critChance > 0 && Math.random() < attacker.critChance) dmg *= 1.5;
    // 추가타/불화살: 공격력 % 고정 추가피해 (방어 미적용)
    if (attacker.bonusChance > 0 && Math.random() < attacker.bonusChance) {
      dmg += atk * (attacker.bonusDmgPct / 100);
    }
    // 돌진: 이동 후 첫 타 추가피해 (1회 소모)
    if (attacker.chargeReady) {
      attacker.chargeReady = false;
      dmg *= 1 + attacker.chargeDmgPct / 100;
    }
    const dealt = this.hurt(target, dmg);
    if (attacker.lifestealPct > 0 && attacker.state !== 'dead' && !attacker.noHeal) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + dealt * attacker.lifestealPct);
    }
    // 피해 반사(방어력 카드 MAX): 받은 피해 일부를 공격자에게 (반사는 재반사·반격 미유발)
    if (target.reflect > 0 && dealt > 0 && attacker.state !== 'dead' && !isStructure(attacker.kind)) {
      this.hurt(attacker, dealt * target.reflect);
    }
    // 가시(체력 카드 MAX): 피격 시 주변 적 광역 (쿨타임 제한)
    if (target.thorns > 0 && target.thornsCd <= 0 && !isDead(target)) {
      this.thornsPulse(target);
    }
    if (isDead(target)) {
      // 코인 폭발 / 골드 즉사 (아군이 적 처치 시)
      if (attacker.side === 'ally' && target.side === 'enemy' && !isStructure(target.kind)) {
        this.onAllyKill(attacker, target);
      }
      return;
    }
    // 출혈: % 피해형 — 타워/구조물 미적용 (설계 04)
    if (
      attacker.bleedChance > 0 &&
      !isStructure(target.kind) &&
      Math.random() < attacker.bleedChance
    ) {
      target.bleedLeft = DOT_DURATION;
      target.bleedRate = (target.maxHp * attacker.bleedDotPct) / 100;
    }
    // 화염/기절 (히트스캔 — 마법사/폭탄병 Lv트랙). 투사체는 impactProjectile에서 별도 처리
    if (
      attacker.burnChance > 0 &&
      !isStructure(target.kind) &&
      Math.random() < attacker.burnChance
    ) {
      target.burnLeft = DOT_DURATION;
      target.burnRate = (target.maxHp * attacker.burnPct) / 100;
    }
    if (attacker.stunOnHit > 0 && !isStructure(target.kind)) {
      target.stunLeft = Math.max(target.stunLeft, attacker.stunOnHit);
    }
    this.retaliate(target, attacker.id);
  }

  /**
   * 피격 반격: 구조물/타워를 치고 있거나(시즈 중) 타깃이 없으면 공격자에게 응전.
   * 탐지 범위 밖 원거리 포격에 일방적으로 죽는 문제 방지 (시뮬 검증)
   */
  private retaliate(victim: CombatEntity, attackerId: number) {
    if (victim.state === 'dead' || isStructure(victim.kind)) return;
    if (victim.priority === 'healAlly' || victim.kind === 'bomber') return; // 고유 행동 유지
    const t = victim.targetId;
    if (t === NO_TARGET || t === TOWER_TARGET) {
      victim.targetId = attackerId;
      return;
    }
    const cur = this.byId.get(t);
    if (!cur || cur.state === 'dead' || isStructure(cur.kind)) {
      victim.targetId = attackerId;
    }
  }

  /** 가시(체력 카드 MAX): 피격자 주변 적에게 자신 최대체력 % 광역 피해 */
  private thornsPulse(e: CombatEntity) {
    e.thornsCd = THORNS_CD;
    const dmg = e.maxHp * e.thorns;
    for (const c of this.entities) {
      if (c.side === e.side || c.state === 'dead' || isStructure(c.kind)) continue;
      if (Math.hypot(c.x - e.x, c.y - e.y) <= THORNS_RADIUS) this.hurt(c, damage(dmg, c.def));
    }
    this.spawnEffect(e.x, e.y, THORNS_RADIUS, 'rgba(120,220,160,0.6)', 0.25);
  }

  /** 아군 처치 보너스 (골드 카드): 코인 폭발(광역) + MAX 랜덤 즉사. chain = 연쇄 깊이 가드 */
  private onAllyKill(killer: CombatEntity, victim: CombatEntity, chain = 0) {
    if (killer.coinBlast > 0) {
      const blast = killer.atk * killer.coinBlast;
      for (const c of this.entities) {
        if (c.side !== 'enemy' || c.state === 'dead' || isStructure(c.kind) || c.id === victim.id) continue;
        if (Math.hypot(c.x - victim.x, c.y - victim.y) <= COIN_BLAST_RADIUS) this.hurt(c, damage(blast, c.def));
      }
      this.spawnEffect(victim.x, victim.y, COIN_BLAST_RADIUS, 'rgba(255,215,0,0.85)', 0.3);
    }
    // 골드 MAX: 처치 시 확률로 랜덤 일반 적 즉사 (보스·미니보스·구조물 제외, 연쇄 가능)
    if (chain < GOLD_EXECUTE_MAX_CHAIN && killer.goldExecute > 0 && Math.random() < killer.goldExecute) {
      const pool: CombatEntity[] = [];
      for (const c of this.entities) {
        if (c.side !== 'enemy' || c.state === 'dead' || isStructure(c.kind) || BOSS_KINDS.has(c.kind)) continue;
        pool.push(c);
      }
      if (pool.length > 0) {
        const t = pool[Math.floor(Math.random() * pool.length)];
        this.spawnEffect(t.x, t.y, 4, 'rgba(255,215,0,0.95)', 0.35);
        // 연쇄: 즉사도 아군 처치 보너스 재발동 (코인 폭발 + 추가 즉사 연쇄, 깊이 제한)
        this.onAllyKill(killer, t, chain + 1);
        this.onDeath(t);
      }
    }
  }

  private onDeath(e: CombatEntity) {
    if (e.state === 'dead') return;
    e.state = 'dead';
    e.hp = 0;
    if (e.side === 'enemy') {
      if (!isStructure(e.kind)) this.kills++; // 구조물은 EXP만 (처치수 제외)
      this.gainExp(e.killExp);
    } else if (e.kind === 'hero') {
      // 영웅 부활 시간 감소 카드 적용
      this.reviveLeft = this.heroDef.reviveSeconds * (1 - this.cards.reviveCdrPct / 100);
    }
  }

  private gainExp(baseExp: number) {
    const cardBoost = 1 + this.cards.expPct / 100;
    // 5분 경과 후 경험치 2배 (피드백 6: 장기전 성장 가속)
    const timeMult = this.time >= LATE_GAME_EXP_TIME ? 2 : 1;
    this.totalExp += Math.round(baseExp * this.config.expMultiplier * cardBoost * timeMult);
    while (this.totalExp >= expTotalForLevel(this.level + 1)) {
      this.level++;
      this.pendingPicks++;
      this.applyHeroGrowth();
    }
  }

  /** 레벨업: 선형 성장 + HP 25% 회복 (설계 03) */
  private applyHeroGrowth() {
    this.refreshHeroStats();
    const h = this.hero;
    if (h.state !== 'dead') {
      h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.25);
    }
  }

  /** 영웅 스탯 재계산: 기본 + 레벨 성장(설계 03) × 카드 보정(글로벌 + 영웅 강화) */
  private refreshHeroStats() {
    const s = this.heroDef.stats;
    const g = this.heroDef.growth;
    const lv = this.level - 1;
    const m: UnitMods = this.cards.heroMods();
    const p = this.heroDef.passive; // 고유 패시브 (상시 자기 강화)
    const f = (pct: number) => 1 + pct / 100;
    // 용맹 버프: 지속 중 전 스탯 % 증가
    const buff = this.heroSkillBuffLeft > 0 ? f(this.heroBuffPct) : 1;
    const h = this.hero;
    const hpRatio = h.maxHp > 0 ? h.hp / h.maxHp : 1;
    h.atk = (s.atk + g.atk * lv) * f(m.atkPct + (p.atkPct ?? 0)) * buff;
    h.def = (s.def + g.def * lv) * f(m.defPct) * buff;
    h.maxHp = (s.hp + g.hp * lv) * f(m.hpPct) * buff;
    h.hp = h.maxHp * hpRatio;
    h.atkSpeed = (s.atkSpeed + g.atkSpeed * lv) * f(m.atkSpeedPct) * buff;
    h.moveSpeed = s.moveSpeed * f(m.moveSpeedPct + (p.moveSpeedPct ?? 0));
    h.range = s.range * f(m.rangePct);
    h.evade = (m.evadePct + (p.evadePct ?? 0)) / 100;
    h.critChance = (m.critChance + (p.critPct ?? 0)) / 100;
    h.lifestealPct = m.lifestealPct / 100;
    h.regenPctPerSec = HERO_BASE_REGEN_PCT + m.regenPctPerSec;
    h.frenzyAtkPct = m.frenzyAtkPct;
    // 영웅 프록 (글로벌 카드 — 불굴 등) + 패시브 피해감소
    h.dmgReduction = (m.dmgReductionPct + (p.dmgReductionPct ?? 0)) / 100;
    h.undyingCdMax = m.undyingCooldownSec;
    // 카드 MAX 트리거 (방어 반사 / 체력 가시 / 회피 카운터 / 골드 코인·즉사) — 영웅도 글로벌 적용
    h.reflect = m.reflectPct / 100;
    h.thorns = m.thornsPct / 100;
    h.counter = m.counterPct / 100;
    h.coinBlast = m.coinBlastPct / 100;
    h.goldExecute = m.goldExecuteChance / 100;
  }

  // ── 특수 유닛 ─────────────────────────────────────────

  /** 치유사: 공격 X, HP 비율 낮은 아군 회복 (설계 12/14) */
  private actHealer(e: CombatEntity, dt: number) {
    let target: CombatEntity | null = null;
    let lowest = 1;
    for (const c of this.entities) {
      if (c.side !== e.side || c.state === 'dead' || c.id === e.id) continue;
      if (isStructure(c.kind) || c.noHeal) continue; // 구조물·기계(투석기) 회복 대상 제외
      const ratio = c.hp / c.maxHp;
      if (ratio < lowest && ratio < 0.999) {
        lowest = ratio;
        target = c;
      }
    }
    if (!target) {
      e.state = 'moving';
      return;
    }
    const inRange = this.moveToward(e, target.x, target.y, e.range + BODY_RADIUS, dt);
    e.state = inRange ? 'attacking' : 'moving';
    if (inRange) {
      const heal = HEALER_HEAL_PER_SEC * (1 + e.healBonus) * dt;
      target.hp = Math.min(target.maxHp, target.hp + heal);
    }
  }

  /** 폭탄병 폭발: 반경 내 상대 전체 피해 + 폭발 이펙트. 자폭/요격사망 공통, 1회만 (피드백) */
  private explodeBomber(e: CombatEntity) {
    if (e.exploded) return;
    e.exploded = true;
    for (const c of this.entities) {
      if (c.side === e.side || c.state === 'dead') continue;
      if (Math.hypot(c.x - e.x, c.y - e.y) <= e.aoe) {
        this.applyDamage(e, c);
      }
    }
    this.spawnEffect(e.x, e.y, e.aoe, 'rgba(255,140,40,0.95)', 0.4);
  }

  /** 폭탄병: 가장 가까운 상대에게 접근 후 자폭 (자폭 시 EXP 50%) */
  private actBomber(e: CombatEntity, dt: number) {
    const { towerX, towerY, towerRadius } = this.field;
    let nearest: CombatEntity | null = null;
    let nearestDist = Infinity;
    for (const c of this.entities) {
      if (c.side === e.side || c.state === 'dead') continue;
      // 적 폭탄병도 방어 태세 — 방어 반경 밖 아군은 무시
      if (e.side === 'enemy' && Math.hypot(c.x - towerX, c.y - towerY) > ENEMY_DEFEND_RADIUS) {
        continue;
      }
      const dist = Math.hypot(c.x - e.x, c.y - e.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = c;
      }
    }
    if (!nearest) {
      e.state = 'moving';
      if (e.side === 'enemy') {
        this.moveToward(e, towerX, towerY, towerRadius + ENEMY_GUARD_RING, dt);
      }
      return;
    }
    // 근접 신관: 블래스트 반경 근처에 도달하면 터진다 (코앞까지 비비지 않게 — 피드백)
    const reached = this.moveToward(e, nearest.x, nearest.y, e.aoe * 0.8, dt);
    if (!reached) {
      e.state = 'moving';
      return;
    }
    this.explodeBomber(e);
    e.state = 'dead';
    e.hp = 0;
    if (e.side === 'enemy') {
      this.kills++;
      this.gainExp(BOMBER_EXPLODED_EXP);
    }
  }

  // ── 분산 / 정리 ────────────────────────────────────────

  /**
   * 아군 유닛 뭉침 방지 (피드백 1·9): 가까운 아군끼리 서로 밀어냄.
   * 영웅/구조물/폭탄병 제외 (폭탄병은 돌진해 자폭해야 하므로 밀어내면 타깃 도달 실패).
   * 원거리 화력 과집중·공성 광역 취약 완화.
   * 적은 분산 미적용 — 역방향 타워디펜스 특성상 적을 흩뜨리면 방어선이 얇게 퍼져
   * 아군이 뚫지 못함(시뮬: 스20 75%→20%). 시각적 적 뭉침은 렌더 단계에서 처리.
   */
  private applySeparation() {
    const entities = this.entities;
    const len = entities.length;
    const { width, height } = this.field;
    for (let i = 0; i < len; i++) {
      const a = entities[i];
      if (a.state === 'dead' || a.side !== 'ally' || a.kind === 'hero' || a.kind === 'bomber' || isStructure(a.kind) || a.age > SEPARATION_GRACE) continue;
      for (let j = i + 1; j < len; j++) {
        const b = entities[j];
        if (b.state === 'dead' || b.side !== 'ally' || b.kind === 'hero' || b.kind === 'bomber' || isStructure(b.kind) || b.age > SEPARATION_GRACE) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < SEPARATION_RADIUS && dist > 0.01) {
          const push = ((SEPARATION_RADIUS - dist) / SEPARATION_RADIUS) * SEPARATION_FORCE;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x = Math.min(width - 3, Math.max(3, a.x + nx * push));
          a.y = Math.min(height - 3, Math.max(3, a.y + ny * push));
          b.x = Math.min(width - 3, Math.max(3, b.x - nx * push));
          b.y = Math.min(height - 3, Math.max(3, b.y - ny * push));
        }
      }
    }
  }

  private removeDead() {
    let needsClean = false;
    for (const e of this.entities) {
      if (e.state === 'dead' && e.kind !== 'hero') {
        // 폭탄병은 요격당해 죽어도 터진다 (자폭 못 하고 뭉쳐 죽는 문제 해결, 피드백)
        if (e.kind === 'bomber' && !e.exploded) this.explodeBomber(e);
        this.byId.delete(e.id);
        needsClean = true;
      }
    }
    if (needsClean) {
      this.entities = this.entities.filter((e) => e.state !== 'dead' || e.kind === 'hero');
    }
  }

  // ── HUD 조회용 ────────────────────────────────────────

  /** 생존 적 유닛 수 (구조물 제외) — HUD 상단 표시 (피드백 11) */
  get enemyAlive(): number {
    return this.countSide('enemy');
  }

  /** 생존 아군 유닛 수 (영웅·구조물 제외) — HUD 하단 표시 (피드백 11) */
  get allyAlive(): number {
    return this.countSide('ally') - (this.hero.state !== 'dead' ? 1 : 0);
  }

  get expInLevel(): number {
    return this.totalExp - expTotalForLevel(this.level);
  }

  get expToNext(): number {
    return expToNextLevel(this.level);
  }
}
