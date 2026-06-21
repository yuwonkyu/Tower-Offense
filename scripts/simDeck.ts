/**
 * 강제 덱 시뮬레이션 — "막뽑" 근사.
 * 목표 유닛 4종(검사·투석기·마법사·창병)을 우선 확보·강화하고
 * 나머지 슬롯은 제시된 카드 중 완전 랜덤으로 채운다 (= 대충 뽑은 보조 카드).
 * 실행: npx tsx scripts/simDeck.ts [스테이지] [메타레벨] [반복횟수]
 */
import { BattleEngine, makeFieldLayout } from '../src/game/engine/engine';
import { getStageConfig } from '../src/data/stages';
import { unitUpgradeStatBonus } from '../src/game/formulas';
import { BASE_UNITS } from '../src/data/units';
import { NEW_ENEMY_UNITS } from '../src/data/enemyUnits';
import { HEROES } from '../src/data/heroes';
import type { HeroDef, UnitId } from '../src/game/types';

const stage = Number(process.argv[2]) || 30;
const metaLevel = Number(process.argv[3]) || 10;
const runs = Number(process.argv[4]) || 10;

// 목표 덱: 기본 검사·투석기·마법사·창병 (활병·방패병 없음).
// DECK 환경변수로 교체 가능 (쉼표 구분 카드 id) — 예: DECK=unit_swordsman,unit_spear,unit_mage,unit_shield
const TARGET_UNIT_CARDS = (process.env.DECK ?? 'unit_swordsman,unit_catapult,unit_mage,unit_spear')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

function buildHero(): HeroDef {
  let heroDef: HeroDef = HEROES[0];
  if (metaLevel > 0) {
    const s = heroDef.stats;
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
  return heroDef;
}

function runOnce(): { win: boolean; towerPct: number; elapsed: number; picks: string } {
  const config = getStageConfig(stage);
  const unitMetaBonuses: Record<string, number> = {};
  let unlockedUnits: UnitId[] = [];
  if (metaLevel > 0) {
    const bonus = unitUpgradeStatBonus(metaLevel);
    for (const u of [...BASE_UNITS, ...NEW_ENEMY_UNITS]) unitMetaBonuses[u.id] = bonus;
    unlockedUnits = NEW_ENEMY_UNITS.map((u) => u.id);
  }
  const engine = new BattleEngine(
    config,
    makeFieldLayout(1.6),
    buildHero(),
    unitMetaBonuses,
    unlockedUnits,
  );

  const pickLog = new Map<string, number>();
  const DT = 1 / 30;
  let elapsed = 0;

  function autoPick() {
    while (engine.pendingPicks > 0) {
      const choices = engine.cards.rollChoices(3);
      if (choices.length === 0) {
        engine.pendingPicks = 0;
        break;
      }
      // 1순위: 목표 유닛 카드가 제시되면 무조건 확보/강화
      let card = choices.find((c) => TARGET_UNIT_CARDS.includes(c.id));
      // 2순위: 막뽑 — 나머지는 제시된 것 중 완전 랜덤
      if (!card) card = choices[Math.floor(Math.random() * choices.length)];
      engine.pickCard(card.id);
      pickLog.set(card.name, (pickLog.get(card.name) ?? 0) + 1);
    }
  }

  while (elapsed < config.timeLimit && engine.result === 'ongoing') {
    autoPick();
    engine.useHeroSkill();
    engine.tick(DT);
    elapsed += DT;
  }

  const picks = [...pickLog.entries()]
    .map(([name, n]) => (n > 1 ? `${name}×${n}` : name))
    .join(', ');
  return {
    win: engine.result === 'victory',
    towerPct: Math.round((engine.towerHp / config.tower.hp) * 100),
    elapsed,
    picks,
  };
}

const cfg = getStageConfig(stage);
console.log(
  `── 강제 덱 [${TARGET_UNIT_CARDS.join('+')} + 랜덤보조] · 스테이지 ${stage} ` +
    `(타워 ${cfg.tower.hp.toLocaleString()} HP) · 메타 Lv.${metaLevel} · ${runs}판 ──`,
);
let wins = 0;
let towerSum = 0;
for (let i = 0; i < runs; i++) {
  const r = runOnce();
  if (r.win) wins++;
  towerSum += r.towerPct;
  console.log(
    `${(i + 1).toString().padStart(2)} ${r.win ? '✅승리' : '❌패배'} ` +
      `타워잔여 ${r.towerPct.toString().padStart(3)}% · ${Math.floor(r.elapsed / 60)}:${String(Math.round(r.elapsed % 60)).padStart(2, '0')} · ${r.picks}`,
  );
}
console.log('──────────────────────────────');
console.log(
  `승률 ${wins}/${runs} (${Math.round((wins / runs) * 100)}%) · 평균 타워잔여 ${Math.round(towerSum / runs)}%`,
);
