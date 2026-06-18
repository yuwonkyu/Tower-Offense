import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { HEROES } from '@/data/heroes';
import { HERO_RESET_DIAMONDS } from '@/game/formulas';
import { computeHeroMeta, useProgressStore, type HeroStatAlloc } from '@/store/progressStore';

const STAT_LABELS: { key: keyof HeroStatAlloc; label: string; unit: string }[] = [
  { key: 'atk', label: '공격력', unit: 'ATK' },
  { key: 'def', label: '방어력', unit: 'DEF' },
  { key: 'hp', label: '체력', unit: 'HP' },
  { key: 'atkSpeed', label: '공격속도', unit: 'ASPD' },
];

const EMPTY_ALLOC: HeroStatAlloc = { atk: 0, def: 0, hp: 0, atkSpeed: 0 };

export default function HeroesScreen() {
  const investHeroStat = useProgressStore((s) => s.investHeroStat);
  const resetHeroStats = useProgressStore((s) => s.resetHeroStats);
  const diamonds = useProgressStore((s) => s.diamonds);
  const selectedHeroId = useProgressStore((s) => s.selectedHeroId);
  const selectHero = useProgressStore((s) => s.selectHero);
  // 스탯/EXP 데이터를 직접 구독 → computeHeroMeta에 넘겨 변경 즉시 재계산·리렌더 (피드백 5/3)
  const heroExp = useProgressStore((s) => s.heroExp);
  const heroInvestedStats = useProgressStore((s) => s.heroInvestedStats);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>영웅</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {HEROES.map((hero) => {
          const meta = computeHeroMeta(heroExp[hero.id] ?? 0, heroInvestedStats[hero.id] ?? EMPTY_ALLOC);
          const expPct = meta.expToNext > 0 ? meta.expInLevel / meta.expToNext : 0;
          const isSelected = hero.id === selectedHeroId;

          return (
            <View key={hero.id} style={[styles.card, isSelected && styles.cardSelected]}>
              {/* 초상화 + 레벨 */}
              <View style={styles.topRow}>
                <View style={[styles.portrait, isSelected && styles.portraitSelected]}>
                  <Text style={styles.portraitText}>{hero.name[0]}</Text>
                </View>
                <View style={styles.heroInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.heroName}>{hero.name}</Text>
                    <View style={styles.lvBadge}>
                      <Text style={styles.lvText}>Lv.{meta.level}</Text>
                    </View>
                    <Pressable
                      style={[styles.deployChip, isSelected && styles.deployChipActive]}
                      onPress={() => selectHero(hero.id)}
                      disabled={isSelected}
                    >
                      <Text style={[styles.deployText, isSelected && styles.deployTextActive]}>
                        {isSelected ? '⚔ 출전 중' : '출전'}
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={styles.concept}>{hero.concept}</Text>
                  {/* EXP 바 */}
                  <View style={styles.expBarBg}>
                    <View style={[styles.expBarFill, { width: `${expPct * 100}%` }]} />
                  </View>
                  <Text style={styles.expText}>
                    {meta.expInLevel.toLocaleString()} / {meta.expToNext.toLocaleString()} EXP
                  </Text>
                </View>
              </View>

              {/* 스탯 포인트 */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>스탯 포인트</Text>
                <Text style={[styles.ptsLeft, meta.statPtsAvailable > 0 && styles.ptsAvail]}>
                  {meta.statPtsAvailable}pt 남음
                </Text>
              </View>
              {STAT_LABELS.map(({ key, label, unit }) => (
                <View key={key} style={styles.statRow}>
                  <Text style={styles.statLabel}>{label}</Text>
                  <Text style={styles.statBase}>
                    {hero.stats[key as keyof typeof hero.stats]}
                    {meta.invested[key] > 0 && (
                      <Text style={styles.statBonus}> +{meta.invested[key]}%</Text>
                    )}
                  </Text>
                  <View style={styles.statBadge}>
                    <Text style={styles.statBadgeText}>{unit} {meta.invested[key]}</Text>
                  </View>
                  <Pressable
                    style={[styles.plusBtn, meta.statPtsAvailable <= 0 && styles.plusBtnDisabled]}
                    onPress={() => investHeroStat(hero.id, key)}
                    disabled={meta.statPtsAvailable <= 0}
                  >
                    <Text style={styles.plusBtnText}>+</Text>
                  </Pressable>
                </View>
              ))}

              {/* 스킬 레벨 (자동 — 5레벨마다 +1, 피드백 6) */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>스킬</Text>
                <Text style={styles.ptsLeft}>자동 레벨업 · 5레벨마다 +1</Text>
              </View>
              <View style={styles.skillRow}>
                <View style={styles.skillInfo}>
                  <Text style={styles.skillName}>{hero.skill.name}</Text>
                  <Text style={styles.skillDesc}>{hero.skill.description}</Text>
                  <Text style={styles.skillLv}>Lv.{meta.skillLevel} — 계수 {(hero.skill.ratio * (1 + (meta.skillLevel - 1) * 0.02) * 100).toFixed(0)}%</Text>
                </View>
              </View>

              {/* 패시브 (상시) */}
              <View style={styles.passiveRow}>
                <Text style={styles.passiveTag}>패시브</Text>
                <View style={styles.passiveInfo}>
                  <Text style={styles.passiveName}>{hero.passive.name}</Text>
                  <Text style={styles.passiveDesc}>{hero.passive.description}</Text>
                </View>
              </View>

              {/* 초기화 */}
              <Pressable
                style={[styles.resetBtn, diamonds < HERO_RESET_DIAMONDS && styles.resetBtnDisabled]}
                onPress={() => resetHeroStats(hero.id)}
                disabled={diamonds < HERO_RESET_DIAMONDS}
              >
                <Text style={styles.resetBtnText}>
                  초기화 ({HERO_RESET_DIAMONDS} 💎)
                </Text>
              </Pressable>
            </View>
          );
        })}
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
  list: { paddingHorizontal: 14, paddingBottom: 32, gap: 14 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    gap: 10,
  },
  cardSelected: {
    borderColor: 'rgba(120,200,255,0.7)',
    backgroundColor: 'rgba(100,180,255,0.08)',
  },

  topRow: { flexDirection: 'row', gap: 12 },
  portrait: {
    width: 56,
    height: 64,
    borderRadius: 8,
    backgroundColor: Colors.hero,
    borderWidth: 1.5,
    borderColor: Colors.heroBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitSelected: { borderColor: 'rgba(120,200,255,0.9)', borderWidth: 2 },
  portraitText: { fontSize: 22, color: Colors.heroText, fontWeight: '700' },
  heroInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroName: { fontSize: 16, fontWeight: '700', color: Colors.textMain },
  lvBadge: {
    backgroundColor: 'rgba(160,100,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(160,100,255,0.45)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  lvText: { fontSize: 11, fontWeight: '700', color: 'rgba(190,150,255,0.9)' },
  deployChip: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  deployChipActive: {
    backgroundColor: 'rgba(100,180,255,0.18)',
    borderColor: 'rgba(120,200,255,0.6)',
  },
  deployText: { fontSize: 11, fontWeight: '700', color: Colors.textSub },
  deployTextActive: { color: 'rgba(140,200,255,0.95)' },
  concept: { fontSize: 11, color: Colors.textSub },
  expBarBg: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  expBarFill: { height: '100%', backgroundColor: Colors.exp, borderRadius: 3 },
  expText: { fontSize: 10, color: Colors.textDim },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingTop: 8,
  },
  sectionLabel: { fontSize: 12, color: Colors.gold, fontWeight: '600' },
  ptsLeft: { fontSize: 11, color: Colors.textDim },
  ptsAvail: { color: 'rgba(100,220,120,0.9)', fontWeight: '600' },

  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { flex: 1, fontSize: 13, color: Colors.textSub },
  statBase: { fontSize: 13, color: Colors.textMain },
  statBonus: { color: 'rgba(100,220,120,0.9)' },
  statBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statBadgeText: { fontSize: 10, color: Colors.textSub },
  plusBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(100,200,100,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(100,200,100,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBtnDisabled: { opacity: 0.3 },
  plusBtnText: { fontSize: 16, color: 'rgba(120,220,120,0.9)', lineHeight: 20 },

  skillRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  skillInfo: { flex: 1, gap: 2 },
  skillName: { fontSize: 13, fontWeight: '600', color: Colors.gold },
  skillDesc: { fontSize: 11, color: Colors.textSub },
  skillLv: { fontSize: 11, color: 'rgba(160,130,255,0.85)' },
  skillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(160,100,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(160,100,255,0.45)',
    alignSelf: 'center',
  },
  skillBtnText: { fontSize: 12, color: 'rgba(200,170,255,0.9)', fontWeight: '600' },

  passiveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passiveTag: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(100,220,120,0.95)',
    backgroundColor: 'rgba(100,200,100,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(100,200,100,0.35)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  passiveInfo: { flex: 1 },
  passiveName: { fontSize: 12, fontWeight: '600', color: 'rgba(120,220,140,0.95)' },
  passiveDesc: { fontSize: 11, color: Colors.textSub },

  resetBtn: {
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(231,76,60,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.3)',
    alignItems: 'center',
    marginTop: 2,
  },
  resetBtnDisabled: { opacity: 0.35 },
  resetBtnText: { fontSize: 12, color: 'rgba(231,100,80,0.9)' },
});
