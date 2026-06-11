import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { HEROES } from '@/data/heroes';

export default function HeroesScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>영웅</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {HEROES.map((hero) => (
          <View key={hero.id} style={styles.card}>
            <View style={styles.portrait}>
              <Text style={styles.portraitText}>{hero.name[0]}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{hero.name}</Text>
              <Text style={styles.concept}>{hero.concept}</Text>
              <Text style={styles.stats}>
                공 {hero.stats.atk} · 방 {hero.stats.def} · HP {hero.stats.hp} · 공속{' '}
                {hero.stats.atkSpeed}
              </Text>
              <Text style={styles.skill}>
                {hero.skill.name} — {hero.skill.description}
              </Text>
            </View>
          </View>
        ))}
        <Text style={styles.note}>
          영웅별 독립 레벨 · 스탯 포인트(1pt = +1%) · 5레벨마다 스킬 포인트 · 초기화 = 다이아
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textMain,
    textAlign: 'center',
    marginVertical: 12,
  },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    gap: 12,
  },
  portrait: {
    width: 56,
    height: 64,
    borderRadius: 8,
    backgroundColor: Colors.hero,
    borderWidth: 1.5,
    borderColor: Colors.heroBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitText: { fontSize: 22, color: Colors.heroText, fontWeight: '700' },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: '600', color: Colors.textMain },
  concept: { fontSize: 12, color: Colors.textSub },
  stats: { fontSize: 11, color: Colors.textSub },
  skill: { fontSize: 11, color: Colors.gold },
  note: {
    fontSize: 11,
    color: Colors.textDim,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});
