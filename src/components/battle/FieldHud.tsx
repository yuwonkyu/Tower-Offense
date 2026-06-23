import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { EnemyRoster } from '@/components/battle/EnemyRoster';
import type { UnitId } from '@/game/types';
import { useBattleStore } from '@/store/battleStore';

interface Props {
  stage: number;
  hard: boolean;
  /** 이 스테이지 적 편성 (적 카운트 옆 로스터 표시) */
  enemyUnits: UnitId[];
  onSpeedPress: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 필드 위 오버레이: 적/아군 수 · 타이머 · 배속 · 스테이지 라벨.
 * 필드 관련 고빈도 값만 구독 → 타워바/영웅패널/캔버스와 분리되어 리렌더.
 */
export const FieldHud = memo(function FieldHud({ stage, hard, enemyUnits, onSpeedPress }: Props) {
  const timeLeft = useBattleStore((s) => s.timeLeft);
  const speed = useBattleStore((s) => s.speed);
  const enemyCount = useBattleStore((s) => s.enemyCount);
  const allyCount = useBattleStore((s) => s.allyCount);
  const kills = useBattleStore((s) => s.kills);

  return (
    <>
      <View style={styles.enemyTopLeft}>
        <View style={styles.enemyChip}>
          <Text style={[styles.countText, styles.enemyCountText]}>적 {enemyCount}</Text>
        </View>
        <EnemyRoster enemyUnits={enemyUnits} />
      </View>

      <View style={styles.fieldTopRight}>
        <View style={styles.timerChip}>
          <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
        </View>
        <Pressable style={styles.speedChip} onPress={onSpeedPress}>
          <Text style={styles.speedText}>x{speed}</Text>
        </Pressable>
      </View>

      <Text style={styles.stageLabel}>
        스테이지 {stage}
        {hard ? ' · 하드' : ''} · 처치 {kills}
      </Text>

      <View style={[styles.countChip, styles.allyCountChip]}>
        <Text style={[styles.countText, styles.allyCountText]}>아군 {allyCount}</Text>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
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
  enemyTopLeft: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 4,
    maxWidth: '70%', // 타이머(우상단)와 충돌 방지 — 풀네임 칩이 넘치면 아래 줄로 래핑(최대 2줄 예상)
    zIndex: 2,
  },
  enemyChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
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
});
