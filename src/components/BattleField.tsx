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
  BlendMode,
  Canvas,
  createPicture,
  PaintStyle,
  Picture,
  Skia,
  useImage,
  type SkCanvas,
  type SkPaint,
} from '@shopify/react-native-skia';
import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
// 전장 배경 — 인간 종족 필드 (스1~30). 8종족 확장 시 field_<race>.png 추가
import FIELD_BG from '@/assets/game/field/field_human.png';
// 구조물 스프라이트
import STRUCT_HUMAN_BARRICADE from '@/assets/game/units/Human_barricade.png';
import STRUCT_HUMAN_TRAP from '@/assets/game/units/Human_trap.png';
import STRUCT_HUMAN_WALL from '@/assets/game/units/Human_wall.png';
// 유닛 스프라이트 — assets/game/units/{Race}_{unitId}.png
import UNIT_HUMAN_ARCHER from '@/assets/game/units/Human_Archer.png';
import UNIT_HUMAN_ASSASSIN from '@/assets/game/units/Human_assassin.png';
import UNIT_HUMAN_BOMBER from '@/assets/game/units/Human_bomber.png';
import UNIT_HUMAN_CATAPULT from '@/assets/game/units/Human_catapult.png';
import UNIT_HUMAN_CAVALRY from '@/assets/game/units/Human_cavalry.png';
import UNIT_HUMAN_HEALER from '@/assets/game/units/Human_healer.png';
import UNIT_HUMAN_KNIGHTMINI from '@/assets/game/units/Human_knightMini.png';
import UNIT_HUMAN_MAGEHIGH from '@/assets/game/units/Human_mageHigh.png';
import UNIT_HUMAN_MAGELOW from '@/assets/game/units/Human_mageLow.png';
import UNIT_HUMAN_MAGEMID from '@/assets/game/units/Human_mageMid.png';
import UNIT_HUMAN_MAGEMINI from '@/assets/game/units/Human_mageMini.png';
import UNIT_HUMAN_PALADINBOSS from '@/assets/game/units/Human_paladinBoss.png';
import UNIT_HUMAN_SHIELD from '@/assets/game/units/Human_shield.png';
import UNIT_HUMAN_SPEAR from '@/assets/game/units/Human_spear.png';
import UNIT_HUMAN_SWORDSMAN from '@/assets/game/units/Human_swordsman.png';
// 영웅 스프라이트 — assets/game/units/hero_{id}.png
import HERO_MARUHAN from '@/assets/game/units/hero_maruhan.png';
import HERO_MIR from '@/assets/game/units/hero_mir.png';
import HERO_NOEUL from '@/assets/game/units/hero_noeul.png';
// 투사체 스프라이트 — assets/game/projectiles/
import PROJ_ARCHER_ARROW from '@/assets/game/projectiles/archer_arrow.png';
import PROJ_HERO_ARROW from '@/assets/game/projectiles/hero_arrow.png';
import PROJ_STONE from '@/assets/game/projectiles/stone.png';

// 종족별 타워 아트 (2.5D 항공샷, 500×500 RGBA, 원형 바닥 포함)
import TOWER_BEASTKIN from '@/assets/game/tower/Beastkin.png';
import TOWER_CELESTIAL from '@/assets/game/tower/Celestial.png';
import TOWER_DEMON from '@/assets/game/tower/Demon.png';
import TOWER_DRAGON from '@/assets/game/tower/Dragon.png';
import TOWER_DWARF from '@/assets/game/tower/Dwarf.png';
import TOWER_ELF from '@/assets/game/tower/Elf.png';
import TOWER_GIANT from '@/assets/game/tower/Giant.png';
import TOWER_HUMAN from '@/assets/game/tower/Human.png';
import {
  BattleEngine,
  isStructure,
  makeFieldLayout,
  type CombatEntity,
  type EntityKind,
} from '@/game/engine/engine';
import type { HeroDef, StageConfig, TowerRace } from '@/game/types';
import { useProgressStore } from '@/store/progressStore';

