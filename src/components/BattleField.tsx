import { Canvas, Circle } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  BattleEngine,
  isStructure,
  makeFieldLayout,
  type CombatEntity,
  type EntityKind,
} from '@/game/engine/engine';
import type { HeroDef, StageConfig } from '@/game/types';
import { useProgressStore } from '@/store/progressStore';

/** 프로토타입 엔티티 표현: 원형 + 종류별 색상 (설계 01) */
const UNIT_VISUALS: Record<EntityKind, { color: string; radius: number }> = {
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
  hero: { color: 'rgba(100,180,255,0.9)', radius: 3 },
  // 구조물 (설계 11)
  wall: { color: 'rgba(150,140,120,0.9)', radius: 3 },
  barricade: { color: 'rgba(120,95,60,0.9)', radius: 2.2 },
  trap: { color: 'rgba(200,60,60,0.65)', radius: 1.2 },
  // 미니보스 / 30스테이지 팔라딘
  knightMini: { color: '#e8c468', radius: 3.5 },
  mageMini: { color: '#b06fe8', radius: 3.5 },
  paladinBoss: { color: '#ffd700', radius: 4.2 },
};

const PROJECTILE_COLOR = 'rgba(220,210,180,0.95)';

const ALLY_STROKE = 'rgba(120,200,255,0.9)';

interface Props {
  config: StageConfig;
  /** 출전 영웅 (메타 스탯 반영된 정의) */
  heroDef: HeroDef;
  speed: number;
  running: boolean;
  /** 0~1 — 타워 외관 단계 (프로토타입: 색상 변화) */
  towerPct: number;
  /** 매 프레임 호출: 엔진 동기화 + 타이머 (dt = 실제 경과 초) */
  onFrame?: (engine: BattleEngine, dt: number) => void;
}

export function BattleField({ config, heroDef, speed, running, towerPct, onFrame }: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const engineRef = useRef<BattleEngine | null>(null);
  const [, setFrame] = useState(0);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0 && !size) setSize({ w: width, h: height });
  };

  useEffect(() => {
    if (!size) return;
    const progress = useProgressStore.getState();
    const unitMetaBonuses = progress.getUnitMetaBonuses();
    const engine = new BattleEngine(
      config,
      makeFieldLayout(size.h / size.w),
      heroDef,
      unitMetaBonuses,
      progress.unlockedUnits,
    );
    engine.heroSkillLevel = progress.getHeroMeta(heroDef.id).skillLevel;
    engineRef.current = engine;
  }, [size, config, heroDef]);

  useEffect(() => {
    if (!size) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const engine = engineRef.current;
      if (engine) {
        // 카드 선택 등 일시정지 중에도 onFrame은 호출 (선택 타이머 진행)
        if (running) {
          engine.tick(dt * speed);
          setFrame((f) => f + 1);
        }
        onFrameRef.current?.(engine, dt);
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
  const { towerX, towerY, towerRadius } = engine.field;

  const towerColor =
    towerPct > 0.6
      ? 'rgba(220,70,70,0.45)'
      : towerPct > 0.3
        ? 'rgba(230,140,60,0.55)'
        : 'rgba(255,80,80,0.75)';

  const enemies: CombatEntity[] = [];
  const allies: CombatEntity[] = [];
  const structures: CombatEntity[] = [];
  for (const e of engine.entities) {
    if (e.kind === 'hero') continue;
    if (isStructure(e.kind)) {
      structures.push(e);
    } else {
      (e.side === 'enemy' ? enemies : allies).push(e);
    }
  }
  const hero = engine.hero;
  const heroDead = hero.state === 'dead';

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

        {/* 구조물: 성벽/바리케이트/트랩 */}
        {structures.map((e) => {
          const v = UNIT_VISUALS[e.kind];
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

        {/* 적 유닛 */}
        {enemies.map((e) => {
          const v = UNIT_VISUALS[e.kind];
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

        {/* 아군 유닛 (시안 테두리로 구분) */}
        {allies.map((e) => {
          const v = UNIT_VISUALS[e.kind];
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
        {allies.map((e) => {
          const v = UNIT_VISUALS[e.kind];
          return (
            <Circle
              key={`s${e.id}`}
              cx={e.x * scale}
              cy={e.y * scale}
              r={v.radius * scale}
              color={ALLY_STROKE}
              style="stroke"
              strokeWidth={1.2}
            />
          );
        })}

        {/* 투사체 (투석기 돌덩이) */}
        {engine.projectiles.map((p) => (
          <Circle
            key={`p${p.id}`}
            cx={p.x * scale}
            cy={p.y * scale}
            r={1.1 * scale}
            color={PROJECTILE_COLOR}
          />
        ))}

        {/* 스킬/광역 발동 연출: 퍼지며 사라지는 링 (설계 연출) */}
        {engine.effects.map((fx) => {
          const progress = 1 - fx.life / fx.maxLife; // 0→1
          return (
            <Circle
              key={`fx${fx.id}`}
              cx={fx.x * scale}
              cy={fx.y * scale}
              r={fx.maxRadius * progress * scale}
              color={fx.color}
              style="stroke"
              strokeWidth={2.5}
              opacity={fx.life / fx.maxLife}
            />
          );
        })}

        {/* 아군 영웅 */}
        <Circle
          cx={hero.x * scale}
          cy={hero.y * scale}
          r={engine.field.heroRadius * scale}
          color={heroDead ? 'rgba(120,120,140,0.5)' : 'rgba(100,180,255,0.9)'}
        />
        <Circle
          cx={hero.x * scale}
          cy={hero.y * scale}
          r={engine.field.heroRadius * scale}
          color={heroDead ? 'rgba(150,150,170,0.5)' : 'rgba(160,220,255,0.9)'}
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
