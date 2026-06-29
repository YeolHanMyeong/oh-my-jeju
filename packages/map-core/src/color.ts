/** '#rgb' · '#rgba' · '#rrggbb' · '#rrggbbaa' → [r, g, b] (알파는 무시). 형식 불명이면 기본 파랑. */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 8)
    h = h.slice(0, 6); // #rrggbbaa → rrggbb
  else if (h.length === 4) h = h.slice(0, 3); // #rgba → rgb
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return [10, 132, 255]; // 알 수 없는 형식 → 기본 파랑
  const num = Number.parseInt(h, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** 두 색을 t(0~1) 비율로 혼합. 입력은 hex 또는 rgb(...) */
export function mix(color: string, withColor: string, t: number): string {
  const a = toRgb(color);
  const b = toRgb(withColor);
  const m = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

/** 색에 알파 적용 */
export function withAlpha(color: string, alpha: number): string {
  const [r, g, b] = toRgb(color);
  return `rgba(${r},${g},${b},${alpha})`;
}

function toRgb(color: string): [number, number, number] {
  if (color.startsWith('#')) return hexToRgb(color);
  const m = /rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return [10, 132, 255]; // 알 수 없는 형식 → 기본 파랑
}
