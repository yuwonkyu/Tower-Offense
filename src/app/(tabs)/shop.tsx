import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { HEROES } from '@/data/heroes';
import { BASE_UNITS } from '@/data/units';
import { NEW_ENEMY_UNITS } from '@/data/enemyUnits';
import type { HeroId, UnitId } from '@/game/types';
import { UNIT_GACHA_COST, HERO_GACHA_COST } from '@/game/formulas';
import { useProgressStore } from '@/store/progressStore';

const ALL_UNIT_MAP = new Map<UnitId, (typeof BASE_UNITS)[0]>(
  [...BASE_UNITS, ...NEW_ENEMY_UNITS].map((u) => [u.id as UnitId, u]),
);
const HERO_MAP = new Map<HeroId, (typeof HEROES)[0]>(HEROES.map((h) => [h.id, h]));

type GachaResult =
  | { type: 'unit'; items: { unitId: string; count: number; newlyUnlocked: boolean }[] }
  | { type: 'hero'; heroId: string; isDupe: boolean; expGained: number };

export default function ShopScreen() {
  const diamonds = useProgressStore((s) => s.diamonds);
  const gold = useProgressStore((s) => s.gold);
  const pullUnitGacha = useProgressStore((s) => s.pullUnitGacha);
  const pullHeroGacha = useProgressStore((s) => s.pullHeroGacha);

  const [result, setResult] = useState<GachaResult | null>(null);

  const handleUnitPull = () => {
    const items = pullUnitGacha();
    if (items.length > 0) setResult({ type: 'unit', items });
  };

  const handleHeroPull = () => {
    const res = pullHeroGacha();
    if (res.heroId) setResult({ type: 'hero', ...res });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>상점</Text>

      {/* 재화 표시 */}
      <View style={styles.walletRow}>
        <View style={styles.walletChip}>
          <Text style={styles.walletIcon}>◈</Text>
          <Text style={styles.walletAmount}>{gold.toLocaleString()}</Text>
          <Text style={styles.walletLabel}>금화</Text>
        </View>
        <View style={styles.walletChip}>
          <Text style={[styles.walletIcon, { color: Colors.diamond }]}>💎</Text>
          <Text style={[styles.walletAmount, { color: Colors.diamond }]}>{diamonds}</Text>
          <Text style={styles.walletLabel}>다이아</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {/* 유닛 가챠 */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>유닛 카드 소환</Text>
            <View style={styles.costChip}>
              <Text style={[styles.costText, { color: Colors.diamond }]}>💎 {UNIT_GACHA_COST}</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>
            랜덤 유닛 카드 {10}장 획득 · 미해금 유닛도 포함{'\n'}
            첫 획득 시 자동 해금 + 카드 보관함에 적립
          </Text>
          <Pressable
            style={[styles.pullBtn, diamonds < UNIT_GACHA_COST && styles.pullBtnDisabled]}
            onPress={handleUnitPull}
            disabled={diamonds < UNIT_GACHA_COST}
          >
            <Text style={styles.pullBtnText}>소환하기</Text>
          </Pressable>
        </View>

        {/* 영웅 가챠 */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>영웅 소환</Text>
            <View style={styles.costChip}>
              <Text style={[styles.costText, { color: Colors.diamond }]}>💎 {HERO_GACHA_COST}</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>
            랜덤 영웅 1회 소환 · 중복 시 해당 영웅 EXP 100 전환{'\n'}
            영웅 메타 레벨 = 스탯 포인트 + 스킬 포인트 원천
          </Text>
          <Pressable
            style={[styles.pullBtn, styles.pullBtnHero, diamonds < HERO_GACHA_COST && styles.pullBtnDisabled]}
            onPress={handleHeroPull}
            disabled={diamonds < HERO_GACHA_COST}
          >
            <Text style={styles.pullBtnText}>소환하기</Text>
          </Pressable>
        </View>

        {/* IAP 스텁 */}
        <View style={[styles.card, styles.cardIap]}>
          <Text style={styles.cardTitle}>다이아 패키지</Text>
          <Text style={styles.cardDesc}>결제 연동 예정 (IAP)</Text>
        </View>
        <View style={[styles.card, styles.cardIap]}>
          <Text style={styles.cardTitle}>광고 제거 + x4 영구</Text>
          <Text style={styles.cardDesc}>평생 1회 결제 · 광고 제거 + x4 배속 영구 해금 (IAP)</Text>
        </View>
      </ScrollView>

      {/* 결과 모달 */}
      {result && (
        <Modal transparent animationType="fade" statusBarTranslucent>
          <Pressable style={styles.resultBackdrop} onPress={() => setResult(null)}>
            <View style={styles.resultCard}>
              {result.type === 'unit' ? (
                <>
                  <Text style={styles.resultTitle}>유닛 카드 획득!</Text>
                  {result.items.map((item) => {
                    const u = ALL_UNIT_MAP.get(item.unitId as UnitId);
                    return (
                      <View key={item.unitId} style={styles.resultRow}>
                        <Text style={styles.resultName}>{u?.name ?? item.unitId}</Text>
                        <View style={styles.resultRight}>
                          {item.newlyUnlocked && (
                            <View style={styles.newBadge}><Text style={styles.newText}>NEW</Text></View>
                          )}
                          <Text style={styles.resultCount}>×{item.count}</Text>
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : (
                <>
                  <Text style={styles.resultTitle}>영웅 소환!</Text>
                  <Text style={styles.resultHeroName}>
                    {HERO_MAP.get(result.heroId as HeroId)?.name ?? result.heroId}
                  </Text>
                  {result.isDupe && (
                    <Text style={styles.resultDupe}>중복 — EXP +{result.expGained}</Text>
                  )}
                </>
              )}
              <Text style={styles.resultClose}>탭하여 닫기</Text>
            </View>
          </Pressable>
        </Modal>
      )}
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

  walletRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  walletIcon: { fontSize: 13, color: Colors.gold },
  walletAmount: { fontSize: 14, fontWeight: '700', color: Colors.gold },
  walletLabel: { fontSize: 10, color: Colors.textDim },

  list: { paddingHorizontal: 14, paddingBottom: 32, gap: 10 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    gap: 8,
  },
  cardIap: { opacity: 0.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textMain },
  costChip: {
    backgroundColor: 'rgba(93,173,226,0.12)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(93,173,226,0.3)',
  },
  costText: { fontSize: 13, fontWeight: '600' },
  cardDesc: { fontSize: 12, color: Colors.textSub, lineHeight: 18 },
  pullBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(241,196,15,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(241,196,15,0.4)',
    alignItems: 'center',
  },
  pullBtnHero: {
    backgroundColor: 'rgba(160,100,255,0.18)',
    borderColor: 'rgba(160,100,255,0.4)',
  },
  pullBtnDisabled: { opacity: 0.3 },
  pullBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textMain },

  resultBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  resultCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    gap: 10,
  },
  resultTitle: { fontSize: 18, fontWeight: '800', color: Colors.gold, textAlign: 'center' },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  resultName: { fontSize: 13, color: Colors.textMain },
  resultRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  newBadge: {
    backgroundColor: 'rgba(100,200,100,0.2)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(100,200,100,0.4)',
  },
  newText: { fontSize: 9, fontWeight: '700', color: 'rgba(120,220,120,0.9)' },
  resultCount: { fontSize: 14, fontWeight: '700', color: Colors.textMain },
  resultHeroName: { fontSize: 22, fontWeight: '700', color: Colors.textMain, textAlign: 'center' },
  resultDupe: { fontSize: 13, color: Colors.diamond, textAlign: 'center' },
  resultClose: { fontSize: 11, color: Colors.textDim, textAlign: 'center', marginTop: 6 },
});
