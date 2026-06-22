/**
 * 헤드리스 전투 시뮬레이션 — 밸런스 검증용 (단판 상세 로그).
 * 실행: npx tsx scripts/simBattle.ts [스테이지] [메타레벨]
 *   - 메타레벨 생략/0 = 초기 스탯 (신규 가입 상태)
 *   - 메타레벨 N = 전 유닛 강화 Lv.N(+ (N-1)%) + 신규유닛 전부 해금 + 영웅 스탯 +N% 투자
 *     (예: 스테이지 20+ 진척 플레이어 ≈ 메타 15~20)
 * 배치 승률 측정은 winrate.ts 참고.
 */
import { runSim } from './simRun';

const stage = Number(process.argv[2]) || 1;
const metaLevel = Number(process.argv[3]) || 0;

const r = runSim(stage, metaLevel, true);

console.log('──────────────────────────────');
console.log(
  r.win
    ? `✅ 승리! ${Math.floor(r.elapsed / 60)}분 ${Math.round(r.elapsed % 60)}초 클리어`
    : `❌ 시간 초과 — 타워 잔여 ${Math.ceil(r.towerHp).toLocaleString()} HP (${Math.round(r.towerPct)}%)`,
);
console.log(`최종 레벨 ${r.level} | 총 처치 ${r.kills} | 누적 EXP ${r.totalExp.toLocaleString()}`);
console.log(`선택 카드 ${r.slotsUsed}/8 슬롯: ${r.picks || '없음'}`);
