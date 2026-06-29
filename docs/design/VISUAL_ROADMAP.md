# 비주얼 로드맵 (Tower Offense)

> 최종 업데이트: 2026-06-29  
> 목적: 현재 렌더 상태 확인, 미완성 에셋 소싱 가이드, 향후 비주얼 작업 우선순위 정리.

---

## 1. 현재 렌더 상태 요약

### 완료 (스프라이트 연결됨)

| 엔티티 | 렌더 방식 | 에셋 |
|--------|----------|------|
| 영웅 — 마루한 | `drawImageRect` + 오라 글로우 | `assets/game/units/hero_maruhan.png` |
| 영웅 — 미르 | `drawImageRect` + 오라 글로우 | `assets/game/units/hero_mir.png` |
| 영웅 — 노을 | `drawImageRect` + 오라 글로우 | `assets/game/units/hero_noeul.png` |
| 투사체 — 영웅 화살 | `drawImageRect` + 방향 회전 | `assets/game/projectiles/hero_arrow.png` |
| 투사체 — 궁수 화살 | `drawImageRect` + 방향 회전 | `assets/game/projectiles/archer_arrow.png` |
| 투사체 — 돌 (투석기) | `drawImageRect` (회전 없음) | `assets/game/projectiles/stone.png` |

### 미완성 (Skia 도형 fallback 사용 중)

| 엔티티 | 현재 렌더 | 필요한 에셋 |
|--------|----------|-----------|
| 일반 유닛 전체 (검사·방패·창·활병 등) | 채색 원 | Tiny Swords 스프라이트 시트 |
| 적 유닛 / 미니보스 | 채색 원 (빨간 테두리) | 별도 소싱 필요 |
| 마법사 tracer | 보라색 점 (spawnTracer) | 마법 투사체 스프라이트 |
| 타워 (4단계 파손) | Skia 요새 벡터 | Kenney TD 타워 또는 커스텀 |
| VFX (타격/스킬/화염/기절) | Skia 링·플래시 | 이펙트 스프라이트 시트 |
| 오디오 (BGM/SFX) | 없음 | OGA CC0 또는 별도 소싱 |

---

## 2. 마법사 투사체 — AI 이미지 생성 프롬프트

> 마법사 3등급(하/중/고)은 현재 hitscan + `spawnTracer()` 방식.  
> 스프라이트 추가 후 tracer 렌더 루프에 `drawImageRect`를 연결하거나  
> Projectile 시스템으로 전환해 기존 투사체 렌더 경로를 재사용한다.  
> 출력 사양: **PNG, 투명 배경, 128×128px** (또는 64×64).

---

### 2-1. mageLow — 하급 마법 투사체 (`mage_low.png`)

**게임 속 역할**: Lv1 마법사. 단일 타격, 소형 마법탄.  
색상 레퍼런스: `#9b6fd4` (연보라), tracer `rgba(190,130,245,0.95)`

**영문 프롬프트 (Midjourney / DALL-E / Stable Diffusion)**
```
top-down 2.5D mobile game asset, small arcane magic bolt projectile,
soft lavender-purple glowing orb, gentle light emission, subtle particle wisps,
transparent background, PNG sprite, 128x128 pixels, pixel art style,
clean crisp edges, fantasy RPG game asset
```

**한국어 설명 (참고용)**
```
탑뷰 2.5D 모바일 게임 에셋, 소형 아르케인 마법탄,
연보라색 발광 구체, 부드러운 광채, 미세한 파티클 잔상,
투명 배경, PNG 스프라이트, 128×128px, 픽셀 아트 스타일
```

**대체 프롬프트 (더 포토리얼리스틱)**
```
fantasy game projectile sprite, small purple magic missile, glowing lavender energy sphere,
soft aura halo, no background, isolated on transparent, game-ready asset, 128x128
```

---

### 2-2. mageMid — 중급 마법 투사체 (`mage_mid.png`)

