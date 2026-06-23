import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdStubModal } from '@/components/AdStubModal';
import { BattleField } from '@/components/BattleField';
import { EnemyTowerBar } from '@/components/battle/EnemyTowerBar';
import { ExpBar } from '@/components/battle/ExpBar';
import { FieldHud } from '@/components/battle/FieldHud';
import { HeroPanel } from '@/components/battle/HeroPanel';
import { CardPickModal } from '@/components/CardPickModal';
import { PauseMenuModal } from '@/components/PauseMenuModal';
import { ResourceNoticeModal } from '@/components/ResourceNoticeModal';
import { StageResultModal } from '@/components/StageResultModal';
import { Colors } from '@/constants/theme';
import { cardById, unitCardByUnit } from '@/data/cards';
import { ENEMY_HEROES, ENEMY_HERO_VISUAL } from '@/data/enemyHeroes';
import { META_HIDDEN_UNITS } from '@/data/enemyUnits';
import type { UnitId } from '@/game/types';
import type { BattleEngine } from '@/game/engine/engine';
import { CARD_PICK_SECONDS, heroMetaExpForStage } from '@/game/formulas';
import { useBattleStore } from '@/store/battleStore';
import { useProgressStore } from '@/store/progressStore';
import { useMonetizationStore } from '@/store/monetizationStore';
import { EXTRA_UNLOCKS, TOTAL_STAGES } from '@/data/stages';

