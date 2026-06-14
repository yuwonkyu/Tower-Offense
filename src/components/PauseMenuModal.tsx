import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { cardById } from '@/data/cards';
import type { CardKind } from '@/game/types';

interface Props {
  /** 보유 카드 (cardId → 레벨) */
  pickedCards: Record<string, number>;
  onResume: () => void;
  onRetry: () => void;
  onExit: () => void;
}

const KIND_LABEL: Record<CardKind, string> = { unit: '유닛', trait: '특성', global: '글로벌' };
const KIND_COLOR: Record<CardKind, string> = {
  unit: 'rgba(230,200,90,0.95)',
  trait: 'rgba(210,210,230,0.9)',
  global: 'rgba(130,230,130,0.9)',
};

/** 카드 효과 키 → 한글 라벨 (수치 표시용) */
const EFFECT_LABEL: Record<string, string> = {
  hpPct: '체력',
  defPct: '방어',
  atkPct: '공격',
  atkSpeedPct: '공속',
  moveSpeedPct: '이속',
  rangePct: '사거리',
  aoePct: '범위',
  critChance: '치명타',
  evadePct: '회피',
  lifestealPct: '흡혈',
  regenPctPerSec: '체젠',
  frenzyAtkPct: '광폭화',
  tauntChance: '도발',
  pierceChance: '관통',
  dmgReductionPct: '피해감소',
  chargeDmgPct: '돌진',
  expPct: '경험치',
  spawnSpeedPct: '생성속도',
  cdrPct: '쿨감',
  goldPct: '골드',
  heroStatPct: '영웅',
  reviveCdrPct: '부활단축',
  chance: '발동',
  bonusDmgPct: '추가피해',
  dotPct: '출혈',
  burnPct: '화상',
  stunSec: '기절',
  cooldownSec: '쿨타임',
  auraDmgReductionPct: '수호오라',
  multishot: '멀티샷',
  healBonusPct: '치유량',
};

/** 효과 1레벨 묶음을 "공격 +24% · 발동 30%" 형태로 포맷 */
function formatEffect(effect: Record<string, number>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(effect)) {
    const label = EFFECT_LABEL[key] ?? key;
    const signed = `${val > 0 ? '+' : ''}${val}`;
    if (key.endsWith('Sec')) parts.push(`${label} ${val}초`);
    else if (key === 'dotPct' || key === 'burnPct') parts.push(`${label} ${val}%/s`);
    else if (key === 'multishot') parts.push(`${label} +${val}타`);
    else parts.push(`${label} ${signed}%`);
  }
  return parts.join(' · ');
}

/** 일시정지 메뉴 + 보유 카드 수치 (피드백 10) */
export function PauseMenuModal({ pickedCards, onResume, onRetry, onExit }: Props) {
  const entries = Object.entries(pickedCards);

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <Text style={styles.title}>일시정지</Text>

        <Text style={styles.sectionTitle}>보유 카드 ({entries.length})</Text>
        <ScrollView style={styles.cardList} contentContainerStyle={styles.cardListContent}>
          {entries.length === 0 ? (
            <Text style={styles.emptyText}>아직 선택한 카드가 없습니다</Text>
          ) : (
            entries.map(([id, lv]) => {
              const card = cardById(id);
              if (!card) return null;
              const effect = card.levels[lv - 1];
              const isUnit = card.kind === 'unit';
              const levelName = isUnit ? card.levelNames?.[lv - 1] : undefined;
              const effectText = effect ? formatEffect(effect) : '';
              return (
                <View key={id} style={styles.cardItem}>
                  <View style={styles.cardItemHeader}>
                    <Text style={[styles.cardKind, { color: KIND_COLOR[card.kind] }]}>
                      {KIND_LABEL[card.kind]}
                    </Text>
                    <Text style={styles.cardName}>{card.name}</Text>
                    <Text style={styles.cardLv}>Lv.{lv}</Text>
                  </View>
                  <Text style={styles.cardEffect}>
                    {isUnit
                      ? `${levelName ?? ''}${effectText ? ` · ${effectText}` : ''}`
                      : effectText || card.description}
                  </Text>
                </View>
              );
            })
          )}
        </ScrollView>

        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onResume}>
          <Text style={styles.btnPrimaryText}>계속하기</Text>
        </Pressable>
        <View style={styles.btnRow}>
          <Pressable style={[styles.btn, styles.btnSub]} onPress={onRetry}>
            <Text style={styles.btnSubText}>다시 시작</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnSub]} onPress={onExit}>
            <Text style={styles.btnSubText}>홈으로</Text>
          </Pressable>
        </View>
      </View>
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
    paddingHorizontal: 20,
    zIndex: 10,
  },
  panel: {
    alignSelf: 'stretch',
    backgroundColor: Colors.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 18,
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textMain, textAlign: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textSub, marginTop: 4 },
  cardList: { maxHeight: 240, alignSelf: 'stretch' },
  cardListContent: { gap: 6 },
  emptyText: { fontSize: 12, color: Colors.textDim, textAlign: 'center', paddingVertical: 16 },
  cardItem: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 3,
  },
  cardItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardKind: { fontSize: 9, fontWeight: '700' },
  cardName: { fontSize: 13, fontWeight: '700', color: Colors.textMain, flex: 1 },
  cardLv: { fontSize: 11, fontWeight: '700', color: 'rgba(120,200,255,0.9)' },
  cardEffect: { fontSize: 11, color: Colors.textSub, lineHeight: 15 },

  btn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: Colors.skill, marginTop: 4 },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnRow: { flexDirection: 'row', gap: 8 },
  btnSub: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  btnSubText: { fontSize: 13, fontWeight: '600', color: Colors.textSub },
});