**게임 속 역할**: Lv3 마법사. 중형 마법 구체, 상위 피해량.  
색상 레퍼런스: `#7e4fc4` (중간 보라), 반경 mageLow보다 약간 큼

**영문 프롬프트**
```
top-down 2.5D mobile game asset, medium arcane magic orb projectile,
deep violet-purple energy sphere, crackling magical energy around the edges,
inner bright core with outer glow, particle trails, transparent background,
PNG sprite, 128x128 pixels, semi-realistic mobile RPG game art
```

**한국어 설명**
```
탑뷰 2.5D 모바일 게임 에셋, 중형 아르케인 마법 구체,
짙은 보라색 에너지 구체, 테두리에 마법 에너지 크랙,
밝은 중심 코어 + 외부 글로우, 파티클 잔상,
투명 배경, 128×128px
```

---

### 2-3. mageHigh — 고급 마법 투사체 (`mage_high.png`)

**게임 속 역할**: Lv5 마법사. 대형 마법탄, 연쇄 번개(chain lightning) 특수효과.  
색상 레퍼런스: `#5f2fb0` (진한 인디고 보라), 가장 크고 위협적인 외형

**영문 프롬프트**
```
top-down 2.5D mobile game asset, large powerful arcane blast projectile,
dark indigo deep purple energy core, crackling chain lightning arcs radiating outward,
intense magical glow with electric sparks, ominous dark aura ring,
transparent background, PNG sprite, 128x128 pixels, high-quality mobile game art,
dramatic magical energy, threatening appearance
```

**한국어 설명**
```
탑뷰 2.5D 모바일 게임 에셋, 대형 강력한 아르케인 폭발 투사체,
짙은 인디고 보라색 에너지 코어, 외부로 뻗어나가는 연쇄 번개 아크,
강렬한 마법 글로우 + 전기 스파크, 불길한 어두운 오라 링,
투명 배경, 128×128px, 위협적 외형
```

**mageHigh 추가 키워드 (프롬프트에 붙여쓰기)**
```
, sigil markings, rune glow, high damage visual indicator
```

---

### 2-4. 통합 스타일 가이드 (3종 공통)

| 항목 | 규격 |
|------|------|
| 출력 크기 | 128×128px 권장 (64×64 허용) |
| 배경 | 완전 투명 (알파 채널 필수) |
| 파일 형식 | PNG |
| 배치 경로 | `assets/game/projectiles/mage_low.png` 등 |
| 스타일 | 탑뷰 2.5D, 픽셀 아트 또는 세미 리얼리스틱 |
| 색조 방향 | 하급 연보라 → 중급 보라 → 고급 짙은 인디고 (점진적으로 어둡고 강렬) |

---

## 3. 향후 비주얼 작업 로드맵

우선순위 순. 엔진·밸런스 로직은 건드리지 않고 렌더 레이어만 교체.

---

### P1 — 마법사 투사체 스프라이트 (즉시)

- [ ] 위 프롬프트로 3종 이미지 생성
- [ ] `assets/game/projectiles/mage_low.png` / `mage_mid.png` / `mage_high.png` 배치
- [ ] `BattleField.tsx` tracer 렌더 루프에 `useImage` + `drawImageRect` 연결
  - 또는 mage를 `Projectile` 시스템으로 전환 (projectileSpeed 설정 필요)
- 기술 메모: 현재 tracer는 `spawnTracer(target.x, target.y, color, radius)` → 0.13초 동안 점 이동
  - 스프라이트 연결 시 점 대신 `drawImageRect` 사용, 회전각은 `atan2(dy, dx)` 계산

---

### P2 — 일반 유닛 스프라이트 교체

> Tiny Swords (픽셀 프로그) 또는 Kenney Medieval RTS 소싱 후 진행.

