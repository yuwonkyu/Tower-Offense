import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { TOTAL_STAGES } from '@/data/stages';
import { enemyHeroForStage } from '@/data/enemyHeroes';
import { TOWER_TABLE } from '@/data/towers';

const STAGES = Array.from({ length: TOTAL_STAGES }, (_, i) => i + 1);

export default function HomeScreen() {
  // TODO: 진행도 저장 연동 (현재는 전체 개방)
  const clearedStage = TOTAL_STAGES;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Tower Offense</Text>
      <Text style={styles.subtitle}>인간 종족 — 일반 모드</Text>
      <FlatList
        data={STAGES}
        keyExtractor={(n) => String(n)}
        numColumns={5}
        contentContainerStyle={styles.grid}
        renderItem={({ item: stage }) => {
          const locked = stage > clearedStage + 1;
          const hero = enemyHeroForStage(stage);
          const isBossStage = stage % 10 === 0;
          return (
            <Pressable
              style={[styles.cell, isBossStage && styles.bossCell, locked && styles.lockedCell]}
              disabled={locked}
              onPress={() => router.push({ pathname: '/battle', params: { stage } })}
            >
              <Text style={[styles.cellText, locked && styles.lockedText]}>{stage}</Text>
              {isBossStage && <Text style={styles.bossLabel}>{hero.name}</Text>}
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Text style={styles.footer}>
            타워 HP {TOWER_TABLE[0].hp.toLocaleString()} → {TOWER_TABLE[29].hp.toLocaleString()} · 제한 10분
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.gold,
    textAlign: 'center',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSub,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  grid: { paddingHorizontal: 12, paddingBottom: 24 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    margin: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bossCell: {
    backgroundColor: 'rgba(220,70,70,0.15)',
    borderColor: Colors.enemyHpDim,
  },
  lockedCell: { opacity: 0.35 },
  cellText: { fontSize: 16, fontWeight: '600', color: Colors.textMain },
  lockedText: { color: Colors.textDim },
  bossLabel: { fontSize: 8, color: Colors.enemyHp, marginTop: 2 },
  footer: {
    textAlign: 'center',
    color: Colors.textDim,
    fontSize: 11,
    marginTop: 16,
  },
});
