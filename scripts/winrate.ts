/**
 * 배치 승률 측정 — 같은 픽 모델로 N판 돌려 승률 집계 (밸런스 before/after 비교용).
 * 실행: npx tsx scripts/winrate.ts <N> <스테이지[:메타]> [<스테이지[:메타]> ...]
 *   예: npx tsx scripts/winrate.ts 30 20:10 25:13 30:17
 *   메타 생략 시 0 (초기 스탯). 현실 메타 근사: 스20≈10 / 스25≈13 / 스30≈17.
 */
import { runSim } from './simRun';

const N = Number(process.argv[2]) || 20;
const specs = process.argv.slice(3);
if (specs.length === 0) {
  // 기본: 현실 메타 근사로 스20/25/30
  specs.push('20:10', '25:13', '30:17');
}

console.log(`승률 측정 — 각 ${N}판\n──────────────────────────────`);
for (const spec of specs) {
  const [stageStr, metaStr] = spec.split(':');
  const stage = Number(stageStr);
  const meta = Number(metaStr) || 0;
  let wins = 0;
  let winTime = 0; // 승리 클리어 시간 합
  let lossTowerPct = 0; // 패배 타워 잔여% 합
  let losses = 0;
  for (let i = 0; i < N; i++) {
    const r = runSim(stage, meta);
    if (r.win) {
      wins++;
      winTime += r.elapsed;
    } else {
      losses++;
      lossTowerPct += r.towerPct;
    }
  }
  const pct = Math.round((wins / N) * 100);
  const avgWin = wins ? `${Math.floor(winTime / wins / 60)}분 ${Math.round((winTime / wins) % 60)}초` : '-';
  const avgLoss = losses ? `${Math.round(lossTowerPct / losses)}%` : '-';
  console.log(
    `스${stage}${meta ? ` @메타${meta}` : ''}: ${wins}/${N}승 (${pct}%) | ` +
      `평균 클리어 ${avgWin} | 패배 시 타워잔여 ${avgLoss}`,
  );
}
