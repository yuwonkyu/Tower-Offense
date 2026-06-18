import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { cardById } from '@/data/cards';
import type { HeroDef } from '@/game/types';
import { useBattleStore } from '@/store/battleStore';

const CARD_SLOTS = 8;

interface HeroStatsSnap {
  atk: number;
  def: number;
  hp: number;
  maxHp: number;
  atkSpeed: number;
  crit: number;
  evade: number;
  moveSpeed: number;
  range: number;
}

interface Props {
  hero: HeroDef;
  onUseSkill: () => void;
}

/**
 * 하단 패널: 영웅 아이콘(부활) · Lv/HP · 카드 슬롯 8 · 스킬 버튼 · EXP 텍스트.
 * 영웅/카드 관련 값만 구독 → 타워바/필드HUD/캔버스와 분리.
 */
export const HeroPanel = memo(function HeroPanel({ hero, onUseSkill }: Props) {
  const heroLevel = useBattleStore((s) => s.heroLevel);
  const heroHp = useBattleStore((s) => s.heroHp);
  const heroMaxHp = useBattleStore((s) => s.heroMaxHp);
  const reviveLeft = useBattleStore((s) => s.reviveLeft);
  const skillCooldown = useBattleStore((s) => s.skillCooldown);
  const pickedCards = useBattleStore((s) => s.pickedCards);
  const exp = useBattleStore((s) => s.exp);
  const expToNext = useBattleStore((s) => s.expToNext);

  const heroPct = heroMaxHp > 0 ? heroHp / heroMaxHp : 0;
  const skillReady = skillCooldown <= 0;
  const cardIds = Object.keys(pickedCards);

  // 영웅 프로필을 누르고 있는 동안만 현재 스탯 표시 (피드백 8 → 결정 2)
  const [stats, setStats] = useState<HeroStatsSnap | null>(null);
  const openStats = () => {
    const h = useBattleStore.getState().engine?.hero;
    if (!h) return;
    setStats({
      atk: h.atk,
      def: h.def,
      hp: h.hp,
      maxHp: h.maxHp,
      atkSpeed: h.atkSpeed,
      crit: h.critChance,
      evade: h.evade,
      moveSpeed: h.moveSpeed,
      range: h.range,
    });
  };
  const statRows: [string, string | number][] = stats
    ? [
        ['공격력', Math.round(stats.atk)],
        ['방어력', Math.round(stats.def)],
        ['체력', `${Math.ceil(stats.hp)} / ${Math.round(stats.maxHp)}`],
        ['공격속도', stats.atkSpeed.toFixed(2)],
        ['치명타', `${Math.round(stats.crit * 100)}%`],
        ['회피', `${Math.round(stats.evade * 100)}%`],
        ['이동속도', stats.moveSpeed.toFixed(1)],
        ['사거리', stats.range.toFixed(1)],
      ]
    : [];

  return (
    <View style={styles.bottomPanel}>
      <View style={styles.bottomRow}>
        <Pressable
          style={styles.heroIcon}
          onPressIn={openStats}
          onPressOut={() => setStats(null)}
        >
          <Text style={styles.heroIconText}>{hero.name[0]}</Text>
          {reviveLeft > 0 && (
            <View style={styles.reviveOverlay}>
              <Text style={styles.reviveText}>{Math.ceil(reviveLeft)}</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.heroInfo}>
          <View style={styles.heroInfoRow}>
            <View style={styles.heroNameWrap}>
              <View style={styles.lvBadge}>
                <Text style={styles.lvText}>Lv.{heroLevel}</Text>
              </View>
              <Text style={styles.nickname}>{hero.name}</Text>
            </View>
            <Text style={styles.heroHpText}>
              {Math.ceil(heroHp)} / {heroMaxHp}
            </Text>
          </View>
          <View style={styles.heroHpBar}>
            <View style={[styles.heroHpFill, { width: `${heroPct * 100}%` }]} />
          </View>
          <View style={styles.cardRow}>
            {Array.from({ length: CARD_SLOTS }, (_, i) => {
              const cardId = cardIds[i];
              const card = cardId ? cardById(cardId) : undefined;
              const lv = cardId ? pickedCards[cardId] : 0;
              return (
                <View key={i} style={[styles.cardSlot, !cardId && styles.cardSlotEmpty]}>
                  {card ? (
                    <>
                      <Text style={styles.cardSlotText}>{card.name.slice(0, 2)}</Text>
                      <Text style={styles.cardSlotLv}>{lv}</Text>
                    </>
                  ) : (
                    <Text style={styles.cardSlotPlus}>+</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <Pressable
          style={[styles.skillBtn, !skillReady && styles.skillBtnCooldown]}
          onPress={onUseSkill}
          disabled={!skillReady}
        >
          <Text style={styles.skillText}>{skillReady ? hero.skill.name : Math.ceil(skillCooldown)}</Text>
        </Pressable>
      </View>

      <Text style={styles.expText}>
        EXP {exp.toLocaleString()} / {expToNext.toLocaleString()}
      </Text>

      {/* 영웅 스탯 — 프로필 위에 떠서 표시 (누르는 동안만, 전투 화면은 그대로 보임) */}
      {stats && (
        <View style={styles.statPopup} pointerEvents="none">
          <Text style={styles.statTitle}>{hero.name} · 현재 스탯</Text>
          <View style={styles.statGrid}>
            {statRows.map(([k, v]) => (
              <View key={k} style={styles.statItem}>
                <Text style={styles.statKey}>{k}</Text>
                <Text style={styles.statVal}>{v}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  bottomPanel: {
    backgroundColor: Colors.panel,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 2,
  },
  bottomRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  heroIcon: {
    width: 52,
    borderRadius: 8,
    backgroundColor: Colors.hero,
    borderWidth: 1.5,
    borderColor: Colors.heroBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconText: { fontSize: 20, fontWeight: '700', color: Colors.heroText },
  reviveOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviveText: { fontSize: 18, fontWeight: '700', color: Colors.enemyHp },
  heroInfo: { flex: 1, gap: 4 },
  heroInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lvBadge: {
    backgroundColor: 'rgba(160,100,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(160,100,255,0.4)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  lvText: { fontSize: 10, color: 'rgba(190,150,255,0.9)' },
  nickname: { fontSize: 13, fontWeight: '600', color: Colors.textMain },
  heroHpText: { fontSize: 10, color: Colors.allyHp },
  heroHpBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  heroHpFill: { height: '100%', backgroundColor: Colors.allyHp, borderRadius: 3 },
  cardRow: { flexDirection: 'row', gap: 3 },
  cardSlot: {
    flex: 1,
    height: 30,
    borderRadius: 4,
    backgroundColor: Colors.cardUnit,
    borderWidth: 1,
    borderColor: Colors.cardUnitBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSlotEmpty: {
    backgroundColor: Colors.cardEmpty,
    borderColor: Colors.cardEmptyBorder,
    borderStyle: 'dashed',
  },
  cardSlotText: { fontSize: 9, color: 'rgba(220,190,80,0.85)' },
  cardSlotLv: {
    position: 'absolute',
    top: 1,
    right: 3,
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(120,200,255,0.9)',
  },
  cardSlotPlus: { fontSize: 12, color: 'rgba(110,110,140,0.4)' },
  skillBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.skill,
    borderWidth: 2.5,
    borderColor: Colors.skillRing,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  skillBtnCooldown: { opacity: 0.45, borderColor: 'rgba(255,255,255,0.2)' },
  skillText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  expText: {
    textAlign: 'right',
    fontSize: 10,
    color: '#5a8fc0',
    paddingVertical: 4,
  },
  statPopup: {
    position: 'absolute',
    left: 8,
    bottom: 72,
    width: 220,
    backgroundColor: 'rgba(16,20,30,0.96)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(120,200,255,0.55)',
    padding: 12,
    gap: 8,
    zIndex: 20,
    elevation: 20,
  },
  statTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(160,220,255,0.95)',
    textAlign: 'center',
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statItem: {
    width: '50%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  statKey: { fontSize: 12, color: Colors.textSub },
  statVal: { fontSize: 12, fontWeight: '700', color: Colors.textMain },
});

