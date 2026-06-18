import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useBattleStore } from '@/store/battleStore';

interface Props {
  enemyName: string;
  heroVisual: { color: string; icon: string; tag: string };
  towerMaxHp: number;
  onOpenMenu: () => void;
}

/**
 * 상단 바: 적 영웅 엠블럼 + 타워 HP. towerHp만 구독 → 타워 피해 시 이 컴포넌트만 리렌더.
 */
export const EnemyTowerBar = memo(function EnemyTowerBar({
  enemyName,
  heroVisual,
  towerMaxHp,
  onOpenMenu,
}: Props) {
  const towerHp = useBattleStore((s) => s.towerHp);
  const towerPct = towerMaxHp > 0 ? towerHp / towerMaxHp : 0;

  return (
    <View style={styles.topBar}>
      <View style={[styles.enemyEmblem, { borderColor: heroVisual.color }]}>
        <Text style={styles.enemyEmblemIcon}>{heroVisual.icon}</Text>
      </View>
      <View style={styles.topLeft}>
        <View style={styles.topRow}>
          <View style={styles.enemyNameWrap}>
            <Text style={[styles.enemyName, { color: heroVisual.color }]}>{enemyName}</Text>
            <View style={[styles.enemyTag, { borderColor: heroVisual.color }]}>
              <Text style={[styles.enemyTagText, { color: heroVisual.color }]}>{heroVisual.tag}</Text>
            </View>
          </View>
          <Text style={styles.enemyHpText}>
            {Math.ceil(towerHp).toLocaleString()} / {towerMaxHp.toLocaleString()}
          </Text>
        </View>
        <View style={styles.enemyHpBar}>
          <View
            style={[styles.enemyHpFill, { width: `${towerPct * 100}%`, backgroundColor: heroVisual.color }]}
          />
        </View>
      </View>
      <Pressable style={styles.settingsBtn} onPress={onOpenMenu}>
        <Text style={styles.settingsIcon}>⚙</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
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
});
