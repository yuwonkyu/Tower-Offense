import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { BASE_UNITS } from '@/data/units';
import { NEW_ENEMY_UNITS } from '@/data/enemyUnits';
import { unitUpgradeCardCost, unitUpgradeGoldCost, unitUpgradeStatBonus } from '@/game/formulas';
import { useProgressStore } from '@/store/progressStore';

const ALL_UNITS = [...BASE_UNITS, ...NEW_ENEMY_UNITS];

export default function UnitsScreen() {
  const unlockedUnits = useProgressStore((s) => s.unlockedUnits);
  const unitCardCounts = useProgressStore((s) => s.unitCardCounts);
  const unitLevels = useProgressStore((s) => s.unitLevels);
  const gold = useProgressStore((s) => s.gold);
  const upgradeUnit = useProgressStore((s) => s.upgradeUnit);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>유닛</Text>
        <Text style={styles.goldChip}>◈ {gold.toLocaleString()}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {ALL_UNITS.map((u) => {
          const isBase = u.unlockStage === 0;
          const unlocked = isBase || unlockedUnits.includes(u.id);
          const level = unitLevels[u.id] ?? 1;
          const cards = unitCardCounts[u.id] ?? 0;
          const nextLv = level + 1;
          const cardCost = unitUpgradeCardCost(nextLv);
          const goldCost = unitUpgradeGoldCost(nextLv);
          const canUpgrade = unlocked && cards >= cardCost && gold >= goldCost && level < 100;
          const bonusPct = Math.round(unitUpgradeStatBonus(level) * 100);

          return (
            <View key={u.id} style={[styles.card, !unlocked && styles.cardLocked]}>
              <View style={styles.cardMain}>
                {/* 아이콘 */}
                <View style={[styles.unitIcon, !unlocked && styles.unitIconLocked]}>
                  <Text style={styles.unitIconText}>{u.name[0]}</Text>
                </View>

                {/* 정보 */}
                <View style={styles.unitInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.unitName}>{u.name}</Text>
                    {unlocked ? (
                      <View style={styles.lvBadge}>
                        <Text style={styles.lvText}>Lv.{level}</Text>
                      </View>
                    ) : (
                      <View style={styles.lockBadge}>
                        <Text style={styles.lockText}>{u.unlockStage}스테이지 클리어</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.concept}>{u.special ?? u.concept}</Text>
                  {unlocked && bonusPct > 0 && (
                    <Text style={styles.bonus}>기초 스탯 +{bonusPct}%</Text>
                  )}
                </View>
              </View>

              {/* 강화 섹션 */}
              {unlocked && level < 100 && (
                <View style={styles.upgradeRow}>
                  {/* 카드 게이지 */}
                  <View style={styles.cardProgress}>
                    <View style={styles.cardProgressBg}>
                      <View
                        style={[
                          styles.cardProgressFill,
                          { width: `${Math.min(1, cards / cardCost) * 100}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.cardCount}>
                      {cards}/{cardCost} 카드
                    </Text>
                  </View>
                  <Text style={styles.goldCost}>◈ {goldCost.toLocaleString()}</Text>
                  <Pressable
                    style={[styles.upgradeBtn, !canUpgrade && styles.upgradeBtnDisabled]}
                    onPress={() => upgradeUnit(u.id)}
                    disabled={!canUpgrade}
                  >
                    <Text style={styles.upgradeBtnText}>강화</Text>
                  </Pressable>
                </View>
              )}
              {unlocked && level >= 100 && (
                <Text style={styles.maxText}>MAX</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textMain },
  goldChip: { fontSize: 14, fontWeight: '600', color: Colors.gold },

  list: { paddingHorizontal: 14, paddingBottom: 32, gap: 8 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    gap: 8,
  },
  cardLocked: { opacity: 0.5 },

  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  unitIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(241,196,15,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(241,196,15,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitIconLocked: {
    backgroundColor: 'rgba(100,100,120,0.2)',
    borderColor: 'rgba(100,100,120,0.3)',
  },
  unitIconText: { fontSize: 18, fontWeight: '700', color: Colors.textMain },
  unitInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  unitName: { fontSize: 14, fontWeight: '600', color: Colors.textMain },
  lvBadge: {
    backgroundColor: 'rgba(160,100,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(160,100,255,0.4)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  lvText: { fontSize: 10, fontWeight: '700', color: 'rgba(190,150,255,0.9)' },
  lockBadge: {
    backgroundColor: 'rgba(93,173,226,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(93,173,226,0.3)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  lockText: { fontSize: 9, color: Colors.diamond },
  concept: { fontSize: 11, color: Colors.textSub },
  bonus: { fontSize: 11, color: 'rgba(100,220,120,0.9)' },

  upgradeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardProgress: { flex: 1, gap: 2 },
  cardProgressBg: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  cardProgressFill: { height: '100%', backgroundColor: Colors.diamond, borderRadius: 3 },
  cardCount: { fontSize: 10, color: Colors.textDim },
  goldCost: { fontSize: 11, fontWeight: '600', color: Colors.gold, minWidth: 60, textAlign: 'right' },
  upgradeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(241,196,15,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(241,196,15,0.45)',
  },
  upgradeBtnDisabled: { opacity: 0.35 },
  upgradeBtnText: { fontSize: 12, fontWeight: '700', color: Colors.gold },
  maxText: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.gold,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
