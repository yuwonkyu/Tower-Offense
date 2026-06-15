# 에셋 소싱 가이드 (Tower Offense)

> 프로토타입은 Skia 도형 렌더링으로 동작. 이 문서는 **무료/상업가능 에셋을 실제로 구해서**
> 스프라이트로 교체하기 위한 소싱 계획·라이선스·매니페스트. (디자인 단계 = P3)

## 1. 추천 무료 소스 (전부 상업 사용 가능)

| 소스 | 라이선스 | 용도 | 비고 |
|------|----------|------|------|
| **Kenney — Tower Defense (Top-Down)** | CC0 (출처 불필요) | 타워/구조물/투사체/UI | 300종, 벡터+PNG |
| **Kenney — Medieval RTS** | CC0 | 유닛/건물 top-down | 120종 |
| **Kenney — Game Icons / UI Pack** | CC0 | 버튼·아이콘·HUD | 스탯 아이콘 |
| **Pixel Frog — Tiny Swords** | 무료(상업 OK, 출처 선택) | 아군 유닛/영웅 픽셀 | Warrior/Archer/Lancer/Monk + 애니메이션 |
| **Kenney — Interface Sounds / RPG Audio** | CC0 | UI SFX / 전투 SFX | |
| **OpenGameArt (CC0 필터)** | CC0 | BGM / 보충 | 라이선스 개별 확인 필수 |

**다운로드 링크**
- Kenney Tower Defense (Top-Down): https://kenney.nl/assets/tower-defense-top-down
- Kenney Medieval RTS: https://kenney.nl/assets/medieval-rts
- Kenney Tower Defense Kit: https://kenney.nl/assets/tower-defense-kit
- Tiny Swords (Pixel Frog): https://pixelfrog-assets.itch.io/tiny-swords

> ⚠️ **라이선스 원칙**: Kenney = CC0(완전 자유). Tiny Swords = 상업 가능하나 **재배포/재판매 금지**
> → 게임에 넣는 건 OK, 에셋 자체를 따로 배포하면 안 됨. 출처 표기는 선택(권장).
> AI 생성 이미지(미드저니 등)를 쓸 경우 각 서비스의 상업 라이선스 약관 확인.

## 2. 유닛 → 에셋 매핑 (아군 = Tiny Swords 우선)

| 게임 유닛 | 추천 스프라이트 | 대체 |
|-----------|----------------|------|
| 검사 swordsman | Tiny Swords — Warrior | Kenney Medieval RTS unit |
| 방패병 shield | Tiny Swords — Lancer(방패형) | — |
| 활병 archer | Tiny Swords — Archer | — |
| 창병 spear | Tiny Swords — Lancer | — |
| 투석기 catapult | Tiny Swords — Catapult/공성 | Kenney TD siege |
| 치유사 healer | Tiny Swords — Monk | — |
| 마법사 mage(하/중/상) | Tiny Swords 미포함 → AI생성 or OGA 마법사 | 색/이펙트로 등급 구분 |
| 암살자 assassin | OGA/별도 — 후드 캐릭터 | 색 변형 |
| 폭탄병 bomber | 별도 — 폭탄 든 고블린류 | |
| 기마병 cavalry | 별도 — 기마 유닛 | |

> 적군은 동일 스프라이트 **색조(tint) 반전**으로 구분 (붉은 팀). Tiny Swords는 팀 색상 변형 제공.

## 3. 영웅 → 에셋 매핑

| 영웅 | 컨셉 | 추천 |
|------|------|------|
| 마루한 (탱커) | 돌격대장 | Tiny Swords Warrior(대형) or 커스텀 일러스트 |
| 미르 (궁사) | 원거리 | Archer 대형 |
| 노을 (암살자) | 기동/회피 | 후드 암살자 일러스트 |
| 적: 기사/마법사/팔라딘 | 보스 | Kenney/AI 일러스트 (현재 이모지 ⚔️🔮👑) |

## 4. 그 외 필요 에셋

- **타워 외관 4단계** (HP 100/60/30/0%): Kenney TD 타워 + 파손 단계 (현재 색상 변화만)
- **구조물**: 성벽/바리케이트/트랩 (Kenney TD-Kit)
- **투사체**: 화살/투석/마법탄 (Kenney TD)
- **VFX**: 현재 Skia 링/플래시 → 스프라이트 시트 교체 (타격/스킬/화염/기절)
- **UI 아이콘**: 스탯(공/방/체/공속), 재화(금화·다이아), 카드 종류
- **사운드**: BGM(메뉴/전투/보스), SFX(공격·피격·스킬·타워파괴·승리·패배·카드픽·버튼)

## 5. 통합 파이프라인 (스프라이트 교체 방법)

1. 다운로드한 PNG/스프라이트시트를 `assets/game/<카테고리>/`에 배치
2. `src/data/assetMap.ts` 신설 — `unitId → require('...')` 매핑 (현재 없음)
3. `BattleField.tsx`의 Skia `Circle` 렌더를 `Image`(@shopify/react-native-skia `useImage`)로 교체
   - 유닛 위치/회전/애니메이션 프레임은 엔진 좌표 그대로 사용 (렌더만 교체)
4. 적군은 `tint`(ColorMatrix) 또는 팀 색상 변형 시트 사용
5. SFX는 `expo-audio`로 이벤트 훅(타격/스킬/처치) 연결 — 엔진에 이벤트 콜백 추가 필요
6. 에셋 교체는 **렌더 레이어만** 건드림 — 시뮬/밸런스 로직 불변 (현 구조가 이미 분리돼 있음)

## 6. 폴더 구조 (`assets/game/`)

```
assets/game/
  units/      유닛 스프라이트(시트)
  heroes/     영웅 일러스트/스프라이트
  enemies/    적 영웅·미니보스
  tower/      타워 4단계 + 구조물
  fx/         이펙트 스프라이트시트
  ui/         아이콘/버튼
  audio/
    bgm/
    sfx/
```

## 7. 다음 행동 (사용자)

- [ ] 위 4개 팩 다운로드 → `assets/game/` 하위에 배치
- [ ] 마법사/암살자/폭탄병/기마병 등 미매핑 유닛은 AI생성 or OGA에서 보충
- [ ] BGM 1~2트랙(메뉴/전투) 확보 (OGA CC0)
- [ ] 배치 완료되면 통합(파이프라인 2~5) 작업 요청 → 렌더 레이어 교체 진행
