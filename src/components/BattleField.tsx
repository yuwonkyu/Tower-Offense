import { Canvas, Circle } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { BattleEngine, makeFieldLayout } from '@/game/engine/engine';
import type { StageConfig, UnitId } from '@/game/types';

/** 프로토타입 유닛 표현: 원형 + 유닛별 색상 (설계 01) */
const UNIT_VISUALS: Record<UnitId, { color: string; radius: number }> = {
  shield: { color: '#c9a227', radius: 2.4 },
  archer: { color: '#6fb7e8', radius: 2.0 },
  spear: { color: '#7fb069', radius: 2.0 },
  catapult: { color: '#d98a3d', radius: 3.0 },
  swordsman: { color: '#d96a6a', radius: 2.0 },
  mageLow: { color: '#9b6fd4', radius: 2.0 },
  mageMid: { color: '#7e4fc4', radius: 2.2 },
  mageHigh: { color: '#5f2fb0', radius: 2.4 },
  assassin: { color: '#8a8aa0', radius: 1.8 },
  bomber: { color: '#ff5544', radius: 2.2 },
  healer: { color: '#9fe1cb', radius: 2.0 },
  cavalry: { color: '#b08050', radius: 2.6 },
};

interface Props {
  config: StageConfig;
  speed: number;
  running: boolean;
  /** 0~1 — 타워 외관 단계 (프로토타입: 색상 변화) */
  towerPct: number;
}

export function BattleField({ config, speed, running, towerPct }: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const engineRef = useRef<BattleEngine | null>(null);
  const [, setFrame] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0 && !size) setSize({ w: width, h: height });
  };

  useEffect(() => {
    if (!size) return;
    engineRef.current = new BattleEngine(config, makeFieldLayout(size.h / size.w));
  }, [size, config]);

  useEffect(() => {
    if (!size) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (running && engineRef.current) {
        engineRef.current.tick(dt * speed);
        setFrame((f) => f + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size, running, speed]);

  const engine = engineRef.current;
  if (!size || !engine) {
    return <View style={styles.fill} onLayout={onLayout} />;
  }

  const scale = size.w / engine.field.width;
  const { towerX, towerY, towerRadius, heroX, heroY, heroRadius } = engine.field;

  const towerColor =
    towerPct > 0.6
      ? 'rgba(220,70,70,0.45)'
      : towerPct > 0.3
        ? 'rgba(230,140,60,0.55)'
        : 'rgba(255,80,80,0.75)';

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <Canvas style={styles.fill}>
        {/* 적 타워 (원형 영역) */}
        <Circle
          cx={towerX * scale}
          cy={towerY * scale}
          r={towerRadius * scale}
          color="rgba(180,50,50,0.14)"
        />
        <Circle
          cx={towerX * scale}
          cy={towerY * scale}
          r={towerRadius * scale}
          color={towerColor}
          style="stroke"
          strokeWidth={2}
        />
        <Circle
          cx={towerX * scale}
          cy={towerY * scale}
          r={towerRadius * 0.45 * scale}
          color="rgba(220,80,80,0.5)"
        />

        {/* 적 유닛 */}
        {engine.enemies.map((e) => {
          const v = UNIT_VISUALS[e.unitId];
          return (
            <Circle
              key={e.id}
              cx={e.x * scale}
              cy={e.y * scale}
              r={v.radius * scale}
              color={v.color}
            />
          );
        })}

        {/* 아군 영웅 */}
        <Circle
          cx={heroX * scale}
          cy={heroY * scale}
          r={heroRadius * scale}
          color="rgba(100,180,255,0.9)"
        />
        <Circle
          cx={heroX * scale}
          cy={heroY * scale}
          r={heroRadius * scale}
          color="rgba(160,220,255,0.9)"
          style="stroke"
          strokeWidth={1.5}
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
