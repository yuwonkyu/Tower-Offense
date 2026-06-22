/*
 * 게임 루프 아키텍처: BattleEngine은 순수 TS 클래스로 ref(engineRef)에 보관하고,
 * 매 틱 setFrame으로 강제 리렌더하면서 렌더 중 엔진 상태(수백 엔티티)를 읽어 Skia로 그린다.
 *
 * 렌더링: 엔티티 하나당 <Circle> React 엘리먼트를 쓰면 매 프레임 수백 노드를
 * React가 재조정(reconcile)해야 해서 모바일에서 프레임이 초 단위로 무너진다.
 * 따라서 모든 엔티티를 단일 <Picture>의 명령형 드로잉 루프(canvas.drawCircle)로 그린다.
 * React 트리는 <Canvas><Picture/></Canvas> 2노드뿐이라 재조정 비용이 사라진다.
 * (렌더 중 engineRef/paintCache ref를 의도적으로 읽어 매 프레임 최신 상태를 그린다.)
 */
import {
  Canvas,
  createPicture,
  PaintStyle,
  Picture,
  Skia,
  type SkCanvas,
  type SkPaint,
} from '@shopify/react-native-skia';
import { memo, useEffect, useRef, useState } from 'react';
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

const PROJECTILE_COLOR = 'rgba(255,236,180,1)'; // 본체 (밝게)
const PROJECTILE_GLOW = 'rgba(255,160,70,0.4)'; // 외곽 글로우 (불타는 공성탄 느낌, 가시성↑)
const ARROW_COLOR = 'rgba(205,240,255,1)'; // 영웅 화살 본체 (시안빛 — 투석탄과 구분)
const ARROW_GLOW = 'rgba(95,185,255,0.45)'; // 영웅 화살 글로우 + 비행 잔상

const ALLY_STROKE = 'rgba(120,200,255,0.9)';
const ENEMY_STROKE = 'rgba(255,70,70,0.95)'; // 적 유닛 빨강 테두리 — 아군(시안)과 즉시 구분 (프로토타입 가독성)

/** 피격 순간 번쩍 (타격감) */
const HIT_COLOR = 'rgba(255,255,255,0.95)';

/** 영웅 클래스 테마 색 (오라/본체/테두리) — Phase1 절차적 디자인 */
const HERO_THEME: Record<string, { body: string; aura: string; ring: string }> = {
  maruhan: { body: 'rgba(255,180,90,0.95)', aura: 'rgba(255,170,80,0.14)', ring: 'rgba(255,212,150,1)' },
  mir: { body: 'rgba(110,185,255,0.95)', aura: 'rgba(120,190,255,0.14)', ring: 'rgba(195,232,255,1)' },
  noeul: { body: 'rgba(193,132,247,0.95)', aura: 'rgba(182,122,247,0.14)', ring: 'rgba(222,184,255,1)' },
};

interface Props {
  config: StageConfig;
  /** 출전 영웅 (메타 스탯 반영된 정의) */
  heroDef: HeroDef;
  speed: number;
  running: boolean;
  /** 매 프레임 호출: 엔진 동기화 + 타이머 (dt = 실제 경과 초) */
  onFrame?: (engine: BattleEngine, dt: number) => void;
}

