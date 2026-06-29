import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { unitCardByUnit } from '@/data/cards';
import type { UnitId } from '@/game/types';

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
  const items: { key: string; label: string }[] = [];
  for (const u of enemyUnits) {
    const card = unitCardByUnit(u);
    const key = card?.id ?? u; // 마법사 3등급 → 같은 card.id로 통합
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      label: card?.name ?? u, // 풀네임 (방패병/투석기/마법사 …)
    });
  }
  if (items.length === 0) return null;

  // 부모(FieldHud enemyTopLeft)가 row-wrap 컨테이너 → 칩을 직접 자식으로 흘려 적 카운트 옆에 나열·래핑
  return (
    <>
      {items.map((it) => (
        <View key={it.key} style={styles.chip}>
          <Text style={styles.label}>{it.label}</Text>
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
  label: { fontSize: 10, fontWeight: '700', color: 'rgba(255,150,150,0.95)' },
});
