import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';

const SHOP_ITEMS = [
  { name: '유닛 뽑기', desc: '다이아 소모 · 미해금 유닛 포함 (첫 획득 시 해금)', icon: '🎲' },
  { name: '영웅 뽑기', desc: '중복 영웅은 해당 영웅 경험치로 전환', icon: '🦸' },
  { name: '다이아 패키지', desc: 'IAP', icon: '💎' },
  { name: '금화 패키지', desc: 'IAP', icon: '🪙' },
  { name: '광고 제거', desc: '평생 1회 결제 — 광고 제거 + x4 배속 영구 해금', icon: '🚫' },
] as const;

export default function ShopScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>상점</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {SHOP_ITEMS.map((item) => (
          <View key={item.name} style={styles.card}>
            <Text style={styles.icon}>{item.icon}</Text>
            <View style={styles.info}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.desc}>{item.desc}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.note}>결제/광고 연동은 추후 구현 (IAA + IAP 하이브리드)</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textMain,
    textAlign: 'center',
    marginVertical: 12,
  },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    gap: 12,
  },
  icon: { fontSize: 24 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: Colors.textMain },
  desc: { fontSize: 11, color: Colors.textSub },
  note: { fontSize: 11, color: Colors.textDim, textAlign: 'center', marginTop: 12 },
});
