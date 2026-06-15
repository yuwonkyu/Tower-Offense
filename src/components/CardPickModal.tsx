import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { CARD_MAX_LEVEL } from '@/data/cards';
import type { CardDef, CardKind } from '@/game/types';

const KIND_LABEL: Record<CardKind, string> = {
  unit: '유닛',
  trait: '특성',
  global: '글로벌',
};

const KIND_STYLE: Record<CardKind, { bg: string; border: string; text: string }> = {
  unit: { bg: Colors.cardUnit, border: Colors.cardUnitBorder, text: 'rgba(230,200,90,0.95)' },
  trait: { bg: Colors.cardTrait, border: Colors.cardTraitBorder, text: 'rgba(210,210,230,0.9)' },
  global: { bg: Colors.cardGlobal, border: Colors.cardGlobalBorder, text: 'rgba(130,230,130,0.9)' },
};

/** 유닛 카드의 특수기술 발동 레벨 (Lv3·Lv5) — 도트/노트 강조용 */
const SPECIAL_LEVELS = new Set([3, 5]);

interface Props {
  /** 선택지 3장 */
  choices: CardDef[];
  /** 보유 카드 레벨 (cardId → 현재 레벨) */
  ownedLevels: Record<string, number>;
  /** 남은 선택 시간 (초) */
  timeLeft: number;
  /** 전체 선택 시간 (초) */
  totalTime: number;
  /** 현재 영웅 레벨 */
  level: number;
  onPick: (cardId: string) => void;
  /** 리롤 버튼 (광고) — undefined면 숨김 */
  onReroll?: () => void;
  /** 이번 픽에서 리롤 사용 완료 (픽당 1회) */
  rerollUsed?: boolean;
  /** 프리미엄 패스 = 광고 없이 무료 리롤 (여전히 픽당 1회) */
  rerollFree?: boolean;
}