export const BattleField = memo(function BattleField({ config, heroDef, speed, running, onFrame }: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const engineRef = useRef<BattleEngine | null>(null);
  const [, setFrame] = useState(0);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  // 색상별 Paint 캐시 — 프레임 간 재사용 (Skia.Paint 생성 비용 회피)
  const paintCache = useRef<Map<string, SkPaint>>(new Map());

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

  // 타워 외관 단계(색상)는 엔진 ref에서 직접 — 부모가 towerHp를 구독할 필요 없음
  const towerPct = config.tower.hp > 0 ? engine.towerHp / config.tower.hp : 0;
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

  // 모든 엔티티를 단일 Picture에 명령형으로 그린다 (React 재조정 회피)
  const picture = createPicture((canvas: SkCanvas) => {
    const cache = paintCache.current;
    const fill = (color: string): SkPaint => {
      const key = `f|${color}`;
      let p = cache.get(key);
      if (!p) {
        p = Skia.Paint();
        p.setAntiAlias(true);
        p.setColor(Skia.Color(color));
        cache.set(key, p);
      }
      return p;
    };
    const stroke = (color: string, width: number): SkPaint => {
      const key = `s|${color}|${width}`;
      let p = cache.get(key);
      if (!p) {
        p = Skia.Paint();
        p.setAntiAlias(true);
        p.setStyle(PaintStyle.Stroke);
        p.setStrokeWidth(width);
        p.setColor(Skia.Color(color));
        cache.set(key, p);
      }
      return p;
    };

    // ── 배경: 베이스 + 세로 그라데이션 밴드 + 타워 메나스 글로우 + 지면 깊이 ──
    const W = size.w;
    const H = size.h;
    const tx = towerX * scale;
    const ty = towerY * scale;
    const tr = towerRadius * scale;
    canvas.drawColor(Skia.Color('#0e0f1c'));
    const bands = 14;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const r = Math.round(10 + 16 * t);
      const g = Math.round(11 + 11 * t);
      const b = Math.round(22 + 16 * t);
      canvas.drawRect(Skia.XYWHRect(0, (H * i) / bands, W, H / bands + 1), fill(`rgb(${r},${g},${b})`));
    }
    // 타워 메나스 글로우 (적 위협감) — 동심원 누적으로 방사형 falloff
    for (let i = 7; i >= 1; i--) {
      canvas.drawCircle(tx, ty, tr + i * 10 * scale, fill('rgba(150,40,46,0.05)'));
    }
    // 지면 깊이감 — 타워 중심 동심 링
    for (let i = 1; i <= 3; i++) {
      canvas.drawCircle(tx, ty, tr + i * 22 * scale, stroke('rgba(255,255,255,0.03)', 1));
    }

    // ── 적 타워: 상단 요새 (4단계 손상 외관) ──
    const dmgStage = towerPct > 0.6 ? 0 : towerPct > 0.3 ? 1 : towerPct > 0 ? 2 : 3;
    const wallCol = dmgStage >= 2 ? '#5a5550' : '#777067';
    canvas.drawCircle(tx, ty + tr * 0.14, tr * 1.2, fill('rgba(0,0,0,0.4)')); // 토대 그림자
    canvas.drawCircle(tx, ty, tr, fill('#393530')); // 외벽 채움
    canvas.drawCircle(tx, ty, tr, stroke(wallCol, 2.4)); // 외벽 링
    // 흉벽(크레넬) — 손상 단계별 일부 결손
    const merlons = 12;
    for (let i = 0; i < merlons; i++) {
      if (dmgStage === 1 && i % 5 === 0) continue;
      if (dmgStage === 2 && i % 2 === 0) continue;
      if (dmgStage === 3 && i % 3 !== 0) continue;
      const a = (i / merlons) * Math.PI * 2;
      canvas.drawCircle(tx + Math.cos(a) * tr, ty + Math.sin(a) * tr, tr * 0.17, fill(wallCol));
    }
    canvas.drawCircle(tx, ty, tr * 0.6, fill(dmgStage >= 2 ? '#2a2622' : '#48433c')); // 안뜰
    canvas.drawCircle(tx, ty, tr * 0.34, fill(dmgStage >= 3 ? '#7a2a1a' : towerColor)); // 중앙 키프 (HP 색)
    if (dmgStage >= 2) {
      canvas.drawCircle(tx - tr * 0.42, ty + tr * 0.32, tr * 0.12, fill('#2a2622')); // 잔해
      canvas.drawCircle(tx + tr * 0.5, ty - tr * 0.22, tr * 0.09, fill('#2a2622'));
    }
    if (dmgStage === 3) canvas.drawCircle(tx, ty, tr * 0.5, fill('rgba(255,80,40,0.28)')); // 폐허 잔불
    if (engine.towerFlash > 0) canvas.drawCircle(tx, ty, tr * 1.06, fill('rgba(255,90,90,0.45)')); // 피격 플래시

    // 구조물: 성벽/바리케이트/트랩
    for (const e of structures) {
      const v = UNIT_VISUALS[e.kind];
      canvas.drawCircle(e.x * scale, e.y * scale, v.radius * scale, fill(v.color));
    }

    // 적 유닛
    for (const e of enemies) {
      const v = UNIT_VISUALS[e.kind];
      canvas.drawCircle(e.x * scale, e.y * scale, v.radius * scale, fill(e.hitFlash > 0 ? HIT_COLOR : v.color));
    }
    // 적 유닛 빨강 테두리 — 아군(시안)과 즉시 구분 (프로토타입 가독성, 피드백)
    for (const e of enemies) {
      const v = UNIT_VISUALS[e.kind];
      canvas.drawCircle(e.x * scale, e.y * scale, v.radius * scale, stroke(ENEMY_STROKE, 1.2));
    }

    // 아군 유닛 (채움 + 시안 테두리)
    for (const e of allies) {
      const v = UNIT_VISUALS[e.kind];
      canvas.drawCircle(e.x * scale, e.y * scale, v.radius * scale, fill(e.hitFlash > 0 ? HIT_COLOR : v.color));
    }
    for (const e of allies) {
      const v = UNIT_VISUALS[e.kind];
      canvas.drawCircle(e.x * scale, e.y * scale, v.radius * scale, stroke(ALLY_STROKE, 1.2));
    }

    // 투사체 — 투석탄(주황 글로우) / 영웅 화살(시안 글로우 + 비행 잔상, 호밍)
    for (const p of engine.projectiles) {
      if (p.arrow) {
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const bx = (dx / d) * scale;
        const by = (dy / d) * scale;
        const px = p.x * scale;
        const py = p.y * scale;
        // 비행 방향 뒤쪽 잔상 2개 → 슈팅 스트릭
        canvas.drawCircle(px - bx * 2.4, py - by * 2.4, 1.1 * scale, fill(ARROW_GLOW));
        canvas.drawCircle(px - bx * 4.8, py - by * 4.8, 0.7 * scale, fill(ARROW_GLOW));
        canvas.drawCircle(px, py, 3.2 * scale, fill(ARROW_GLOW));
        canvas.drawCircle(px, py, 1.5 * scale, fill(ARROW_COLOR));
      } else {
        canvas.drawCircle(p.x * scale, p.y * scale, 3.6 * scale, fill(PROJECTILE_GLOW));
        canvas.drawCircle(p.x * scale, p.y * scale, 1.9 * scale, fill(PROJECTILE_COLOR));
      }
    }

    // 트레이서 (활/마법 즉시타격 시각 — 발사점→타깃 보간 이동)
    for (const t of engine.tracers) {
      const tp = 1 - t.life / t.maxLife;
      const tx = t.fromX + (t.tx - t.fromX) * tp;
      const ty = t.fromY + (t.ty - t.fromY) * tp;
      canvas.drawCircle(tx * scale, ty * scale, 1.0 * scale, fill(t.color));
    }

    // 스킬/광역 연출 — 경고(텔레그래프)는 고정 반경 위험존, 타격은 퍼지는 링
    // (효과는 소수라 프레임당 일시 Paint 생성 허용 — 동적 알파 때문)
    for (const fx of engine.effects) {
      const progress = 1 - fx.life / fx.maxLife; // 0→1 (경고: 임박할수록 1)
      if (fx.warning) {
        const inner = Skia.Paint();
        inner.setAntiAlias(true);
        inner.setColor(Skia.Color(fx.color));
        inner.setAlphaf(Math.min(1, 0.12 + progress * 0.33));
        canvas.drawCircle(fx.x * scale, fx.y * scale, fx.maxRadius * scale, inner);
        const ring = Skia.Paint();
        ring.setAntiAlias(true);
        ring.setStyle(PaintStyle.Stroke);
        ring.setStrokeWidth(2.5);
        ring.setColor(Skia.Color(fx.color));
        ring.setAlphaf(Math.min(1, 0.5 + progress * 0.5));
        canvas.drawCircle(fx.x * scale, fx.y * scale, fx.maxRadius * scale, ring);
      } else {
        const ring = Skia.Paint();
        ring.setAntiAlias(true);
        ring.setStyle(PaintStyle.Stroke);
        ring.setStrokeWidth(2.5);
        ring.setColor(Skia.Color(fx.color));
        ring.setAlphaf(Math.max(0, Math.min(1, fx.life / fx.maxLife)));
        canvas.drawCircle(fx.x * scale, fx.y * scale, fx.maxRadius * progress * scale, ring);
      }
    }

    // 아군 영웅 — 클래스 테마 오라 + 본체 + 표식
    const theme = HERO_THEME[heroDef.id] ?? HERO_THEME.mir;
    const hx = hero.x * scale;
    const hy = hero.y * scale;
    const hr = engine.field.heroRadius * scale;
    if (!heroDead) {
      canvas.drawCircle(hx, hy, hr * 2.3, fill(theme.aura)); // 외곽 오라
      canvas.drawCircle(hx, hy, hr * 1.6, fill(theme.aura)); // 내곽 오라 (누적 → 밝아짐)
    }
    const heroBody = heroDead ? 'rgba(120,120,140,0.5)' : hero.hitFlash > 0 ? HIT_COLOR : theme.body;
    canvas.drawCircle(hx, hy, hr, fill(heroBody));
    canvas.drawCircle(hx, hy, hr, stroke(heroDead ? 'rgba(150,150,170,0.5)' : theme.ring, 1.8));
    if (!heroDead) canvas.drawCircle(hx, hy, hr * 0.42, fill('rgba(255,255,255,0.92)')); // 영웅 표식
  });

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <Canvas style={styles.fill}>
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
