// 정적 이미지 에셋 모듈 선언 — `import bg from '@/assets/.../x.png'`를 타입 안전하게 사용.
// RN/Expo Metro가 자산을 number(asset id)로 변환 → <Image source={...}>에 그대로 전달 가능.
declare module '*.png' {
  const content: number;
  export default content;
}
declare module '*.jpg' {
  const content: number;
  export default content;
}
declare module '*.webp' {
  const content: number;
  export default content;
}
