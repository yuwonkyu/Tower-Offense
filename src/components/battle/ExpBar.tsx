import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useBattleStore } from '@/store/battleStore';

/** 하단 경험치 바. exp/expToNext만 구독. */
export const ExpBar = memo(function ExpBar() {
  const exp = useBattleStore((s) => s.exp);
  const expToNext = useBattleStore((s) => s.expToNext);
  const pct = expToNext > 0 ? exp / expToNext : 0;

  return (
    <View style={styles.expBar}>
      <View style={[styles.expFill, { width: `${pct * 100}%` }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  expBar: { height: 10, backgroundColor: 'rgba(255,255,255,0.07)' },
  expFill: { height: '100%', backgroundColor: Colors.exp },
});
