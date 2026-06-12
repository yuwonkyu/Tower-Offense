import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';

interface StageResult {
  victory: boolean;
  stage: number;
  kills: number;
  deaths: number;
  /** 이번 전투에서 얻은 누적 EXP */
  totalExp: number;
  goldEarned: number;
  /** 경과 시간 (초) */
  clearTime: number;
  /** 도달 레벨 */
  finalLevel: number;
}

interface Props {
  result: StageResult;
  onNextStage: () => void;
  onRetry: () => void;
  onExit: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}분 ${String(s).padStart(2, '0')}초`;
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && styles.statHighlight]}>{value}</Text>
    </View>
  );
}

export function StageResultModal({ result, onNextStage, onRetry, onExit }: Props) {
  const { victory, stage, kills, deaths, totalExp, goldEarned, clearTime, finalLevel } = result;

  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* 헤더 */}
          <View style={[styles.header, victory ? styles.headerWin : styles.headerLose]}>
            <Text style={[styles.resultText, victory ? styles.winText : styles.loseText]}>
              {victory ? 'VICTORY' : 'DEFEAT'}
            </Text>
            <Text style={styles.stageText}>스테이지 {stage}</Text>
          </View>

          {/* 정산 항목 */}
          <View style={styles.stats}>
            <StatRow label="처치" value={kills.toLocaleString()} />
            <StatRow label="사망" value={`${deaths}회`} />
            <StatRow label="도달 레벨" value={`Lv.${finalLevel}`} highlight />
            <StatRow label="획득 EXP" value={totalExp.toLocaleString()} />
            <View style={styles.divider} />
            <StatRow label="클리어 시간" value={formatTime(clearTime)} />
            <View style={styles.goldRow}>
              <Text style={styles.statLabel}>획득 금화</Text>
              <View style={styles.goldValue}>
                <Text style={styles.goldIcon}>◈</Text>
                <Text style={styles.goldAmount}>{goldEarned.toLocaleString()}</Text>
              </View>
            </View>
            {!victory && (
              <Text style={styles.defeatNote}>※ 패배 보상 30% 적용</Text>
            )}
          </View>

          {/* 버튼 */}
          <View style={styles.btnRow}>
            <Pressable style={styles.btnSecondary} onPress={onExit}>
              <Text style={styles.btnSecondaryText}>나가기</Text>
            </Pressable>
            <Pressable style={styles.btnSecondary} onPress={onRetry}>
              <Text style={styles.btnSecondaryText}>재시도</Text>
            </Pressable>
            {victory && (
              <Pressable style={styles.btnPrimary} onPress={onNextStage}>
                <Text style={styles.btnPrimaryText}>다음 →</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },

  header: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 4,
  },
  headerWin: { backgroundColor: 'rgba(241,196,15,0.12)' },
  headerLose: { backgroundColor: 'rgba(231,76,60,0.12)' },
  resultText: { fontSize: 32, fontWeight: '800', letterSpacing: 2 },
  winText: { color: Colors.gold },
  loseText: { color: Colors.enemyHp },
  stageText: { fontSize: 13, color: Colors.textSub },

  stats: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: { fontSize: 14, color: Colors.textSub },
  statValue: { fontSize: 14, fontWeight: '600', color: Colors.textMain },
  statHighlight: { color: 'rgba(160,130,255,0.95)', fontSize: 15 },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: 2,
  },

  goldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goldValue: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  goldIcon: { fontSize: 14, color: Colors.gold },
  goldAmount: { fontSize: 15, fontWeight: '700', color: Colors.gold },

  defeatNote: {
    fontSize: 11,
    color: Colors.textDim,
    textAlign: 'right',
    marginTop: -4,
  },

  btnRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  btnSecondaryText: { fontSize: 14, color: Colors.textMain },
  btnPrimary: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(241,196,15,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(241,196,15,0.5)',
    alignItems: 'center',
  },
  btnPrimaryText: { fontSize: 14, fontWeight: '700', color: Colors.gold },
});
