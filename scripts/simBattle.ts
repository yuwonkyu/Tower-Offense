/**
 * 헤드리스 전투 시뮬레이션 — 밸런스 검증용.
 * 실행: npx tsx scripts/simBattle.ts [스테이지]
 */
import { BattleEngine, makeFieldLayout, unitDef } from '../src/game/engine/engine';
import { getStageConfig } from '../src/data/stages';

const stage = Number(process.argv[2]) || 1;
const config = getStageConfig(stage);
const engine = new BattleEngine(config, makeFieldLayout(1.6));

const DT = 1 / 30;
let elapsed = 0;
const pickLog = new Map<string, number>();

/** 카드 선택권 자동 소비 — 플레이어 근사: 유닛 2종 확보 전엔 딜러 유닛 우선, 이후 랜덤 */
function autoPick() {
  while (engine.pendingPicks > 0) {
    const choices = engine.cards.rollChoices(3);
    if (choices.length === 0) {
      engine.pendingPicks = 0;
      break;
    }
    let card = choices[Math.floor(Math.random() * choices.length)];
    if (engine.cards.ownedUnits.length < 2) {
      const units = choices.filter((c) => c.kind === 'unit' && c.unitId);
      if (units.length > 0) {
        units.sort((a, b) => unitDef(b.unitId!).stats.atk - unitDef(a.unitId!).stats.atk);
        card = units[0];
      }
    }
    engine.pickCard(card.id);
    pickLog.set(card.name, (pickLog.get(card.name) ?? 0) + 1);
  }
}

console.log(`── 스테이지 ${stage} 시뮬레이션 (타워 ${config.tower.hp.toLocaleString()} HP / 방어 ${config.tower.def}) ──`);

while (elapsed < config.timeLimit && engine.result === 'ongoing') {
  autoPick();
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
