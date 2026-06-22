# 스프라이트 에셋 드롭인 규약 (Expo + Skia)

전투 화면은 현재 **절차적 Skia 렌더(원형 + 요새 + 오라)**다. 여기에 무료(CC0) 스프라이트를
얹는 파이프라인. 아래 규약대로 PNG를 넣으면 한 번에 연결한다.

## 1. 무료 에셋 소스 (라이선스 확인 필수 — CC0/CC-BY 권장)
- **Kenney** (https://kenney.nl/assets) — CC0(저작권 표기 불필요). 탑다운/타워디펜스/이펙트 다수. **1순위.**
- **itch.io** (https://itch.io/game-assets/free) — "Top-down", "Tower Defense", "Pixel" 태그. 라이선스 개별 확인.
- **OpenGameArt** (https://opengameart.org) — CC0/CC-BY 혼재. 필터에서 CC0 선택.
- **CraftPix Freebies** (https://craftpix.net/freebies) — 무료 2D 게임 에셋. 라이선스 개별 확인.
- **Game-icons.net** (https://game-icons.net) — CC-BY 단색 아이콘(병종/스킬 픽토그램에 적합).

## 2. 권장 형식
- **PNG, 투명 배경.** 유닛은 64×64 또는 128×128 정사각 권장(작게 렌더되므로 과대 불필요).
- 탑다운(위에서 본) 시점이 이 게임 좌표계(세로 전장)와 맞음.
- 다수 유닛은 **스프라이트 아틀라스(1장에 격자 배치)**가 성능에 유리 → Skia `drawAtlas`.

## 3. 파일 네이밍 (이 폴더에 배치)
유닛 종류 = 엔진 `EntityKind`. 파일명을 그대로 맞추면 자동 매핑하기 쉽다:
```
shield.png archer.png spear.png catapult.png swordsman.png
mageLow.png mageMid.png mageHigh.png assassin.png bomber.png
healer.png cavalry.png hero_maruhan.png hero_mir.png hero_noeul.png
tower.png wall.png barricade.png trap.png
background.png   (선택 — 전장 배경)
```
아군/적은 색 틴트(테두리)로 구분하므로 종류당 1장이면 됨.

## 4. 적용 방법 (연결 시 한 번에 작업)
1. 위 PNG들을 이 폴더에 넣는다.
2. `BattleField.tsx`에서 Skia로 프리로드:
   ```ts
   import { useImage } from '@shopify/react-native-skia';
   const towerImg = useImage(require('../../assets/sprites/tower.png'));
   // ... 종류별로 useImage (또는 아틀라스 1장 + drawAtlas)
   ```
3. 명령형 Picture 루프에서 원형 대신 이미지:
   ```ts
   if (towerImg) {
     canvas.drawImageRect(towerImg, srcRect, dstRect, paint);
   } else {
     // 폴백: 기존 절차적 원형/요새
   }
   ```
4. 이미지가 없으면 **자동으로 기존 절차적 렌더로 폴백** → 빌드 안 깨짐.

> ⚠️ 중요: 존재하지 않는 PNG를 `require()`하면 Metro 번들이 실패한다.
> 그래서 **파일을 먼저 넣은 뒤** require/연결을 추가한다(이 순서 지킬 것).

## 5. 다음 단계
PNG를 넣거나 "Kenney XX 팩 써줘"라고 지정하면, 위 4번을 코드로 연결(폴백 포함)해 준다.
배경 1장만 먼저 넣어도 분위기가 크게 바뀐다(저위험).
