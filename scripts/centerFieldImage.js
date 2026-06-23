/**
 * 전장 배경 PNG의 흙(클리어링+길) 무게중심을 정중앙으로 크롭한다.
 * 배경 중앙정렬(cover)만으로 타워(화면 중앙)와 클리어링이 정렬되게 하는 1회 전처리.
 * 사용: node scripts/centerFieldImage.js [경로]  (기본 assets/game/field/field_human.png)
 * 새 종족 필드(field_<race>.png) 받으면 이걸 한 번 돌려서 중앙 정렬해두면 됨.
 */
const { PNG } = require('pngjs');
const fs = require('fs');

const path = process.argv[2] || 'assets/game/field/field_human.png';
const png = PNG.sync.read(fs.readFileSync(path));
const { width: W, height: H, data } = png;

// 흙/길(탄·카키): R이 G에 근접 + B가 확연히 낮음 (풀은 G>>R라 제외)
let sx = 0,
  sy = 0,
  n = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const R = data[i];
    const G = data[i + 1];
    const B = data[i + 2];
    if (R >= G - 22 && B <= G - 30 && G >= 110 && G <= 220 && R >= 130) {
      sx += x;
      sy += y;
      n++;
    }
  }
}
if (n === 0) {
  console.error('흙 픽셀을 못 찾았습니다 — 임계값 조정 필요');
  process.exit(1);
}

const cx = Math.round(sx / n);
const cy = Math.round(sy / n);
const cropW = 2 * Math.min(cx, W - cx);
const cropH = 2 * Math.min(cy, H - cy);
const ox = cx - cropW / 2;
const oy = cy - cropH / 2;

const out = new PNG({ width: cropW, height: cropH });
PNG.bitblt(png, out, ox, oy, cropW, cropH, 0, 0);
fs.writeFileSync(path, PNG.sync.write(out));
console.log(`centered: ${W}x${H} → ${cropW}x${cropH} (centroid ${cx},${cy})`);
