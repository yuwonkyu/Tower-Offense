import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BattleField } from '@/components/BattleField';
import { Colors } from '@/constants/theme';
import { ENEMY_HEROES } from '@/data/enemyHeroes';
import { useBattleStore } from '@/store/battleStore';

const TICK_MS = 100;
const CARD_SLOTS = 8;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function BattleScreen() {
  const { stage } = useLocalSearchParams<{ stage: string }>();
  const stageNum = Number(stage) || 1;

  const config = useBattleStore((s) => s.config);
  const hero = useBattleStore((s) => s.hero);
  const phase = useBattleStore((s) => s.phase);
  const timeLeft = useBattleStore((s) => s.timeLeft);
  const speed = useBattleStore((s) => s.speed);
  const towerHp = useBattleStore((s) => s.towerHp);
  const heroHp = useBattleStore((s) => s.heroHp);
  const heroMaxHp = useBattleStore((s) => s.heroMaxHp);
  const heroLevel = useBattleStore((s) => s.heroLevel);
  const exp = useBattleStore((s) => s.exp);
  const expToNext = useBattleStore((s) => s.expToNext);
  const skillCooldown = useBattleStore((s) => s.skillCooldown);
  const pickedCards = useBattleStore((s) => s.pickedCards);
  const startStage = useBattleStore((s) => s.startStage);
  const tick = useBattleStore((s) => s.tick);
  const cycleSpeed = useBattleStore((s) => s.cycleSpeed);
  const useSkill = useBattleStore((s) => s.useSkill);
  const reset = useBattleStore((s) => s.reset);

  useEffect(() => {
    startStage(stageNum);
    return () => reset();
  }, [stageNum, startStage, reset]);

  useEffect(() => {
    const interval = setInterval(() => tick(TICK_MS / 1000), TICK_MS);
    return () => clearInterval(interval);
  }, [tick]);

  if (!config) return <View style={styles.container} />;

  const enemyHero = ENEMY_HEROES.find((h) => h.id === config.enemyHero)!;
  const towerPct = towerHp / config.tower.hp;
  const heroPct = heroMaxHp > 0 ? heroHp / heroMaxHp : 0;
  const expPct = expToNext > 0 ? exp / expToNext : 0;
  const skillReady = skillCooldown <= 0;
  const cardIds = Object.keys(pickedCards);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* ── 상단 바: 적 영웅 이름 / 적 HP / 설정 ── */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <View style={styles.topRow}>
            <Text style={styles.enemyName}>{enemyHero.name}</Text>
            <Text style={styles.enemyHpText}>
              {Math.ceil(towerHp).toLocaleString()} / {config.tower.hp.toLocaleString()}
            </Text>
          </View>
          <View style={styles.enemyHpBar}>
            <View style={[styles.enemyHpFill, { width: `${towerPct * 100}%` }]} />
          </View>
        </View>
        <Pressable style={styles.settingsBtn} onPress={() => router.back()}>
          <Text style={styles.settingsIcon}>⚙</Text>
        </Pressable>
      </View>

      {/* ── 전투 필드 ── */}
      <View style={styles.field}>
        {/* 우상단: 시간 + 배속 */}
        <View style={styles.fieldTopRight}>
          <View style={styles.timerChip}>
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
          </View>
          <Pressable style={styles.speedChip} onPress={cycleSpeed}>
            <Text style={styles.speedText}>x{speed}</Text>
          </Pressable>
        </View>

        {/* 전투 캔버스: 타워 / 적 유닛 스폰·이동 / 영웅 */}
        <BattleField
          config={config}
          speed={speed}
          running={phase === 'running'}
          towerPct={towerPct}
        />
        <Text style={styles.stageLabel}>스테이지 {config.stage}</Text>

        {/* 페이즈 오버레이 */}
        {(phase === 'victory' || phase === 'defeat') && (
          <View style={styles.overlay}>
            <Text style={[styles.overlayText, phase === 'victory' ? styles.win : styles.lose]}>
              {phase === 'victory' ? 'VICTORY' : 'DEFEAT'}
            </Text>
            <Pressable style={styles.exitBtn} onPress={() => router.back()}>
              <Text style={styles.exitText}>나가기</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── 하단 패널 ── */}
      <View style={styles.bottomPanel}>
        <View style={styles.bottomRow}>
          {/* 영웅 아이콘 */}
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>{hero.name[0]}</Text>
          </View>

          {/* 중앙: Lv + 닉네임 + HP + 카드 */}
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
                return (
                  <View key={i} style={[styles.cardSlot, !cardId && styles.cardSlotEmpty]}>
                    {cardId ? (
                      <Text style={styles.cardSlotText}>{pickedCards[cardId]}</Text>
                    ) : (
                      <Text style={styles.cardSlotPlus}>+</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* 스킬 버튼 */}
          <Pressable
            style={[styles.skillBtn, !skillReady && styles.skillBtnCooldown]}
            onPress={useSkill}
            disabled={!skillReady}
          >
            <Text style={styles.skillText}>
              {skillReady ? hero.skill.name : Math.ceil(skillCooldown)}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.expText}>
          EXP {exp.toLocaleString()} / {expToNext.toLocaleString()}
        </Text>
      </View>

      {/* ── 경험치 바 ── */}
      <View style={styles.expBar}>
        <View style={[styles.expFill, { width: `${expPct * 100}%` }]} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  topBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.panelDark,
    alignItems: 'stretch',
  },
  topLeft: { flex: 1, gap: 4 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  enemyName: { fontSize: 13, fontWeight: '600', color: Colors.textMain },
  enemyHpText: { fontSize: 11, color: Colors.enemyHp },
  enemyHpBar: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  enemyHpFill: { height: '100%', backgroundColor: Colors.enemyHp, borderRadius: 5 },
  settingsBtn: {
    width: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { fontSize: 16, color: Colors.textSub },

  field: { flex: 1, backgroundColor: Colors.bgField },
  fieldTopRight: {
    position: 'absolute',
    top: 10,
    right: 10,
    alignItems: 'flex-end',
    gap: 6,
    zIndex: 2,
  },
  timerChip: {
    backgroundColor: 'rgba(255,200,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,200,0,0.35)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  timerText: { fontSize: 14, fontWeight: '600', color: Colors.timer },
  speedChip: {
    backgroundColor: Colors.speedBg,
    borderWidth: 1,
    borderColor: 'rgba(100,150,255,0.45)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  speedText: { fontSize: 13, fontWeight: '600', color: Colors.speed },

  stageLabel: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    fontSize: 11,
    color: Colors.textDim,
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    zIndex: 3,
  },
  overlayText: { fontSize: 36, fontWeight: '800' },
  win: { color: Colors.gold },
  lose: { color: Colors.enemyHp },
  exitBtn: {
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  exitText: { fontSize: 15, color: Colors.textMain },

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
  cardSlotText: { fontSize: 10, color: 'rgba(220,190,80,0.85)' },
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
  expBar: { height: 10, backgroundColor: 'rgba(255,255,255,0.07)' },
  expFill: { height: '100%', backgroundColor: Colors.exp },
});
