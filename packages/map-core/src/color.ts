/** '#rgb' 또는 '#rrggbb' → [r, g, b] */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
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
