const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * HTML 특수문자를 이스케이프한다. 문자열 popup에서 신뢰할 수 없는 속성값(BYOD/사용자 데이터)을
 * 끼워 넣을 때 XSS를 막기 위해 사용한다.
 *
 * ```ts
 * jeju.addDataLayer({
 *   data,
 *   popup: (f) => `<strong>${escapeHtml(f.properties?.name)}</strong>`,
 * });
 * ```
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}
