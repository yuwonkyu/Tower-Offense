import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { unitCardByUnit } from '@/data/cards';
import { supplyCost } from '@/data/spawnWeights';
import type { UnitId } from '@/game/types';

/** 적 유닛 대표 색 — BattleField UNIT_VISUALS와 동일 계열 (빠른 식별용 점) */
const UNIT_DOT: Partial<Record<UnitId, string>> = {
  shield: '#c9a227',
  archer: '#6fb7e8',
  spear: '#7fb069',
  catapult: '#d98a3d',
  swordsman: '#d96a6a',
  mageLow: '#9b6fd4',
  mageMid: '#9b6fd4',
  mageHigh: '#9b6fd4',
  assassin: '#8a8aa0',
  bomber: '#ff5544',
  healer: '#9fe1cb',
  cavalry: '#b08050',
};

interface Props {
  /** 이 스테이지에 등장하는 적 유닛 풀 (config.enemyUnits) */
  enemyUnits: UnitId[];
}

/**
 * 적 편성 로스터: 이 스테이지에 등장하는 적 유닛 종류를 칩으로 표시 (적 카운트 옆).
 * 스테이지 고정값(config.enemyUnits)만 의존 → 전투 중 리렌더 없음 (memo).
 * 마법사 진화 라인(하급/중급/상급)은 같은 카드라 한 칩으로 통합.
 */
export const EnemyRoster = memo(function EnemyRoster({ enemyUnits }: Props) {
  const seen = new Set<string>();
  const items: { key: string; label: string; color: string; cost: number }[] = [];
  for (const u of enemyUnits) {
    const card = unitCardByUnit(u);
    const key = card?.id ?? u; // 마법사 3등급 → 같은 card.id로 통합
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      label: card?.name ?? u, // 풀네임 (방패병/투석기/마법사 …)
      color: UNIT_DOT[u] ?? 'rgba(255,120,120,0.95)',
      cost: supplyCost(u), // 인구수 코스트 (1/3/5) — 1/N 캡과 동일 기준
    });
  }
  if (items.length === 0) return null;

  // 부모(FieldHud enemyTopLeft)가 row-wrap 컨테이너 → 칩을 직접 자식으로 흘려 적 카운트 옆에 나열·래핑
  return (
    <>
      {items.map((it) => (
        <View key={it.key} style={styles.chip}>
          <View style={[styles.dot, { backgroundColor: it.color }]} />
          <Text style={styles.label}>{it.label}</Text>
          <Text style={styles.cost}>{it.cost}</Text>
        </View>
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(220,70,70,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(220,70,70,0.35)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 10, fontWeight: '700', color: 'rgba(255,150,150,0.95)' },
  // 인구수 코스트 배지 (1/3/5) — 칩 끝에 작게
  cost: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,210,120,0.95)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 3,
    paddingHorizontal: 3,
    overflow: 'hidden',
  },
});
