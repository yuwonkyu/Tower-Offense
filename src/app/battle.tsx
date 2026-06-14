import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdStubModal } from '@/components/AdStubModal';
import { BattleField } from '@/components/BattleField';
import { CardPickModal } from '@/components/CardPickModal';
import { PauseMenuModal } from '@/components/PauseMenuModal';
import { StageResultModal } from '@/components/StageResultModal';
import { Colors } from '@/constants/theme';
import { cardById } from '@/data/cards';
import { ENEMY_HEROES } from '@/data/enemyHeroes';
import type { EnemyHeroId } from '@/game/types';
import type { BattleEngine } from '@/game/engine/engine';
import { CARD_PICK_SECONDS, heroMetaExpForStage } from '@/game/formulas';
import { useBattleStore } from '@/store/battleStore';
import { useProgressStore } from '@/store/progressStore';
import { useMonetizationStore } from '@/store/monetizationStore';
import { TOTAL_STAGES } from '@/data/stages';

const CARD_SLOTS = 8;

/** 적 영웅 종족별 시각 구분 (피드백 6 — 10/20/30 보스 구분) */
const ENEMY_HERO_VISUAL: Record<EnemyHeroId, { icon: string; color: string; tag: string }> = {
  knight: { icon: '⚔️', color: '#e8c468', tag: '정통파' },
  mage: { icon: '🔮', color: '#b06fe8', tag: '광역 마법' },
  paladin: { icon: '👑', color: '#ffd700', tag: '엔드 보스' },
};

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
  const kills = useBattleStore((s) => s.kills);
  const enemyCount = useBattleStore((s) => s.enemyCount);
  const allyCount = useBattleStore((s) => s.allyCount);
  const deaths = useBattleStore((s) => s.deaths);
  const clearTime = useBattleStore((s) => s.clearTime);
  const goldEarned = useBattleStore((s) => s.goldEarned);
  const reviveLeft = useBattleStore((s) => s.reviveLeft);
  const pickedCards = useBattleStore((s) => s.pickedCards);
  const pickChoices = useBattleStore((s) => s.pickChoices);
  const pickTimeLeft = useBattleStore((s) => s.pickTimeLeft);
  const rerollUsed = useBattleStore((s) => s.rerollUsed);
  const rewardDoubled = useBattleStore((s) => s.rewardDoubled);
  const startStage = useBattleStore((s) => s.startStage);
  const pickCard = useBattleStore((s) => s.pickCard);
  const cycleSpeed = useBattleStore((s) => s.cycleSpeed);
  const useSkill = useBattleStore((s) => s.useSkill);
  const reset = useBattleStore((s) => s.reset);

  const onStageClear = useProgressStore((s) => s.onStageClear);
  const onStageDefeat = useProgressStore((s) => s.onStageDefeat);

  const adFree = useMonetizationStore((s) => s.adFree);

  /** 진행 중인 광고 보상 종류 (null = 광고 없음) */
  const [adKind, setAdKind] = useState<
    'doubleReward' | 'cardReroll' | 'speedX4' | 'retry' | null
  >(null);

  /** 일시정지 메뉴 (설정 버튼 — 피드백 10) */
  const [menuOpen, setMenuOpen] = useState(false);

  /**
   * 일시정지 게이트: 광고/메뉴 중에는 게임 루프(틱·카드 선택 타이머)를 멈춤.
   * handleFrame이 useCallback([])이라 최신 값을 ref로 읽음 (피드백 8·9).
   */
  const pausedRef = useRef(false);
  pausedRef.current = adKind !== null || menuOpen;

  const retryStage = () => {
    router.replace({ pathname: '/battle', params: { stage: stageNum } });
  };

  const handleAdReward = () => {
    const store = useBattleStore.getState();
    if (adKind === 'speedX4') {
      store.unlockX4();
    } else if (adKind === 'cardReroll') {
      store.rerollCards();
    } else if (adKind === 'doubleReward') {
      const delta = store.applyDoubleReward();
      if (delta > 0) useProgressStore.getState().addGold(delta);
    } else if (adKind === 'retry') {
      setAdKind(null);
      retryStage();
      return;
    }
    setAdKind(null);
  };

  const handleSpeedPress = () => {
    if (cycleSpeed() === 'needsX4Ad') setAdKind('speedX4');
  };

  // 결과 확정 시 진행도 저장 (1회만)
  const engine = useBattleStore((s) => s.engine);
  useEffect(() => {
    const heroId = hero.id; // 선택 영웅
    if (phase === 'victory') {
      onStageClear({
        stage: stageNum,
        goldEarned,
        unlocksUnit: config?.unlocksUnit,
        heroId,
        heroExpGained: heroMetaExpForStage(stageNum, true),
      });
    } else if (phase === 'defeat') {
      onStageDefeat({
        goldEarned,
        heroId,
        heroExpGained: heroMetaExpForStage(stageNum, false),
      });
    }
    // phase가 결과로 전환될 때만 1회 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    startStage(stageNum);
    return () => reset();
  }, [stageNum, startStage, reset]);

  // 게임 루프 (BattleField rAF)에서 매 프레임 호출
  const handleFrame = useCallback((engine: BattleEngine, dt: number) => {
    // 광고/일시정지 메뉴 중에는 틱·카드 선택 타이머 정지 (피드백 8·9)
    if (pausedRef.current) return;
    const store = useBattleStore.getState();
    store.tick(dt);
    store.syncFromEngine(engine);
  }, []);

  if (!config) return <View style={styles.container} />;

  const enemyHero = ENEMY_HEROES.find((h) => h.id === config.enemyHero)!;
  const heroVisual = ENEMY_HERO_VISUAL[config.enemyHero];
  const towerPct = towerHp / config.tower.hp;
  const heroPct = heroMaxHp > 0 ? heroHp / heroMaxHp : 0;
  const expPct = expToNext > 0 ? exp / expToNext : 0;
  const skillReady = skillCooldown <= 0;
  const cardIds = Object.keys(pickedCards);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* ── 상단 바: 적 영웅(종족 구분) / 적 HP / 설정 ── */}
      <View style={styles.topBar}>
        {/* 적 영웅 엠블럼 — 스테이지대별 색/아이콘 구분 (피드백 6) */}
        <View style={[styles.enemyEmblem, { borderColor: heroVisual.color }]}>
          <Text style={styles.enemyEmblemIcon}>{heroVisual.icon}</Text>
        </View>
        <View style={styles.topLeft}>
          <View style={styles.topRow}>
            <View style={styles.enemyNameWrap}>
              <Text style={[styles.enemyName, { color: heroVisual.color }]}>{enemyHero.name}</Text>
              <View style={[styles.enemyTag, { borderColor: heroVisual.color }]}>
                <Text style={[styles.enemyTagText, { color: heroVisual.color }]}>
                  {heroVisual.tag}
                </Text>
              </View>
            </View>
            <Text style={styles.enemyHpText}>
              {Math.ceil(towerHp).toLocaleString()} / {config.tower.hp.toLocaleString()}
            </Text>
          </View>
          <View style={styles.enemyHpBar}>
            <View
              style={[styles.enemyHpFill, { width: `${towerPct * 100}%`, backgroundColor: heroVisual.color }]}
            />
          </View>
        </View>
        <Pressable style={styles.settingsBtn} onPress={() => setMenuOpen(true)}>
          <Text style={styles.settingsIcon}>⚙</Text>
        </Pressable>
      </View>

      {/* ── 전투 필드 ── */}
      <View style={styles.field}>
        {/* 좌상단: 생존 적 유닛 수 (피드백 11) */}
        <View style={[styles.countChip, styles.enemyCountChip]}>
          <Text style={[styles.countText, styles.enemyCountText]}>적 {enemyCount}</Text>
        </View>

        {/* 우상단: 시간 + 배속 */}
        <View style={styles.fieldTopRight}>
          <View style={styles.timerChip}>
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
          </View>
          <Pressable style={styles.speedChip} onPress={handleSpeedPress}>
            <Text style={styles.speedText}>x{speed}</Text>
          </Pressable>
        </View>

        {/* 전투 캔버스: 타워 / 양측 유닛 자동 전투 / 영웅 */}
        <BattleField
          config={config}
          heroDef={hero}
          speed={speed}
          running={phase === 'running' && adKind === null && !menuOpen}
          towerPct={towerPct}
          onFrame={handleFrame}
        />
        <Text style={styles.stageLabel}>
          스테이지 {config.stage} · 처치 {kills}
        </Text>

        {/* 우하단: 생존 아군 유닛 수 (피드백 11) */}
        <View style={[styles.countChip, styles.allyCountChip]}>
          <Text style={[styles.countText, styles.allyCountText]}>아군 {allyCount}</Text>
        </View>

        {/* 페이즈 오버레이 — 정산 모달로 대체 */}
      </View>

      {/* ── 하단 패널 ── */}
      <View style={styles.bottomPanel}>
        <View style={styles.bottomRow}>
          {/* 영웅 아이콘 (사망 시 부활 카운트다운 오버레이) */}
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>{hero.name[0]}</Text>
            {reviveLeft > 0 && (
              <View style={styles.reviveOverlay}>
                <Text style={styles.reviveText}>{Math.ceil(reviveLeft)}</Text>
              </View>
            )}
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

      {/* ── 카드 선택 (레벨업 / 전투 시작) — 전투 일시정지 ── */}
      {phase === 'cardPick' && (
        <CardPickModal
          choices={pickChoices}
          ownedLevels={pickedCards}
          timeLeft={pickTimeLeft}
          totalTime={CARD_PICK_SECONDS}
          level={heroLevel}
          onPick={pickCard}
          onReroll={() => {
            // 프리미엄 패스 = 광고 없이 즉시 무제한 리롤, 그 외엔 광고 시청
            if (adFree) useBattleStore.getState().rerollCards();
            else setAdKind('cardReroll');
          }}
          rerollUsed={rerollUsed}
          rerollUnlimited={adFree}
        />
      )}

      {/* ── 스테이지 정산 ── */}
      {(phase === 'victory' || phase === 'defeat') && (
        <StageResultModal
          result={{
            victory: phase === 'victory',
            stage: stageNum,
            kills,
            deaths,
            totalExp: engine?.totalExp ?? 0,
            goldEarned,
            clearTime,
            finalLevel: heroLevel,
          }}
          onNextStage={() => {
            const next = Math.min(stageNum + 1, TOTAL_STAGES);
            router.replace({ pathname: '/battle', params: { stage: next } });
          }}
          onRetry={() => {
            // 실패 재도전 = 광고 (설계 06 IAA) — 광고 제거 구매자/승리 후 재시도는 무료
            if (phase === 'defeat' && !adFree) {
              setAdKind('retry');
            } else {
              retryStage();
            }
          }}
          onExit={() => router.back()}
          onDoubleReward={adFree ? undefined : () => setAdKind('doubleReward')}
          rewardDoubled={rewardDoubled}
          retryNeedsAd={phase === 'defeat' && !adFree}
        />
      )}

      {/* ── 일시정지 메뉴 (설정 버튼 — 게임 정지 + 보유 카드 수치, 피드백 10) ── */}
      {menuOpen && (
        <PauseMenuModal
          pickedCards={pickedCards}
          onResume={() => setMenuOpen(false)}
          onRetry={() => {
            setMenuOpen(false);
            retryStage();
          }}
          onExit={() => {
            setMenuOpen(false);
            router.back();
          }}
        />
      )}

      {/* ── 광고 스텁 (설계 06 IAA — x4 / 카드 재선택 / 보상 2배) ── */}
      <AdStubModal
        visible={adKind !== null}
        onReward={handleAdReward}
        onClose={() => setAdKind(null)}
      />
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
  enemyEmblem: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enemyEmblemIcon: { fontSize: 18 },
  enemyNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  enemyName: { fontSize: 14, fontWeight: '700' },
  enemyTag: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  enemyTagText: { fontSize: 9, fontWeight: '700' },
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
  countChip: {
    position: 'absolute',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    zIndex: 2,
  },
  enemyCountChip: {
    top: 10,
    left: 10,
    backgroundColor: 'rgba(220,70,70,0.14)',
    borderColor: 'rgba(220,70,70,0.4)',
  },
  allyCountChip: {
    bottom: 8,
    right: 10,
    backgroundColor: 'rgba(100,180,255,0.14)',
    borderColor: 'rgba(100,180,255,0.45)',
  },
  countText: { fontSize: 12, fontWeight: '700' },
  enemyCountText: { color: 'rgba(255,120,120,0.95)' },
  allyCountText: { color: 'rgba(140,200,255,0.95)' },

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
  expBar: { height: 10, backgroundColor: 'rgba(255,255,255,0.07)' },
  expFill: { height: '100%', backgroundColor: Colors.exp },
});