/** 종족 → 타워 PNG(asset id) 매핑. config.race로 선택, 미설정 시 Human */
const TOWER_ART: Record<TowerRace, number> = {
  Human: TOWER_HUMAN,
  Demon: TOWER_DEMON,
  Elf: TOWER_ELF,
  Dwarf: TOWER_DWARF,
  Dragon: TOWER_DRAGON,
  Beastkin: TOWER_BEASTKIN,
  Giant: TOWER_GIANT,
  Celestial: TOWER_CELESTIAL,
};

// ── 타워 아트 배치 보정 (8종 공통 — 500×500 동일 프레이밍 가정, 인게임 보고 미세조정) ──
/** 원형 단상 rim이 도달할 논리 반경(필드 단위). 배경 클리어링을 채우도록 keep-out(17)보다 크게 */
const TOWER_ART_RADIUS_UNITS = 24;
/** 이미지 폭 대비 단상(타원) 반폭 비율 — 이 부분이 위 반경에 매핑됨 */
const TOWER_ART_PLATFORM_HALFW = 0.46;
/** 이미지 높이 대비 단상 중심의 세로 위치 — 이 지점이 타워 논리좌표(tx,ty)에 정렬됨 */
const TOWER_ART_ANCHOR_Y = 0.72;

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

// 마법사 등급별 투사체(트레이서) 비주얼 — 헤일로 글로우 + 코어 + 반경. 하→중→상 점점 짙고 큼
const MAGE_TRACER: Partial<Record<EntityKind, { glow: string; core: string; bright: string; r: number }>> = {
  mageLow:  { glow: 'rgba(180,135,250,0.40)', core: 'rgba(205,170,252,1)', bright: 'rgba(245,235,255,0.95)', r: 3.0 },
  mageMid:  { glow: 'rgba(150,80,238,0.46)',  core: 'rgba(178,108,244,1)', bright: 'rgba(240,225,255,0.95)', r: 3.5 },
  mageHigh: { glow: 'rgba(120,55,232,0.52)',  core: 'rgba(150,90,250,1)',  bright: 'rgba(235,220,255,0.98)', r: 4.0 },
};
const ARROW_COLOR = 'rgba(205,240,255,1)'; // 영웅 화살 본체 (시안빛 — 투석탄과 구분)
const ARROW_GLOW = 'rgba(95,185,255,0.45)'; // 영웅 화살 글로우 + 비행 잔상

const ALLY_STROKE = 'rgba(120,200,255,0.9)';
const ENEMY_STROKE = 'rgba(255,70,70,0.95)'; // 적 유닛 빨강 테두리 — 아군(시안)과 즉시 구분 (프로토타입 가독성)

// 진영 식별: 유닛 발밑 타원 디스크 — 같은 스프라이트를 써도 팀이 즉시 구분됨 (top-down RTS 표준)
const ALLY_BASE = 'rgba(60,150,255,0.55)'; // 아군 발밑 — 파랑
const ENEMY_BASE = 'rgba(235,45,45,0.6)'; // 적 발밑 — 빨강

/** 피격 순간 번쩍 (타격감) */
const HIT_COLOR = 'rgba(255,255,255,0.95)';

/** 배경 맵을 타워 위치에 맞춰 그릴 때 cover보다 살짝 확대 — 타워가 중앙에서 벗어나도 클리어링이 따라올 여유 */
const BG_ZOOM = 1.15;

/**
 * 유닛 스프라이트 크기 배수 — 충돌 반경(논리값) 대비 화면 표시 크기.
 * 충돌 반경 자체는 너무 작아 보이지 않으므로 크게 키워 캐릭터가 읽히게 한다.
 * 인게임 보고 조정: 너무 크면 ↓, 겹쳐 보이면 ↓
 */
