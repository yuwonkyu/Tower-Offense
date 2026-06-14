import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdStubModal } from '@/components/AdStubModal';
import { Colors } from '@/constants/theme';
import { HEROES } from '@/data/heroes';
import { BASE_UNITS } from '@/data/units';
import { NEW_ENEMY_UNITS } from '@/data/enemyUnits';
import type { HeroId, UnitId } from '@/game/types';
import {
  bulkGachaCost,
  DAILY_GIFT,
  GACHA_TIERS,
  GOLD_SHOP_PACKS,
  HERO_GACHA_COST,
  UNIT_GACHA_CARDS,
  UNIT_GACHA_COST,
} from '@/game/formulas';
import { useProgressStore } from '@/store/progressStore';
import {
  AD_FREE_DIAMONDS,
  DIAMOND_PACK_IDS,
  IAP_PRODUCTS,
  useMonetizationStore,
  type IapProductId,
} from '@/store/monetizationStore';

const ALL_UNIT_MAP = new Map<UnitId, (typeof BASE_UNITS)[0]>(
  [...BASE_UNITS, ...NEW_ENEMY_UNITS].map((u) => [u.id as UnitId, u]),
);
const HERO_MAP = new Map<HeroId, (typeof HEROES)[0]>(HEROES.map((h) => [h.id, h]));

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

type GachaResult =
  | { type: 'unit'; items: { unitId: string; count: number; newlyUnlocked: boolean }[] }
  | { type: 'hero'; heroes: { heroId: string; count: number }[]; totalExp: number }
  | { type: 'gift'; gold: number; diamonds: number };