| 유닛 | 추천 스프라이트 | 특이사항 |
|------|----------------|---------|
| 검사 swordsman | Tiny Swords — Warrior | 정면 단일 프레임 먼저 |
| 방패병 shield | Tiny Swords — Lancer(방패형) | — |
| 창병 spear | Tiny Swords — Lancer | — |
| 활병 archer | Tiny Swords — Archer | 이미 `archer_arrow.png` 있음 |
| 투석기 catapult | Tiny Swords — Catapult | — |
| 치유사 healer | Tiny Swords — Monk | — |
| 암살자 assassin | OGA 후드 캐릭터 or AI생성 | — |
| 폭탄병 bomber | AI생성 or OGA | — |
| 기마병 cavalry | AI생성 or OGA | — |

- 적군 유닛: 동일 스프라이트 + **빨간 ColorMatrix tint** 적용 (현재 빨간 테두리 원과 동일 개념)
- 구현 순서: `assetMap.ts` 신설 → `EntityKind → require()` 매핑 → BattleField 교체

---

### P3 — 8방향 스프라이트 (이동 방향별 외형)

현재 모든 유닛이 방향 무관하게 동일 스프라이트 표시됨.

**필요 작업**
- 스프라이트 시트 형식: 각 유닛 × 8방향 (N/NE/E/SE/S/SW/W/NW)
- 엔진의 `entity.dx, entity.dy` (이동 벡터)로 방향 계산:  
  ```typescript
  const dir8 = Math.round(Math.atan2(dy, dx) / (Math.PI / 4) + 4) % 8;
  ```
- BattleField에서 스프라이트 시트 `srcRect` 계산해 8방향 프레임 참조
- **권장 접근**: 정면 1방향 먼저 완성 → 8방향은 에셋 확보 후 추가

---

### P4 — 애니메이션 프레임 (공격·이동 모션)

**공격 모션**
- 유닛이 `attackCooldown === maxCooldown` (공격 직후) 일 때 공격 프레임 표시
- 스프라이트 시트: 이동 4~6프레임 + 공격 2~4프레임
- 구현: `entity.attackCooldown / entity.maxCooldown` 비율로 현재 프레임 인덱스 계산

**이동 모션**
- `entity.x, entity.y` 변화량으로 보행 사이클 구동
- 60fps 기준 4프레임 루프 → 약 0.25초 주기

---

### P5 — 타격·피격 이펙트 (VFX)

현재: Skia 원형 링 + 알파 페이드 (`hitFlash`, `deathTimer`).  
목표: 스프라이트 시트 이펙트로 교체 또는 병행.

| 이펙트 | 트리거 | 현재 구현 | 목표 |
|--------|--------|----------|------|
| 타격(hit) | 유닛 피격 시 | `hitFlash` 흰 ColorFilter | 타격 스파크 스프라이트 |
| 처치(death) | HP 0 | `deathTimer` 원 축소 | 폭발 또는 붕괴 애니메이션 |
| 스킬 이펙트 | 특수 스킬 사용 | Skia 링 | 스프라이트 오버레이 |
| 화염 (bomber) | 폭탄병 폭발 | Skia 원 | 화염 이펙트 시트 |

- 스프라이트 시트 위치: `assets/game/fx/`
- 추천 소스: Kenney TD Kit VFX / OpenGameArt (CC0 필터)

---

### P6 — 상태이상 이펙트

| 상태이상 | 시각 효과 | 구현 방식 |
|---------|----------|---------|
| 화상 (burn) | 주황 불꽃 파티클 | entity 위에 Skia 또는 스프라이트 |
| 기절 (stun) | 별/나선 아이콘 | entity 위 회전 아이콘 |
| 출혈 (bleed) | 빨간 방울 | 아래로 떨어지는 점 파티클 |
| 빙결 (freeze) | 파란 얼음 크리스탈 | 반투명 파란 오버레이 |
| 감속 (slow) | 파란 물결 | entity 주위 원형 물결 |

- 엔진에 상태이상 관련 필드(`statusEffects: string[]`) 추가 후 렌더 참조

