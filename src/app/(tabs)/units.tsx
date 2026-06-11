import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { BASE_UNITS } from '@/data/units';
import { NEW_ENEMY_UNITS } from '@/data/enemyUnits';
import { unitUpgradeCardCost, unitUpgradeGoldCost } from '@/game/formulas';

export default function UnitsScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>유닛</Text>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.section}>기본 유닛</Text>
        {BASE_UNITS.map((u) => (
          <View key={u.id} style={styles.card}>
            <Text style={styles.name}>{u.name}</Text>
            <Text style={styles.concept}>{u.concept}</Text>
            <Text style={styles.stats}>
              공 {u.stats.atk} · 방 {u.stats.def} · HP {u.stats.hp} · 사거리 {u.stats.range}
            </Text>
          </View>
        ))}
        <Text style={styles.section}>해금 유닛 (적측 첫 등장 스테이지 클리어)</Text>
        {NEW_ENEMY_UNITS.map((u) => (
          <View key={u.id} style={[styles.card, styles.lockedCard]}>
            <View style={styles.row}>
              <Text style={styles.name}>{u.name}</Text>
              <Text style={styles.unlock}>{u.unlockStage}스테이지 해금</Text>
            </View>
            <Text style={styles.concept}>{u.special ?? u.concept}</Text>
          </View>
        ))}
        <Text style={styles.note}>
          카드 강화: 레벨당 기초 스탯 +1% · 최대 100레벨{'\n'}
          Lv2 = 카드 {unitUpgradeCardCost(2)} + 금화 {unitUpgradeGoldCost(2).toLocaleString()} → Lv100 = 카드{' '}
          {unitUpgradeCardCost(100)} + 금화 {unitUpgradeGoldCost(100).toLocaleString()}
        </Text>
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
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  section: { fontSize: 13, color: Colors.gold, marginTop: 10, marginBottom: 2 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    gap: 2,
  },
  lockedCard: { opacity: 0.75 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontSize: 14, fontWeight: '600', color: Colors.textMain },
  unlock: { fontSize: 11, color: Colors.diamond },
  concept: { fontSize: 11, color: Colors.textSub },
  stats: { fontSize: 11, color: Colors.textSub },
  note: {
    fontSize: 11,
    color: Colors.textDim,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
});
