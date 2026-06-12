import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useMonetizationStore } from '@/store/monetizationStore';

/** 가짜 광고 시청 시간 (초) — 실제 SDK 연동 시 이 컴포넌트 전체를 광고 호출로 교체 */
const AD_STUB_SECONDS = 3;

interface Props {
  visible: boolean;
  /** 광고 종료 + 보상 지급 시점 */
  onReward: () => void;
  /** 중도 닫기 (보상 없음) */
  onClose: () => void;
}

export function AdStubModal({ visible, onReward, onClose }: Props) {
  const consumeAd = useMonetizationStore((s) => s.consumeAd);
  const [secondsLeft, setSecondsLeft] = useState(AD_STUB_SECONDS);

  useEffect(() => {
    if (!visible) return;
    setSecondsLeft(AD_STUB_SECONDS);
    const timer = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  if (!visible) return null;

  const done = secondsLeft <= 0;

  const handleReward = () => {
    if (!consumeAd()) {
      onClose(); // 일일 한도 초과
      return;
    }
    onReward();
  };

  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.adLabel}>AD</Text>
          <View style={styles.adBody}>
            <Text style={styles.adIcon}>📺</Text>
            <Text style={styles.adText}>광고 재생 중 (스텁)</Text>
            {!done && <Text style={styles.countdown}>{secondsLeft}</Text>}
          </View>
          {done ? (
            <Pressable style={styles.rewardBtn} onPress={handleReward}>
              <Text style={styles.rewardBtnText}>보상 받기</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>건너뛰기 (보상 없음)</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#16162a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 18,
    gap: 14,
  },
  adLabel: {
    alignSelf: 'flex-start',
    fontSize: 10,
    fontWeight: '800',
    color: '#000',
    backgroundColor: Colors.gold,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  adBody: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  adIcon: { fontSize: 40 },
  adText: { fontSize: 13, color: Colors.textSub },
  countdown: { fontSize: 28, fontWeight: '800', color: Colors.timer },
  rewardBtn: {
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: 'rgba(100,200,100,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(100,200,100,0.5)',
    alignItems: 'center',
  },
  rewardBtnText: { fontSize: 14, fontWeight: '700', color: 'rgba(130,230,130,0.95)' },
  closeBtn: { alignItems: 'center', paddingVertical: 6 },
  closeBtnText: { fontSize: 11, color: Colors.textDim },
});