const UNIT_SPRITE_SCALE = 1.5;


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
  // 전장 배경 이미지 (로드 전 null) — cover는 Skia에서 직접 계산해 그린다
  const bgImage = useImage(FIELD_BG);
  // 종족별 타워 아트 (로드 전 null → 절차적 폴백). config.race 변경 시 자동 재로드
  const towerImage = useImage(TOWER_ART[config.race ?? 'Human']);
  // 구조물 스프라이트
  const imgWall       = useImage(STRUCT_HUMAN_WALL);
  const imgBarricade  = useImage(STRUCT_HUMAN_BARRICADE);
  const imgTrap       = useImage(STRUCT_HUMAN_TRAP);
  const structImageMap: Partial<Record<EntityKind, ReturnType<typeof useImage>>> = {
    wall:      imgWall,
    barricade: imgBarricade,
    trap:      imgTrap,
  };
  // 유닛 스프라이트 — useImage는 훅이므로 최상위에서 모두 호출
  const imgArcher     = useImage(UNIT_HUMAN_ARCHER);
  const imgAssassin   = useImage(UNIT_HUMAN_ASSASSIN);
  const imgBomber     = useImage(UNIT_HUMAN_BOMBER);
  const imgCatapult   = useImage(UNIT_HUMAN_CATAPULT);
  const imgCavalry    = useImage(UNIT_HUMAN_CAVALRY);
  const imgHealer     = useImage(UNIT_HUMAN_HEALER);
  const imgKnightMini = useImage(UNIT_HUMAN_KNIGHTMINI);
  const imgMageHigh   = useImage(UNIT_HUMAN_MAGEHIGH);
  const imgMageLow    = useImage(UNIT_HUMAN_MAGELOW);
  const imgMageMid    = useImage(UNIT_HUMAN_MAGEMID);
  const imgMageMini   = useImage(UNIT_HUMAN_MAGEMINI);
  const imgPaladin    = useImage(UNIT_HUMAN_PALADINBOSS);
  const imgShield     = useImage(UNIT_HUMAN_SHIELD);
  const imgSpear      = useImage(UNIT_HUMAN_SPEAR);
  const imgSwordsman  = useImage(UNIT_HUMAN_SWORDSMAN);
  // 영웅 스프라이트
  const imgHeroMaruhan = useImage(HERO_MARUHAN);
  const imgHeroMir     = useImage(HERO_MIR);
  const imgHeroNoeul   = useImage(HERO_NOEUL);
  const heroImageMap: Record<string, ReturnType<typeof useImage>> = {
    maruhan: imgHeroMaruhan,
    mir:     imgHeroMir,
    noeul:   imgHeroNoeul,
  };
  // 투사체 스프라이트
  const imgArcherArrow = useImage(PROJ_ARCHER_ARROW);
  const imgHeroArrow   = useImage(PROJ_HERO_ARROW);
  const imgStone       = useImage(PROJ_STONE);
  // 유닛 종류 → 스프라이트 맵 (종족 추가 시 여기만 확장)
  const unitImageMap: Partial<Record<EntityKind, ReturnType<typeof useImage>>> = {
    archer:     imgArcher,
    assassin:   imgAssassin,
    bomber:     imgBomber,
    catapult:   imgCatapult,
    cavalry:    imgCavalry,
    healer:     imgHealer,
    knightMini: imgKnightMini,
    mageHigh:   imgMageHigh,
    mageLow:    imgMageLow,
    mageMid:    imgMageMid,
    mageMini:   imgMageMini,
    paladinBoss: imgPaladin,
    shield:     imgShield,
    spear:      imgSpear,
    swordsman:  imgSwordsman,
  };

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

    // 타워 화면 좌표 (성 렌더용)
    const tx = towerX * scale;
    const ty = towerY * scale;
    const tr = towerRadius * scale;

    // ── 배경 PNG: 맵 클리어링(이미지 정중앙으로 크롭됨)을 타워(tx,ty)에 맞춰 그림 = 맵이 타워를 따라감 (피드백) ──
    if (bgImage) {
      const W = size.w;
      const H = size.h;
      const iw = bgImage.width();
      const ih = bgImage.height();
      const s = Math.max(W / iw, H / ih) * BG_ZOOM; // cover + 약간 확대(타워 추종 여유)
      const dw = iw * s;
      const dh = ih * s;
      // 이미지 중앙(=클리어링)을 타워에 정렬. 화면 밖 빈공간 없게 클램프
      const dx = Math.min(0, Math.max(W - dw, tx - dw / 2));
      const dy = Math.min(0, Math.max(H - dh, ty - dh / 2));
      canvas.drawImageRect(
        bgImage,
        Skia.XYWHRect(0, 0, iw, ih),
        Skia.XYWHRect(dx, dy, dw, dh),
        fill('rgba(0,0,0,1)'), // 이미지 드로잉용 기본 페인트 (색상 무시됨)
      );
    }
    // 지형/지면은 PNG가 담당. 성 밑 흙은 추후 "바닥타일 포함 타워 에셋"으로 대체

    // ── 적 타워: 종족 PNG 아트 (2.5D 항공샷, 바닥 단상 포함) — 로드 전/실패 시 절차적 폴백 ──
    const dmgStage = towerPct > 0.6 ? 0 : towerPct > 0.3 ? 1 : towerPct > 0 ? 2 : 3;
    if (towerImage) {
      const iw = towerImage.width();
      const ih = towerImage.height();
      // 단상 반폭(이미지 비율)을 keep-out 반경에 매핑 → 8종 화면 크기 일관
      const drawScale = (TOWER_ART_RADIUS_UNITS * scale) / (TOWER_ART_PLATFORM_HALFW * iw);
      const dw = iw * drawScale;
      const dh = ih * drawScale;
      const dx = tx - dw / 2; // 가로 중앙 정렬
      const dy = ty - TOWER_ART_ANCHOR_Y * dh; // 단상 중심을 타워 논리좌표(tx,ty)에 정렬
      const src = Skia.XYWHRect(0, 0, iw, ih);
      const dst = Skia.XYWHRect(dx, dy, dw, dh);
      canvas.drawImageRect(towerImage, src, dst, fill('rgba(0,0,0,1)')); // 색 무시 (이미지 드로잉용)
      // 저체력 손상 틴트 — HP 낮을수록 타워(불투명 픽셀)가 붉고 어둑하게
      const dmg = 1 - towerPct;
      if (dmg > 0.45) {
        const tintP = Skia.Paint();
        tintP.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color('rgb(120,24,12)'), BlendMode.SrcATop));
        tintP.setAlphaf(Math.min(0.4, (dmg - 0.45) * 0.7));
        canvas.drawImageRect(towerImage, src, dst, tintP);
      }
      // 피격 플래시 — 타워 전체 붉은 번쩍 (타격감)
      if (engine.towerFlash > 0) {
        const flashP = Skia.Paint();
        flashP.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color('rgb(255,90,90)'), BlendMode.SrcATop));
        flashP.setAlphaf(0.5);
        canvas.drawImageRect(towerImage, src, dst, flashP);
      }
    } else {
      // 절차적 폴백 (상단 요새, 4단계 손상 외관) — 에셋 로드 전 한순간만 노출
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
    }

    // 구조물: 성벽/바리케이트/트랩 — 스프라이트 있으면 이미지, 없으면 원형
    for (const e of structures) {
      const v = UNIT_VISUALS[e.kind];
      const ex = e.x * scale;
      const ey = e.y * scale;
      const img = structImageMap[e.kind as keyof typeof structImageMap];
      if (img) {
        const hw = v.radius * scale * UNIT_SPRITE_SCALE;
        canvas.drawImageRect(img,
          Skia.XYWHRect(0, 0, img.width(), img.height()),
          Skia.XYWHRect(ex - hw, ey - hw, hw * 2, hw * 2),
          fill('rgba(0,0,0,1)'),
        );
      } else {
        canvas.drawCircle(ex, ey, v.radius * scale, fill(v.color));
      }
    }

    // ── 유닛 드로잉 헬퍼 ──
    // 스프라이트가 있으면 이미지, 없으면 원형 폴백. 팀 색 링은 항상 위에 오버레이.
    const drawUnit = (e: CombatEntity, teamStroke: string, isEnemy: boolean) => {
      const v = UNIT_VISUALS[e.kind];
      const ex = e.x * scale;
      const ey = e.y * scale;
      const r = v.radius * scale;
      const img = unitImageMap[e.kind as keyof typeof unitImageMap];
      if (img) {
        const hw = r * UNIT_SPRITE_SCALE;
        const src = Skia.XYWHRect(0, 0, img.width(), img.height());
        const dst = Skia.XYWHRect(ex - hw, ey - hw, hw * 2, hw * 2);
        // 팀 베이스 디스크 — 발밑 타원(스프라이트를 가리지 않으면서 진영 즉시 식별)
        const baseRx = hw * 0.72;
        const baseRy = hw * 0.3;
        const baseCy = ey + hw * 0.66;
        canvas.drawOval(
          Skia.XYWHRect(ex - baseRx, baseCy - baseRy, baseRx * 2, baseRy * 2),
          fill(isEnemy ? ENEMY_BASE : ALLY_BASE),
        );
        if (e.hitFlash > 0) {
          // 피격 번쩍 — 흰색 틴트 (팀 틴트보다 우선)
          const hitP = Skia.Paint();
          hitP.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color('rgb(255,255,255)'), BlendMode.SrcATop));
          hitP.setAlphaf(0.7);
          canvas.drawImageRect(img, src, dst, fill('rgba(0,0,0,1)'));
          canvas.drawImageRect(img, src, dst, hitP);
        } else {
          canvas.drawImageRect(img, src, dst, fill('rgba(0,0,0,1)'));
          // 진영 틴트 — 적군 붉은색 / 아군 푸른색 (투명 픽셀은 건드리지 않고 스프라이트 위만 물듦, 베이스 디스크와 함께 구분)
          const tintP = Skia.Paint();
          tintP.setColorFilter(
            Skia.ColorFilter.MakeBlend(
              Skia.Color(isEnemy ? 'rgb(225,40,40)' : 'rgb(55,135,255)'),
              BlendMode.SrcATop,
            ),
          );
          tintP.setAlphaf(isEnemy ? 0.24 : 0.18);
          canvas.drawImageRect(img, src, dst, tintP);
        }
      }
      // 스프라이트 없는 유닛은 표시 안 함 (미구현 종족 추가 전까지 비어있음)
    };

    // 적 유닛
    for (const e of enemies) drawUnit(e, ENEMY_STROKE, true);
    // 아군 유닛
    for (const e of allies) drawUnit(e, ALLY_STROKE, false);

    // 투사체 — 스프라이트 있으면 이미지(회전), 없으면 원형 글로우 폴백
    for (const p of engine.projectiles) {
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
      const px = p.x * scale;
      const py = p.y * scale;

      if (p.arrow || p.archerArrow) {
        // 영웅 화살(hero_arrow) vs 궁수 화살(archer_arrow)
        const arrowImg = p.arrow ? imgHeroArrow : imgArcherArrow;
        if (arrowImg) {
          const hw = 3.5 * scale;
          canvas.save();
          canvas.rotate(angleDeg, px, py);
          canvas.drawImageRect(
            arrowImg,
            Skia.XYWHRect(0, 0, arrowImg.width(), arrowImg.height()),
            Skia.XYWHRect(px - hw, py - hw * 0.4, hw * 2, hw * 0.8),
            fill('rgba(0,0,0,1)'),
          );
          canvas.restore();
        } else {
          // 폴백: 원형 글로우
          const bx = (dx / (Math.hypot(dx, dy) || 1)) * scale;
          const by = (dy / (Math.hypot(dx, dy) || 1)) * scale;
          canvas.drawCircle(px - bx * 2.4, py - by * 2.4, 1.1 * scale, fill(ARROW_GLOW));
          canvas.drawCircle(px - bx * 4.8, py - by * 4.8, 0.7 * scale, fill(ARROW_GLOW));
          canvas.drawCircle(px, py, 3.2 * scale, fill(ARROW_GLOW));
          canvas.drawCircle(px, py, 1.5 * scale, fill(ARROW_COLOR));
        }
      } else {
        // 투석탄
        if (imgStone) {
          const hw = 3.8 * scale;
          canvas.drawImageRect(
            imgStone,
            Skia.XYWHRect(0, 0, imgStone.width(), imgStone.height()),
            Skia.XYWHRect(px - hw, py - hw, hw * 2, hw * 2),
            fill('rgba(0,0,0,1)'),
          );
        } else {
          canvas.drawCircle(px, py, 3.6 * scale, fill(PROJECTILE_GLOW));
          canvas.drawCircle(px, py, 1.9 * scale, fill(PROJECTILE_COLOR));
        }
      }
    }

    // 트레이서 (활/마법 즉시타격 시각 — 발사점→타깃 보간 이동)
    // 활병 = 화살 스프라이트(방향 회전), 마법사 = 등급별 발광 마법탄(글로우+코어), 그 외 = 점
    for (const t of engine.tracers) {
      const tp = 1 - t.life / t.maxLife;
      const px = (t.fromX + (t.tx - t.fromX) * tp) * scale;
      const py = (t.fromY + (t.ty - t.fromY) * tp) * scale;
      const tdx = t.tx - t.fromX;
      const tdy = t.ty - t.fromY;

      if (t.kind === 'archer' && imgArcherArrow) {
        const ang = Math.atan2(tdy, tdx) * (180 / Math.PI);
        const hw = 3.2 * scale;
        canvas.save();
        canvas.rotate(ang, px, py);
        canvas.drawImageRect(
          imgArcherArrow,
          Skia.XYWHRect(0, 0, imgArcherArrow.width(), imgArcherArrow.height()),
          Skia.XYWHRect(px - hw, py - hw * 0.4, hw * 2, hw * 0.8),
          fill('rgba(0,0,0,1)'),
        );
        canvas.restore();
        continue;
      }

      const mv = MAGE_TRACER[t.kind];
      if (mv) {
        // 꼬리 잔상 — 진행 반대 방향으로 작은 글로우 2개 (마법탄 비행감)
        const len = Math.hypot(tdx, tdy) || 1;
        const ux = tdx / len;
        const uy = tdy / len;
        canvas.drawCircle(px - ux * 2.2 * scale, py - uy * 2.2 * scale, mv.r * 0.5 * scale, fill(mv.glow));
        canvas.drawCircle(px, py, mv.r * scale, fill(mv.glow));        // 헤일로
        canvas.drawCircle(px, py, mv.r * 0.5 * scale, fill(mv.core));  // 코어
        canvas.drawCircle(px, py, mv.r * 0.22 * scale, fill(mv.bright)); // 중심 하이라이트
        continue;
      }

      canvas.drawCircle(px, py, 1.0 * scale, fill(t.color));
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

    // 아군 영웅 — 스프라이트 있으면 이미지, 없으면 원형 폴백 (오라는 항상 표시)
    const theme = HERO_THEME[heroDef.id] ?? HERO_THEME.mir;
    const hx = hero.x * scale;
    const hy = hero.y * scale;
    const hr = engine.field.heroRadius * scale;
    const heroImg = heroImageMap[heroDef.id] ?? null;
    // 오라 (스프라이트 유무 관계없이 표시)
    if (!heroDead) {
      canvas.drawCircle(hx, hy, hr * 2.3, fill(theme.aura));
      canvas.drawCircle(hx, hy, hr * 1.6, fill(theme.aura));
    }
    if (heroImg) {
      const hw = hr * 2.0; // 원형보다 살짝 크게 (캐릭터 실루엣이 충분히 보이도록)
      const src = Skia.XYWHRect(0, 0, heroImg.width(), heroImg.height());
      const dst = Skia.XYWHRect(hx - hw, hy - hw, hw * 2, hw * 2);
      if (heroDead) {
        // 사망: 반투명 회색 틴트
        const deadP = Skia.Paint();
        deadP.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color('rgb(120,120,140)'), BlendMode.SrcATop));
        deadP.setAlphaf(0.6);
        canvas.drawImageRect(heroImg, src, dst, fill('rgba(0,0,0,1)'));
        canvas.drawImageRect(heroImg, src, dst, deadP);
      } else if (hero.hitFlash > 0) {
        // 피격 번쩍 — 흰색 틴트
        const hitP = Skia.Paint();
        hitP.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color('rgb(255,255,255)'), BlendMode.SrcATop));
        hitP.setAlphaf(0.7);
        canvas.drawImageRect(heroImg, src, dst, fill('rgba(0,0,0,1)'));
        canvas.drawImageRect(heroImg, src, dst, hitP);
      } else {
        canvas.drawImageRect(heroImg, src, dst, fill('rgba(0,0,0,1)'));
      }
    } else {
      // 폴백: 원형
      const heroBody = heroDead ? 'rgba(120,120,140,0.5)' : hero.hitFlash > 0 ? HIT_COLOR : theme.body;
      canvas.drawCircle(hx, hy, hr, fill(heroBody));
      canvas.drawCircle(hx, hy, hr, stroke(heroDead ? 'rgba(150,150,170,0.5)' : theme.ring, 1.8));
      if (!heroDead) canvas.drawCircle(hx, hy, hr * 0.42, fill('rgba(255,255,255,0.92)'));
    }
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
