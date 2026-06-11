/**
 * 헤드리스 전투 시뮬레이션 — 밸런스 검증용.
 * 실행: npx tsx scripts/simBattle.ts [스테이지]
 */
import { BattleEngine, makeFieldLayout } from '../src/game/engine/engine';
import { getStageConfig } from '../src/data/stages';

const stage = Number(process.argv[2]) || 1;
const config = getStageConfig(stage);
const engine = new BattleEngine(config, makeFieldLayout(1.6));

const DT = 1 / 30;
let elapsed = 0;

console.log(`── 스테이지 ${stage} 시뮬레이션 (타워 ${config.tower.hp.toLocaleString()} HP / 방어 ${config.tower.def}) ──`);

while (elapsed < config.timeLimit && engine.result === 'ongoing') {
  engine.tick(DT);
  elapsed += DT;
  if (Math.abs(elapsed % 60) < DT) {
    const allies = engine.entities.filter((e) => e.side === 'ally' && e.state !== 'dead').length;
    const enemies = engine.entities.filter((e) => e.side === 'enemy' && e.state !== 'dead').length;
    console.log(
      `[${Math.round(elapsed / 60)}분] 타워 ${Math.ceil(engine.towerHp).toLocaleString()} | ` +
        `Lv.${engine.level} | 처치 ${engine.kills} | 아군 ${allies} vs 적 ${enemies} | ` +
        `영웅HP ${Math.ceil(engine.hero.hp)}/${engine.hero.maxHp}${engine.hero.state === 'dead' ? ' (사망)' : ''}`,
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