---

### P7 — 영웅·유닛 오라 이펙트

현재: 영웅만 더블 원 오라 (클래스별 색상).  
목표: 보스·특수 유닛에 오라 추가, 애니메이션 적용.

| 대상 | 오라 색상 | 추가 효과 |
|------|----------|---------|
| 영웅 (현재) | 클래스별 | 더블 원 글로우 ✅ |
| paladinBoss | 금색 `#ffd700` | 펄스 애니메이션 |
| mageHigh | 인디고 `#5f2fb0` | 전기 아크 |
| 보스 적 | 진홍 `#cc2200` | 회전 룬 링 |

---

### P8 — 오디오 (BGM / SFX)

현재: 전체 무음.

| 분류 | 트랙 | 추천 소스 |
|------|------|---------|
| BGM 메뉴 | 서사적 판타지 루프 | OpenGameArt CC0 |
| BGM 전투 | 긴장감 있는 루프 | OpenGameArt CC0 |
| BGM 보스 | 강렬한 드럼+오케스트라 | OpenGameArt CC0 |
| SFX 공격 | 칼·활·투석기·마법 | Kenney RPG Audio |
| SFX 피격 | 타격음·방어음 | Kenney RPG Audio |
| SFX 처치 | 유닛 처치음 | Kenney RPG Audio |
| SFX UI | 버튼·카드픽·레벨업 | Kenney Interface Sounds |
| SFX 승리/패배 | 팡파레·드럼롤 | OpenGameArt CC0 |

- 구현: `expo-audio` 훅 + 엔진 이벤트 콜백 연결
- 배치 경로: `assets/game/audio/bgm/`, `assets/game/audio/sfx/`

---

## 4. 우선순위 요약표

| 순위 | 작업 | 기간 추정 | 블로커 |
|------|------|----------|--------|
| P1 | 마법사 투사체 스프라이트 | 0.5일 | AI 이미지 생성 |
| P2 | 일반 유닛 스프라이트 교체 | 2~3일 | Tiny Swords 다운로드 |
| P3 | 8방향 스프라이트 | 1주+ | P2 완료 후 |
| P4 | 공격·이동 애니메이션 | 1주+ | 스프라이트 시트 확보 |
| P5 | 타격·처치 VFX | 3~4일 | P2 완료 후 병행 가능 |
| P6 | 상태이상 이펙트 | 3~4일 | 엔진 `statusEffects` 필드 추가 필요 |
| P7 | 오라 애니메이션 | 1~2일 | 독립 진행 가능 |
| P8 | 오디오 | 2~3일 | expo-audio 연결 + 에셋 소싱 |

---

## 5. 기술 참조 — Skia 렌더 패턴

```typescript
// 스프라이트 표시 (방향 없음)
const img = useImage(require('@/assets/game/units/unit.png'));
if (img) {
  const hw = radius * 2;
  canvas.drawImageRect(
    img,
    Skia.XYWHRect(0, 0, img.width(), img.height()), // src
    Skia.XYWHRect(cx - hw, cy - hw, hw * 2, hw * 2), // dst
    fill('rgba(0,0,0,1)'),
  );
}

// 방향 있는 스프라이트 (화살 등)
canvas.save();
canvas.rotate(angleDeg, cx, cy); // Skia: 3인수 필수
canvas.drawImageRect(img, src, dst, paint);
canvas.restore();

// 색조 변환 (ColorFilter — 적군 빨간 팀)
const tintPaint = Skia.Paint();
tintPaint.setColorFilter(
  Skia.ColorFilter.MakeMatrix([
    1, 0, 0, 0, 80,   // R boost
    0, 0.3, 0, 0, 0,  // G reduce
    0, 0, 0.3, 0, 0,  // B reduce
    0, 0, 0, 1, 0,
  ])
);
canvas.drawImageRect(img, src, dst, tintPaint);
```