/** TFT 스타일 카드 선택 오버레이 — 미선택 시 랜덤 (설계 07) */
export function CardPickModal({
  choices,
  ownedLevels,
  timeLeft,
  totalTime,
  level,
  onPick,
  onReroll,
  rerollUsed,
  rerollFree,
}: Props) {
  const timerPct = totalTime > 0 ? Math.max(0, timeLeft / totalTime) : 0;

  return (
    <View style={styles.overlay}>
      <Text style={styles.title}>카드 선택</Text>
      <Text style={styles.subtitle}>Lv.{level} 달성 — 1장을 선택하세요</Text>

      <View style={styles.cardRow}>
        {choices.map((card) => {
          const kindStyle = KIND_STYLE[card.kind];
          const isRare = card.rarity === 'rare';
          const curLv = ownedLevels[card.id] ?? 0;
          const nextLv = curLv + 1;
          // 유닛 카드가 이번 픽으로 특수기술(Lv3/5)을 발동시키는지
          const unlocksSpecial = card.kind === 'unit' && SPECIAL_LEVELS.has(nextLv);
          return (
            <Pressable
              key={card.id}
              style={[
                styles.card,
                { backgroundColor: kindStyle.bg, borderColor: kindStyle.border },
                isRare && styles.cardRare,
                unlocksSpecial && styles.cardSpecial,
              ]}
              onPress={() => onPick(card.id)}
            >
              {unlocksSpecial && (
                <View style={styles.specialBadge}>
                  <Text style={styles.specialBadgeText}>✦ 특수기술</Text>
                </View>
              )}
              <View style={styles.cardHeader}>
                <Text style={[styles.kindLabel, { color: kindStyle.text }]}>
                  {KIND_LABEL[card.kind]}
                </Text>
                <Text style={[styles.rarityLabel, isRare && styles.rarityRare]}>
                  {isRare ? '고급' : '일반'}
                </Text>
              </View>

              <Text style={styles.cardName}>{card.name}</Text>
              <Text style={styles.cardDesc} numberOfLines={3}>
                {card.description}
              </Text>

              <View style={styles.levelDots}>
                {Array.from({ length: CARD_MAX_LEVEL }, (_, i) => {
                  // 유닛 카드는 Lv3/5(=index 2/4)가 특수기술 발동 레벨
                  const isSpecialLv = card.kind === 'unit' && SPECIAL_LEVELS.has(i + 1);
                  return (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        isSpecialLv && styles.dotSpecial,
                        i < curLv && (isSpecialLv ? styles.dotSpecialOwned : styles.dotOwned),
                        i === nextLv - 1 && styles.dotNext,
                      ]}
                    />
                  );
                })}
                <Text style={styles.levelText}>
                  {curLv > 0 ? `Lv.${curLv} → ${nextLv}` : `Lv.${nextLv}`}
                  {nextLv >= CARD_MAX_LEVEL ? ' MAX' : ''}
                </Text>
              </View>
              {card.kind === 'unit' && card.levelNames && (
                <Text style={[styles.unitNote, unlocksSpecial && styles.unitNoteSpecial]}>
                  {unlocksSpecial ? '✦ ' : '▸ '}
                  {card.levelNames[Math.min(nextLv, CARD_MAX_LEVEL) - 1]}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* 카드 재선택 — 픽당 1회 (프리미엄=무료·광고X / 일반=광고, 설계 06 IAA) */}
      {onReroll && (
        <Pressable
          style={[styles.rerollBtn, rerollUsed && styles.rerollBtnUsed]}
          onPress={onReroll}
          disabled={rerollUsed}
        >
          <Text style={styles.rerollText}>
            {rerollUsed
              ? '재선택 사용됨'
              : rerollFree
                ? '🔄 무료 재선택'
                : '📺 광고 보고 재선택'}
          </Text>
        </Pressable>
      )}

      {/* 선택 타이머 — 만료 시 랜덤 선택 */}
      <View style={styles.timerBar}>
        <View style={[styles.timerFill, { width: `${timerPct * 100}%` }]} />
      </View>
      <Text style={styles.timerText}>{Math.ceil(timeLeft)}초 — 시간 초과 시 무작위 선택</Text>
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
    paddingHorizontal: 14,
    zIndex: 5,
  },
  title: { fontSize: 22, fontWeight: '800', color: Colors.gold },
  subtitle: { fontSize: 12, color: Colors.textSub, marginTop: 4, marginBottom: 18 },

  cardRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  card: {
    flex: 1,
    minHeight: 170,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  cardRare: {
    borderColor: 'rgba(190,140,255,0.85)',
    shadowColor: '#a064ff',
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  cardSpecial: {
    borderColor: 'rgba(255,180,80,0.95)',
    borderWidth: 2,
    shadowColor: '#ffb450',
    shadowOpacity: 0.7,
    shadowRadius: 9,
    elevation: 7,
  },
  specialBadge: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    backgroundColor: '#ffb450',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 1,
  },
  specialBadgeText: { fontSize: 9, fontWeight: '800', color: '#3a2400' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kindLabel: { fontSize: 10, fontWeight: '700' },
  rarityLabel: { fontSize: 10, color: Colors.textDim },
  rarityRare: { color: 'rgba(190,140,255,0.95)', fontWeight: '700' },

  cardName: { fontSize: 15, fontWeight: '700', color: Colors.textMain },
  cardDesc: { fontSize: 11, lineHeight: 15, color: Colors.textSub, flex: 1 },

  unitNote: { fontSize: 11, fontWeight: '600', color: 'rgba(230,200,90,0.9)' },
  unitNoteSpecial: { color: 'rgba(255,190,90,0.98)', fontWeight: '800' },
  levelDots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dotOwned: { backgroundColor: 'rgba(220,190,80,0.85)' },
  // 특수기술 레벨(Lv3/5): 미보유 시 주황 외곽선, 보유 시 채워진 주황
  dotSpecial: {
    borderWidth: 1,
    borderColor: 'rgba(255,180,80,0.85)',
    backgroundColor: 'rgba(255,180,80,0.18)',
  },
  dotSpecialOwned: { backgroundColor: 'rgba(255,180,80,0.95)' },
  dotNext: {
    backgroundColor: 'rgba(120,200,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(180,230,255,0.9)',
  },
  levelText: { fontSize: 10, color: Colors.textSub, marginLeft: 4 },

  rerollBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(93,173,226,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(93,173,226,0.4)',
  },
  rerollBtnUsed: { opacity: 0.35 },
  rerollText: { fontSize: 12, fontWeight: '600', color: Colors.diamond },

  timerBar: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 20,
    overflow: 'hidden',
  },
  timerFill: { height: '100%', backgroundColor: Colors.timer, borderRadius: 3 },
  timerText: { fontSize: 11, color: Colors.textDim, marginTop: 6 },
});
