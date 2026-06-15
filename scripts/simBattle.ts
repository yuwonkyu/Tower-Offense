/**
 * 헤드리스 전투 시뮬레이션 — 밸런스 검증용.
 * 실행: npx tsx scripts/simBattle.ts [스테이지] [메타레벨]
 *   - 메타레벨 생략/0 = 초기 스탯 (신규 가입 상태)
 *   - 메타레벨 N = 전 유닛 강화 Lv.N(+ (N-1)%) + 신규유닛 전부 해금 + 영웅 스탯 +N% 투자
 *     (예: 스테이지 20+ 진척 플레이어 ≈ 메타 15~20)
 */
import { BattleEngine, makeFieldLayout, unitDef } from '../src/game/engine/engine';
import { getStageConfig } from '../src/data/stages';
import { unitUpgradeStatBonus } from '../src/game/formulas';
import { BASE_UNITS } from '../src/data/units';
import { NEW_ENEMY_UNITS } from '../src/data/enemyUnits';
import { HEROES } from '../src/data/heroes';
import type { HeroDef, UnitId } from '../src/game/types';

const stage = Number(process.argv[2]) || 1;
const metaLevel = Number(process.argv[3]) || 0;
const config = getStageConfig(stage);

// ── 메타 성장 프로필 (스테이지 20+ 진척 플레이어 근사) ──
let heroDef: HeroDef = HEROES[0];
const unitMetaBonuses: Record<string, number> = {};
let unlockedUnits: UnitId[] = [];
if (metaLevel > 0) {
  const bonus = unitUpgradeStatBonus(metaLevel); // 전 유닛 동일 강화로 근사
  for (const u of [...BASE_UNITS, ...NEW_ENEMY_UNITS]) unitMetaBonuses[u.id] = bonus;
  unlockedUnits = NEW_ENEMY_UNITS.map((u) => u.id); // 신규 유닛 전부 해금
  const s = heroDef.stats; // 영웅 투자: 전 스탯 +metaLevel%
  const f = 1 + metaLevel * 0.01;
  heroDef = {
    ...heroDef,
    stats: {
      ...s,
      atk: Math.round(s.atk * f),
      def: Math.round(s.def * f),
      hp: Math.round(s.hp * f),
      atkSpeed: +(s.atkSpeed * f).toFixed(3),
    },
  };
}

const engine = new BattleEngine(config, makeFieldLayout(1.6), heroDef, unitMetaBonuses, unlockedUnits);

const DT = 1 / 30;
let elapsed = 0;
const pickLog = new Map<string, number>();

/**
 * 카드 선택권 자동 소비 — "괜찮은 플레이어" 근사 모델.
 * 유닛 3종까지 딜러 우선 확보 → 이후 공격/경험치/생성 계열 가중 선택.
 * (완전 랜덤은 근접 유닛만 뽑는 등 실패 런 변동이 너무 큼 — 밸런스 신호가 묻힘)
 */
const PICK_WEIGHT: Record<string, number> = {
  // 핵심 성장
  g_exp: 10,
  g_spawnspeed: 9,
  g_atk: 8,
  g_atkspeed: 8,
  // 유닛 딜 특성
  spear_atk: 7,
  sword_atk: 7,
  catapult_atk: 7,
  archer_atkspeed: 7,
  archer_crit: 6,
  spear_extra: 6,
  archer_firearrow: 6,
  catapult_stun: 6,
  g_crit: 6,
  g_range: 5,
  archer_range: 5,
  catapult_range: 5,
  catapult_aoe: 5,
  spear_charge: 5,
  archer_pierce: 5,
  g_cdr: 4,
  g_hero: 4,
  spear_bleed: 4,
  catapult_fire: 4,
  // 생존 계열
  g_hp: 3,
  g_def: 3,
  shield_hp: 3,
  shield_def: 3,
  sword_lifesteal: 3,
  g_lifesteal: 3,
  g_undying: 3,
  g_revive: 3,
  shield_taunt: 3,
  spear_reduce: 3,
  // 저가치
  g_movespeed: 1,
  g_evade: 2,
  g_frenzy: 2,
  sword_evade: 2,
  sword_hp: 2,
  shield_speed: 1,
  shield_regen: 2,
  sword_berserker: 1,
  g_gold: 1,
};