export default function BattleScreen() {
  const { stage, difficulty } = useLocalSearchParams<{ stage: string; difficulty?: string }>();
  const stageNum = Number(stage) || 1;
  const diff: 'normal' | 'hard' = difficulty === 'hard' ? 'hard' : 'normal';

  // ── 부모는 저빈도/이벤트성 상태만 구독한다 (고빈도 HUD 값은 각 HUD 컴포넌트가 직접 구독) ──
  const config = useBattleStore((s) => s.config);
  const hero = useBattleStore((s) => s.hero);
  const phase = useBattleStore((s) => s.phase);
  const speed = useBattleStore((s) => s.speed);
  // 모달 전용 상태
  const pickedCards = useBattleStore((s) => s.pickedCards);
  const pickChoices = useBattleStore((s) => s.pickChoices);
  const pickTimeLeft = useBattleStore((s) => s.pickTimeLeft);
  const rerollAdUnlocked = useBattleStore((s) => s.rerollAdUnlocked);
  const rerollUsed = useBattleStore((s) => s.rerollUsed);
  const rewardDoubled = useBattleStore((s) => s.rewardDoubled);
  const resourceGain = useBattleStore((s) => s.resourceGain);
  // 액션 (안정적 참조)
  const startStage = useBattleStore((s) => s.startStage);
  const pickCard = useBattleStore((s) => s.pickCard);
  const useSkill = useBattleStore((s) => s.useSkill);
  const reset = useBattleStore((s) => s.reset);
  const dismissResourceNotice = useBattleStore((s) => s.dismissResourceNotice);

  const onStageClear = useProgressStore((s) => s.onStageClear);
  const onStageDefeat = useProgressStore((s) => s.onStageDefeat);

  const adFree = useMonetizationStore((s) => s.adFree);

  /** 진행 중인 광고 보상 종류 (null = 광고 없음) */
  const [adKind, setAdKind] = useState<'doubleReward' | 'cardReroll' | 'speedX4' | 'retry' | null>(
    null,
  );

  /** 일시정지 메뉴 (설정 버튼 — 피드백 10) */
  const [menuOpen, setMenuOpen] = useState(false);

  /** 전투 시작 시점의 해금 목록 스냅샷 — 정산에서 "이번 클리어로 신규 해금" 판별용 (1회 캡처) */
  const [unlockedAtStart] = useState<UnitId[]>(() => useProgressStore.getState().unlockedUnits);

  /**
   * 일시정지 게이트: 광고/메뉴 중에는 게임 루프(틱·카드 선택 타이머)를 멈춤.
   * handleFrame이 useCallback([])이라 최신 값을 ref로 읽음 (피드백 8·9).
   */
  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = adKind !== null || menuOpen;
  }, [adKind, menuOpen]);

  // 안드로이드 뒤로가기 → 홈으로 바로 나가지 않고 일시정지(설정) 메뉴를 연다 (피드백 1)
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (adKind !== null) return true; // 광고 모달 중: 무시
      if (menuOpen) {
        setMenuOpen(false); // 이미 열려 있으면 닫기
        return true;
      }
      if (phase === 'victory' || phase === 'defeat') return false; // 정산 화면: 기본 뒤로(홈)
      setMenuOpen(true); // 전투/카드선택/안내 중: 설정창 열기
      return true;
    });
    return () => sub.remove();
  }, [adKind, menuOpen, phase]);

  /**
   * HUD 동기화 스로틀 누적기. 엔진 시뮬/캔버스는 BattleField가 매 프레임(60Hz) 그리지만,
   * 스토어(→HUD 리렌더)는 ~10Hz로만 갱신해 전체 화면 리렌더 폭주를 막는다.
   */
  const syncAccumRef = useRef(0);

  const retryStage = () => {
    router.replace({ pathname: '/battle', params: { stage: stageNum, difficulty: diff } });
  };

  const handleAdReward = () => {
    const store = useBattleStore.getState();
    if (adKind === 'speedX4') {
      store.unlockX4();
    } else if (adKind === 'cardReroll') {
      store.rerollCards();
      useBattleStore.setState({ rerollAdUnlocked: true }); // 광고 1회 → 그 판 리롤 무한 무료
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

  const handleSpeedPress = useCallback(() => {
    if (useBattleStore.getState().cycleSpeed() === 'needsX4Ad') setAdKind('speedX4');
  }, []);

  const handleOpenMenu = useCallback(() => setMenuOpen(true), []);

  // 결과 확정 시 진행도 저장 (1회만) — 최종 수치는 getState()로 비반응 읽기
  useEffect(() => {
    if (phase !== 'victory' && phase !== 'defeat') return;
    const st = useBattleStore.getState();
    const heroId = st.hero.id;
    if (phase === 'victory') {
      onStageClear({
        stage: stageNum,
        goldEarned: st.goldEarned,
        unlocksUnit: st.config?.unlocksUnit,
        heroId,
        heroExpGained: heroMetaExpForStage(stageNum, true),
        difficulty: diff,
      });
    } else {
      onStageDefeat({
        goldEarned: st.goldEarned,
        heroId,
        heroExpGained: heroMetaExpForStage(stageNum, false),
      });
    }
    // phase가 결과로 전환될 때만 1회 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    startStage(stageNum, diff);
    return () => reset();
  }, [stageNum, diff, startStage, reset]);

  // 게임 루프 (BattleField rAF)에서 매 프레임 호출 — HUD 동기화는 ~10Hz 스로틀
  const handleFrame = useCallback((engine: BattleEngine, dt: number) => {
    if (pausedRef.current) return;
    syncAccumRef.current += dt;
    if (syncAccumRef.current < 0.1) return;
    const acc = syncAccumRef.current;
    syncAccumRef.current = 0;
    const store = useBattleStore.getState();
    store.tick(acc);
    store.syncFromEngine(engine);
  }, []);

  if (!config) return <View style={styles.container} />;

  const enemyHero = ENEMY_HEROES.find((h) => h.id === config.enemyHero)!;
  const heroVisual = ENEMY_HERO_VISUAL[config.enemyHero];
  const isResult = phase === 'victory' || phase === 'defeat';

  // 정산 데이터: 결과 페이즈에서만 최종값을 비반응 스냅샷으로 읽음 (엔진 정지 상태라 안정)
  const st = isResult ? useBattleStore.getState() : null;
  const newlyUnlockedNames =
    phase === 'victory'
      ? Array.from(
          new Set(
            [config.unlocksUnit, ...(EXTRA_UNLOCKS[stageNum] ?? [])].filter(
              (u): u is UnitId =>
                !!u && !META_HIDDEN_UNITS.has(u) && !unlockedAtStart.includes(u),
            ),
          ),
        ).map((u) => unitCardByUnit(u)?.name ?? u)
      : [];
  const pickedSummary = isResult
    ? Object.keys(pickedCards).map((id) => ({ name: cardById(id)?.name ?? id, level: pickedCards[id] }))
    : [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* ── 상단 바: 적 영웅 / 타워 HP / 설정 ── */}
      <EnemyTowerBar
        enemyName={enemyHero.name}
        heroVisual={heroVisual}
        towerMaxHp={config.tower.hp}
        onOpenMenu={handleOpenMenu}
      />

      {/* ── 전투 필드 (캔버스 + 오버레이 HUD) ── */}
      <View style={styles.field}>
        <BattleField
          config={config}
          heroDef={hero}
          speed={speed}
          running={phase === 'running' && adKind === null && !menuOpen}
          onFrame={handleFrame}
        />
        <FieldHud
          stage={config.stage}
          hard={diff === 'hard'}
          enemyUnits={config.enemyUnits}
          onSpeedPress={handleSpeedPress}
        />
      </View>

      {/* ── 하단 패널 (영웅/카드/스킬) + EXP 바 ── */}
      <HeroPanel hero={hero} onUseSkill={useSkill} />
      <ExpBar />

      {/* ── 카드 선택 (레벨업 / 전투 시작) — 전투 일시정지 ── */}
      {phase === 'cardPick' && (
        <CardPickModal
          choices={pickChoices}
          ownedLevels={pickedCards}
          timeLeft={pickTimeLeft}
          totalTime={CARD_PICK_SECONDS}
          level={useBattleStore.getState().heroLevel}
          onPick={pickCard}
          onReroll={() => {
            if (rerollUsed) return; // 카드선택 1회당 리롤 1번
            if (adFree || rerollAdUnlocked) useBattleStore.getState().rerollCards();
            else setAdKind('cardReroll');
          }}
          rerollFree={adFree || rerollAdUnlocked}
          rerollUsed={rerollUsed}
        />
      )}

      {/* ── 카드 풀 소진 안내 (1회) → 이후 재화 자동 습득 ── */}
      {phase === 'resourceNotice' && (
        <ResourceNoticeModal gain={resourceGain} onConfirm={dismissResourceNotice} />
      )}

      {/* ── 스테이지 정산 ── */}
      {isResult && st && (
        <StageResultModal
          result={{
            victory: phase === 'victory',
            stage: stageNum,
            kills: st.kills,
            deaths: st.deaths,
            totalExp: st.engine?.totalExp ?? 0,
            goldEarned: st.goldEarned,
            clearTime: st.clearTime,
            finalLevel: st.heroLevel,
          }}
          unlockedUnits={newlyUnlockedNames}
          pickedCards={pickedSummary}
          onNextStage={() => {
            const next = Math.min(stageNum + 1, TOTAL_STAGES);
            router.replace({ pathname: '/battle', params: { stage: next, difficulty: diff } });
          }}
          onRetry={() => {
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
      {adKind !== null && <AdStubModal onReward={handleAdReward} onClose={() => setAdKind(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  field: { flex: 1, backgroundColor: Colors.bgField },
});