export default function ShopScreen() {
  const diamonds = useProgressStore((s) => s.diamonds);
  const gold = useProgressStore((s) => s.gold);
  const dailyGiftDate = useProgressStore((s) => s.dailyGiftDate);
  const pullUnitGacha = useProgressStore((s) => s.pullUnitGacha);
  const pullHeroGacha = useProgressStore((s) => s.pullHeroGacha);
  const buyGoldPack = useProgressStore((s) => s.buyGoldPack);
  const claimDailyGift = useProgressStore((s) => s.claimDailyGift);
  const addDiamonds = useProgressStore((s) => s.addDiamonds);

  const adFree = useMonetizationStore((s) => s.adFree);
  const canWatchAd = useMonetizationStore((s) => s.canWatchAd);
  const purchase = useMonetizationStore((s) => s.purchase);

  const [result, setResult] = useState<GachaResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [adVisible, setAdVisible] = useState(false);

  const canClaimGift = dailyGiftDate !== todayStr();

  const handleUnitPull = (times: number) => {
    const items = pullUnitGacha(times);
    if (items.length > 0) setResult({ type: 'unit', items });
  };
  const handleHeroPull = (times: number) => {
    const res = pullHeroGacha(times);
    if (res.heroes.length > 0) setResult({ type: 'hero', ...res });
  };
  const handleBuyGold = (i: number) => {
    if (buyGoldPack(i)) setToast(`금화 +${GOLD_SHOP_PACKS[i].gold.toLocaleString()} 획득`);
  };
  const handleClaimGift = () => {
    const g = claimDailyGift();
    if (g) setResult({ type: 'gift', ...g });
  };
  const handlePurchase = (id: IapProductId) => {
    if (purchase(id)) setToast(`${IAP_PRODUCTS[id].name} 구매 완료`);
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
          <Text style={[styles.walletAmount, { color: Colors.diamond }]}>{diamonds.toLocaleString()}</Text>
          <Text style={styles.walletLabel}>다이아</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {/* 일일 무료 선물 */}
        <View style={[styles.card, styles.giftCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🎁 일일 무료 선물</Text>
            {!canClaimGift && <Text style={styles.giftDone}>오늘 받음 ✓</Text>}
          </View>
          <Text style={styles.cardDesc}>
            매일 접속 보상 · 금화 {DAILY_GIFT.gold.toLocaleString()} + 다이아 {DAILY_GIFT.diamonds}
          </Text>
          <Pressable
            style={[styles.pullBtn, styles.giftBtn, !canClaimGift && styles.pullBtnDisabled]}
            onPress={handleClaimGift}
            disabled={!canClaimGift}
          >
            <Text style={styles.pullBtnText}>{canClaimGift ? '받기' : '내일 다시'}</Text>
          </Pressable>
        </View>

        {/* 유닛 카드 소환 */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>유닛 카드 소환</Text>
            <Text style={styles.cardSubInfo}>1회 {UNIT_GACHA_CARDS}장 · 💎{UNIT_GACHA_COST}/회</Text>
          </View>
          <Text style={styles.cardDesc}>랜덤 유닛 카드 · 미해금 유닛 첫 획득 시 자동 해금</Text>
          <View style={styles.tierRow}>
            {GACHA_TIERS.map((t) => {
              const cost = bulkGachaCost(UNIT_GACHA_COST, t.times, t.discountPct);
              const afford = diamonds >= cost;
              return (
                <Pressable
                  key={t.times}
                  style={[styles.tierBtn, !afford && styles.pullBtnDisabled]}
                  onPress={() => handleUnitPull(t.times)}
                  disabled={!afford}
                >
                  <Text style={styles.tierLabel}>{t.label}</Text>
                  <Text style={styles.tierCost}>💎{cost.toLocaleString()}</Text>
                  {t.discountPct > 0 && <Text style={styles.tierDiscount}>-{t.discountPct}%</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 영웅 소환 */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>영웅 소환</Text>
            <Text style={styles.cardSubInfo}>중복 = EXP 전환 · 💎{HERO_GACHA_COST}/회</Text>
          </View>
          <Text style={styles.cardDesc}>랜덤 영웅 소환 · 영웅 메타 레벨(스탯·스킬 포인트) 원천</Text>
          <View style={styles.tierRow}>
            {GACHA_TIERS.map((t) => {
              const cost = bulkGachaCost(HERO_GACHA_COST, t.times, t.discountPct);
              const afford = diamonds >= cost;
              return (
                <Pressable
                  key={t.times}
                  style={[styles.tierBtn, styles.tierBtnHero, !afford && styles.pullBtnDisabled]}
                  onPress={() => handleHeroPull(t.times)}
                  disabled={!afford}
                >
                  <Text style={styles.tierLabel}>{t.label}</Text>
                  <Text style={styles.tierCost}>💎{cost.toLocaleString()}</Text>
                  {t.discountPct > 0 && <Text style={styles.tierDiscount}>-{t.discountPct}%</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 골드 상점 (다이아로 구매) */}
        <Text style={styles.sectionLabel}>골드 상점 (다이아로 구매)</Text>
        {GOLD_SHOP_PACKS.map((pack, i) => {
          const afford = diamonds >= pack.diamonds;
          return (
            <View key={i} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  ◈ 금화 {pack.gold.toLocaleString()}
                  {pack.bonusLabel ? <Text style={styles.bonusTag}>  {pack.bonusLabel}</Text> : null}
                </Text>
                <View style={styles.costChip}>
                  <Text style={[styles.costText, { color: Colors.diamond }]}>💎 {pack.diamonds}</Text>
                </View>
              </View>
              <Pressable
                style={[styles.pullBtn, !afford && styles.pullBtnDisabled]}
                onPress={() => handleBuyGold(i)}
                disabled={!afford}
              >
                <Text style={styles.pullBtnText}>{afford ? '구매' : '다이아 부족'}</Text>
              </Pressable>
            </View>
          );
        })}

        {/* 다이아 충전 (현금 IAP 스텁) */}
        <Text style={styles.sectionLabel}>다이아 충전 (IAP 스텁)</Text>
        {DIAMOND_PACK_IDS.map((id) => (
          <View key={id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                💎 {IAP_PRODUCTS[id].name}
                {IAP_PRODUCTS[id].bonusLabel ? (
                  <Text style={styles.bonusTag}>  {IAP_PRODUCTS[id].bonusLabel}</Text>
                ) : null}
              </Text>
              <View style={styles.costChip}>
                <Text style={[styles.costText, { color: Colors.textMain }]}>
                  {IAP_PRODUCTS[id].priceLabel}
                </Text>
              </View>
            </View>
            <Pressable style={styles.pullBtn} onPress={() => handlePurchase(id)}>
              <Text style={styles.pullBtnText}>구매 (스텁)</Text>
            </Pressable>
          </View>
        ))}

        {/* 무료 다이아 (IAA) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>무료 다이아</Text>
            <View style={styles.costChip}>
              <Text style={[styles.costText, { color: Colors.gold }]}>📺 광고</Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>광고 시청 → 다이아 {AD_FREE_DIAMONDS}개 (일일 한도 공유)</Text>
          <Pressable
            style={[styles.pullBtn, !canWatchAd() && styles.pullBtnDisabled]}
            onPress={() => setAdVisible(true)}
            disabled={!canWatchAd()}
          >
            <Text style={styles.pullBtnText}>{canWatchAd() ? '광고 보기' : '오늘 한도 소진'}</Text>
          </Pressable>
        </View>

        {/* 광고 제거 buyout */}
        <View style={[styles.card, adFree && styles.cardOwned]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{IAP_PRODUCTS.adFree.name}</Text>
            <View style={styles.costChip}>
              <Text style={[styles.costText, { color: Colors.textMain }]}>
                {adFree ? '보유' : IAP_PRODUCTS.adFree.priceLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.cardDesc}>
            평생 1회 결제 · 광고 제거 + x4 배속 영구 + 카드 리롤 무제한(광고X) + 정산 획득 금화 2배
          </Text>
          {!adFree && (
            <Pressable style={styles.pullBtn} onPress={() => handlePurchase('adFree')}>
              <Text style={styles.pullBtnText}>구매 (스텁)</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* 무료 다이아 광고 */}
      <AdStubModal
        visible={adVisible}
        onReward={() => {
          addDiamonds(AD_FREE_DIAMONDS);
          setAdVisible(false);
        }}
        onClose={() => setAdVisible(false)}
      />

      {/* 간단 확인 토스트 (골드 구매 / IAP) */}
      {toast && (
        <Modal transparent animationType="fade" statusBarTranslucent>
          <Pressable style={styles.resultBackdrop} onPress={() => setToast(null)}>
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>완료</Text>
              <Text style={styles.resultHeroName}>{toast}</Text>
              <Text style={styles.resultClose}>탭하여 닫기</Text>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* 결과 모달 (소환 / 일일선물) */}
      {result && (
        <Modal transparent animationType="fade" statusBarTranslucent>
          <Pressable style={styles.resultBackdrop} onPress={() => setResult(null)}>
            <View style={styles.resultCard}>
              {result.type === 'unit' ? (
                <>
                  <Text style={styles.resultTitle}>유닛 카드 획득!</Text>
                  <ScrollView style={styles.resultScroll}>
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
                  </ScrollView>
                </>
              ) : result.type === 'hero' ? (
                <>
                  <Text style={styles.resultTitle}>영웅 소환!</Text>
                  <ScrollView style={styles.resultScroll}>
                    {result.heroes.map((h) => (
                      <View key={h.heroId} style={styles.resultRow}>
                        <Text style={styles.resultName}>
                          {HERO_MAP.get(h.heroId as HeroId)?.name ?? h.heroId}
                        </Text>
                        <Text style={styles.resultCount}>×{h.count}</Text>
                      </View>
                    ))}
                  </ScrollView>
                  <Text style={styles.resultDupe}>중복 EXP 총 +{result.totalExp}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.resultTitle}>🎁 일일 선물</Text>
                  <Text style={styles.resultHeroName}>
                    금화 +{result.gold.toLocaleString()} · 다이아 +{result.diamonds}
                  </Text>
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
  cardOwned: { opacity: 0.6, borderColor: 'rgba(100,200,100,0.35)' },
  giftCard: { borderColor: 'rgba(241,196,15,0.45)', backgroundColor: 'rgba(241,196,15,0.07)' },
  giftBtn: { backgroundColor: 'rgba(241,196,15,0.25)', borderColor: 'rgba(241,196,15,0.55)' },
  giftDone: { fontSize: 11, color: 'rgba(120,220,120,0.9)', fontWeight: '600' },
  sectionLabel: { fontSize: 12, color: Colors.gold, fontWeight: '600', marginTop: 6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.textMain, flexShrink: 1 },
  cardSubInfo: { fontSize: 10, color: Colors.textDim },
  bonusTag: { fontSize: 11, color: 'rgba(120,220,120,0.95)', fontWeight: '700' },
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

  tierRow: { flexDirection: 'row', gap: 8 },
  tierBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(241,196,15,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(241,196,15,0.4)',
    alignItems: 'center',
    gap: 1,
  },
  tierBtnHero: {
    backgroundColor: 'rgba(160,100,255,0.18)',
    borderColor: 'rgba(160,100,255,0.4)',
  },
  tierLabel: { fontSize: 14, fontWeight: '800', color: Colors.textMain },
  tierCost: { fontSize: 11, color: Colors.diamond, fontWeight: '600' },
  tierDiscount: { fontSize: 9, color: 'rgba(120,220,120,0.95)', fontWeight: '700' },

  pullBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(241,196,15,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(241,196,15,0.4)',
    alignItems: 'center',
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
  resultScroll: { maxHeight: 280 },
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
  resultHeroName: { fontSize: 20, fontWeight: '700', color: Colors.textMain, textAlign: 'center' },
  resultDupe: { fontSize: 13, color: Colors.diamond, textAlign: 'center' },
  resultClose: { fontSize: 11, color: Colors.textDim, textAlign: 'center', marginTop: 6 },
});