function autoPick() {
  while (engine.pendingPicks > 0) {
    const choices = engine.cards.rollChoices(3);
    if (choices.length === 0) {
      engine.pendingPicks = 0;
      break;
    }
    let card = choices[0];
    const units = choices.filter((c) => c.kind === 'unit' && c.unitId);
    if (engine.cards.ownedUnits.length < 3 && units.length > 0) {
      // 유닛 3종까지 우선 확보 — 딜러(공격력 높은 순)부터
      units.sort((a, b) => unitDef(b.unitId!).stats.atk - unitDef(a.unitId!).stats.atk);
      card = units[0];
    } else {
      // 가중치 최고 카드 선택 (동점이면 앞쪽)
      let bestW = -1;
      for (const c of choices) {
        const w = c.kind === 'unit' ? 4 : (PICK_WEIGHT[c.id] ?? 3);
        if (w > bestW) {
          bestW = w;
          card = c;
        }
      }
    }
    engine.pickCard(card.id);
    pickLog.set(card.name, (pickLog.get(card.name) ?? 0) + 1);
  }
}

console.log(
  `── 스테이지 ${stage} 시뮬레이션 (타워 ${config.tower.hp.toLocaleString()} HP / 방어 ${config.tower.def})` +
    `${metaLevel > 0 ? ` · 메타 Lv.${metaLevel} (유닛 +${Math.round(unitUpgradeStatBonus(metaLevel) * 100)}% / 영웅 +${metaLevel}%)` : ' · 초기 스탯'} ──`,
);

while (elapsed < config.timeLimit && engine.result === 'ongoing') {
  autoPick();
  engine.useHeroSkill(); // 준비되면 즉시 사용 (쿨다운/타깃 없음 시 무시)
  engine.tick(DT);
  elapsed += DT;
  if (Math.abs(elapsed % 60) < DT) {
    const alive = engine.entities.filter((e) => e.state !== 'dead');
    const allies = alive.filter((e) => e.side === 'ally').length;
    const structs = alive.filter((e) => ['wall', 'barricade', 'trap'].includes(e.kind)).length;
    const walls = alive.filter((e) => e.kind === 'wall').length;
    const enemies = alive.filter((e) => e.side === 'enemy').length - structs;
    // 전선: 아군 유닛 최전방 (타워까지 남은 거리)
    const allyUnits = alive.filter((e) => e.side === 'ally' && e.kind !== 'hero');
    const front = allyUnits.length
      ? Math.round(
          Math.min(
            ...allyUnits.map((e) => Math.hypot(e.x - engine.field.towerX, e.y - engine.field.towerY)),
          ),
        )
      : -1;
    console.log(
      `[${Math.round(elapsed / 60)}분] 타워 ${Math.ceil(engine.towerHp).toLocaleString()} | ` +
        `Lv.${engine.level} | 처치 ${engine.kills} | 아군 ${allies} vs 적 ${enemies} | 성벽 ${walls} | ` +
        `전선↔타워 ${front < 0 ? '-' : front} | ` +
        `영웅HP ${Math.ceil(engine.hero.hp)}/${Math.round(engine.hero.maxHp)}${engine.hero.state === 'dead' ? ' (사망)' : ''}`,
    );
  }
}

console.log('──────────────────────────────');
console.log(
  engine.result === 'victory'
    ? `✅ 승리! ${Math.floor(elapsed / 60)}분 ${Math.round(elapsed % 60)}초 클리어`
    : `❌ 시간 초과 — 타워 잔여 ${Math.ceil(engine.towerHp).toLocaleString()} HP (${Math.round((engine.towerHp / config.tower.hp) * 100)}%)`,
);
console.log(`최종 레벨 ${engine.level} | 총 처치 ${engine.kills} | 누적 EXP ${engine.totalExp.toLocaleString()}`);
const picks = [...pickLog.entries()].map(([name, n]) => (n > 1 ? `${name}×${n}` : name)).join(', ');
console.log(`선택 카드 ${engine.cards.slotsUsed}/8 슬롯: ${picks || '없음'}`);
