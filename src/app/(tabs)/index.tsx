import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { hardStagesUnlocked, TOTAL_STAGES } from '@/data/stages';
import { enemyHeroForStage, ENEMY_HERO_VISUAL } from '@/data/enemyHeroes';
import { HEROES } from '@/data/heroes';
import { TOWER_TABLE } from '@/data/towers';
import { useProgressStore } from '@/store/progressStore';

const STAGES = Array.from({ length: TOTAL_STAGES }, (_, i) => i + 1);

export default function HomeScreen() {
  const clearedStage = useProgressStore((s) => s.clearedStage);
  const hardCleared = useProgressStore((s) => s.hardCleared);
  const gold = useProgressStore((s) => s.gold);
  const selectedHeroId = useProgressStore((s) => s.selectedHeroId);
  const selectedHero = HEROES.find((h) => h.id === selectedHeroId) ?? HEROES[0];

  const [mode, setMode] = useState<'normal' | 'hard'>('normal');
  const hard = mode === 'hard';
  const hardUnlocked = hardStagesUnlocked(clearedStage);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Tower Offense</Text>
      <View style={styles.topRow}>
        <Text style={styles.subtitle}>
          {hard ? '하드 — 타워HP×2 · 적+20% · 보상×2' : '인간 종족 — 일반 모드'}
        </Text>
        <Text style={styles.goldChip}>◈ {gold.toLocaleString()}</Text>
      </View>

      {/* 난이도 토글 */}
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, !hard && styles.modeBtnActive]}
          onPress={() => setMode('normal')}
        >
          <Text style={[styles.modeText, !hard && styles.modeTextActive]}>일반</Text>
        </Pressable>
        <Pressable
          style={[styles.modeBtn, hard && styles.modeBtnActiveHard]}
          onPress={() => setMode('hard')}
        >
          <Text style={[styles.modeText, hard && styles.modeTextActiveHard]}>하드 🔥</Text>
        </Pressable>
      </View>

      <Pressable style={styles.heroBar} onPress={() => router.push('/heroes')}>
        <Text style={styles.heroBarText}>
          ⚔ 출전 영웅 · <Text style={styles.heroBarName}>{selectedHero.name}</Text>
        </Text>
        <Text style={styles.heroBarHint}>변경 ›</Text>
      </Pressable>
      <FlatList
        data={STAGES}
        keyExtractor={(n) => String(n)}
        numColumns={5}
        contentContainerStyle={styles.grid}
        renderItem={({ item: stage }) => {
          const locked = hard ? stage > hardUnlocked : stage > clearedStage + 1;
          const cleared = hard ? stage <= hardCleared : stage <= clearedStage;
          const hero = enemyHeroForStage(stage);
          const visual = ENEMY_HERO_VISUAL[hero.id];
          const isBossStage = stage % 10 === 0;
          return (
            <Pressable
              style={[
                styles.cell,
                isBossStage && styles.bossCell,
                hard && !locked && styles.hardCell,
                locked && styles.lockedCell,
              ]}
              disabled={locked}
              onPress={() =>
                router.push({
                  pathname: '/battle',
                  params: hard ? { stage, difficulty: 'hard' } : { stage },
                })
              }
            >
              {/* 적 영웅 식별 아이콘 (스테이지대별 — 기사/마법사/팔라딘) */}
              <Text style={styles.heroIcon}>{visual.icon}</Text>
              <Text style={[styles.cellText, locked && styles.lockedText]}>{stage}</Text>
              {cleared && <Text style={styles.clearedMark}>✓</Text>}
              {isBossStage && (
                <Text style={[styles.bossLabel, { color: visual.color }]}>{hero.name}</Text>
              )}
            </Pressable>
          );
        }}
        ListFooterComponent={
          <Text style={styles.footer}>
            {hard
              ? hardUnlocked > 0
                ? `하드 1~${hardUnlocked} 개방 · 일반 10·20·30 클리어 시 10단계씩 추가`
                : '하드 모드는 일반 10스테이지 클리어 시 열립니다'
              : `타워 HP ${TOWER_TABLE[0].hp.toLocaleString()} → ${TOWER_TABLE[29].hp.toLocaleString()} · 제한 10분`}
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSub,
  },
  goldChip: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modeBtnActive: {
    backgroundColor: 'rgba(241,196,15,0.18)',
    borderColor: 'rgba(241,196,15,0.45)',
  },
  modeBtnActiveHard: {
    backgroundColor: 'rgba(220,70,70,0.18)',
    borderColor: 'rgba(220,70,70,0.5)',
  },
  modeText: { fontSize: 13, fontWeight: '700', color: Colors.textDim },
  modeTextActive: { color: Colors.gold },
  modeTextActiveHard: { color: 'rgba(255,120,120,0.95)' },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(100,180,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(120,200,255,0.35)',
  },
  heroBarText: { fontSize: 13, color: Colors.textSub },
  heroBarName: { fontSize: 13, fontWeight: '700', color: 'rgba(140,200,255,0.95)' },
  heroBarHint: { fontSize: 12, color: Colors.textDim },
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
  hardCell: {
    backgroundColor: 'rgba(220,70,70,0.1)',
    borderColor: 'rgba(220,70,70,0.4)',
  },
  lockedCell: { opacity: 0.35 },
  cellText: { fontSize: 16, fontWeight: '600', color: Colors.textMain },
  lockedText: { color: Colors.textDim },
  heroIcon: {
    position: 'absolute',
    top: 3,
    left: 4,
    fontSize: 10,
    opacity: 0.85,
  },
  clearedMark: {
    position: 'absolute',
    top: 3,
    right: 4,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(120,220,120,0.95)',
  },
  bossLabel: { fontSize: 8, marginTop: 2 },
  footer: {
    textAlign: 'center',
    color: Colors.textDim,
    fontSize: 11,
    marginTop: 16,
  },
});
