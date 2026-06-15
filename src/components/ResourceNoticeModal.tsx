import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';

interface Props {
  /** 직전 자동 습득 누적 (gold/diamonds) */
  gain: { gold: number; diamonds: number };
  onConfirm: () => void;
}

/**
 * 카드 풀 소진 안내 (1회). 이후 레벨업은 재화를 자동 습득 — 추가 선택 없음.
 * 전투는 일시정지(resourceNotice 페이즈), 확인 시 재개.
 */
export function ResourceNoticeModal({ gain, onConfirm }: Props) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.badge}>★ 카드 강화 완료</Text>
        <Text style={styles.title}>모든 카드를 최대로 강화했습니다</Text>
        <Text style={styles.desc}>
          더 이상 강화할 카드가 없어요.{'\n'}
          다음 레벨업부터 <Text style={styles.hl}>재화를 자동으로 획득</Text>합니다.
        </Text>

        <View style={styles.gainRow}>
          {gain.gold > 0 && (
            <View style={styles.gainChip}>
              <Text style={styles.gainGold}>◈ +{gain.gold.toLocaleString()}</Text>
            </View>
          )}
          {gain.diamonds > 0 && (
            <View style={styles.gainChip}>
              <Text style={styles.gainDia}>💎 +{gain.diamonds}</Text>
            </View>
          )}
        </View>

        <Pressable style={styles.btn} onPress={onConfirm}>
          <Text style={styles.btnText}>확인</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 5,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(241,196,15,0.4)',
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(241,196,15,0.95)',
    backgroundColor: 'rgba(241,196,15,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(241,196,15,0.4)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  title: { fontSize: 17, fontWeight: '800', color: Colors.textMain, textAlign: 'center' },
  desc: { fontSize: 13, lineHeight: 19, color: Colors.textSub, textAlign: 'center' },
  hl: { color: 'rgba(241,196,15,0.98)', fontWeight: '700' },

  gainRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  gainChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  gainGold: { fontSize: 15, fontWeight: '800', color: Colors.gold },
  gainDia: { fontSize: 15, fontWeight: '800', color: Colors.diamond },

  btn: {
    marginTop: 8,
    alignSelf: 'stretch',
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(241,196,15,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(241,196,15,0.5)',
    alignItems: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '700', color: Colors.gold },
});
