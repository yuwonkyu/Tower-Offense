import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Colors } from '@/constants/theme';

import type { ColorValue } from 'react-native';

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.panelDark,
          borderTopColor: 'rgba(255,255,255,0.08)',
        },
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.textDim,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => <TabIcon glyph="🏰" color={color} />,
        }}
      />
      <Tabs.Screen
        name="heroes"
        options={{
          title: '영웅',
          tabBarIcon: ({ color }) => <TabIcon glyph="⚔️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="units"
        options={{
          title: '유닛',
          tabBarIcon: ({ color }) => <TabIcon glyph="🛡️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: '상점',
          tabBarIcon: ({ color }) => <TabIcon glyph="💎" color={color} />,
        }}
      />
    </Tabs>
  );
}
