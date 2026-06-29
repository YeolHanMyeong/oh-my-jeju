import type { Feature, FeatureCollection } from 'geojson';
import { describe, expect, it } from 'vitest';
import {
  autoType,
  bboxOf,
  choroplethFillExpr,
  heatmapWeightExpr,
  resolveChoroplethStops,
  sortStops,
} from './expr.js';

function fc(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features };
}
function pt(props: Record<string, unknown>, coords: [number, number] = [126.5, 33.4]): Feature {
  return { type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: coords } };
}

describe('autoType', () => {
  it('maps geometry to a preset', () => {
    expect(autoType(fc([pt({})]))).toBe('circle');
    expect(
      autoType(
        fc([
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [0, 0],
                [1, 1],
              ],
            },
          },
        ]),
      ),
    ).toBe('line');
    expect(
      autoType(
        fc([
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 0],
                ],
              ],
            },
          },
        ]),
      ),
    ).toBe('fill');
    expect(autoType(fc([]))).toBe('circle'); // 빈 컬렉션 → Point 기본
  });
});

describe('sortStops', () => {
  it('sorts ascending and dedupes equal boundary values', () => {
    expect(
      sortStops([
        [5, '#a'],
        [1, '#b'],
        [3, '#c'],
      ]),
    ).toEqual([
      [1, '#b'],
      [3, '#c'],
      [5, '#a'],
    ]);
    expect(
      sortStops([
        [5, '#a'],
        [5, '#b'],
      ]),
    ).toEqual([[5, '#a']]); // 동일 경계 → 1개로 dedup
    expect(sortStops([[1, '#a']])).toEqual([[1, '#a']]);
  });
});

describe('resolveChoroplethStops (M1)', () => {
  it('returns null for a single user stop (interpolate needs >=2)', () => {
    expect(resolveChoroplethStops(fc([]), 'v', '#0a84ff', [[5, '#fff']])).toBeNull();
  });
  it('returns null when user stops dedupe to one', () => {
    expect(
      resolveChoroplethStops(fc([]), 'v', '#0a84ff', [
        [5, '#a'],
        [5, '#b'],
      ]),
    ).toBeNull();
  });
  it('keeps valid (>=2) user stops, sorted', () => {
    const r = resolveChoroplethStops(fc([]), 'v', '#0a84ff', [
      [10, '#hi'],
      [0, '#lo'],
    ]);
    expect(r).toEqual([
      [0, '#lo'],
      [10, '#hi'],
    ]);
  });
  it('returns null without property or finite values', () => {
    expect(resolveChoroplethStops(fc([pt({ v: 1 })]), undefined, '#0a84ff')).toBeNull();
    expect(resolveChoroplethStops(fc([pt({ v: 'x' })]), 'v', '#0a84ff')).toBeNull();
  });
  it('auto-generates 5 strictly-ascending stops from data range', () => {
    const r = resolveChoroplethStops(fc([pt({ v: 0 }), pt({ v: 100 })]), 'v', '#0a84ff');
    expect(r).not.toBeNull();
    expect(r!).toHaveLength(5);
    const xs = r!.map((s) => s[0]);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(new Set(xs).size).toBe(5); // 모두 distinct
  });
  it('produces distinct ascending stops even when all values are equal (min===max)', () => {
    const r = resolveChoroplethStops(fc([pt({ v: 7 }), pt({ v: 7 })]), 'v', '#0a84ff');
    const xs = r!.map((s) => s[0]);
    expect(xs).toEqual([7, 8, 9, 10, 11]); // step=1 폴백
  });
});

describe('choroplethFillExpr', () => {
  it('returns a solid color when stops are missing/insufficient', () => {
    expect(choroplethFillExpr(null, 'v', '#abc')).toBe('#abc');
    expect(choroplethFillExpr([[1, '#a']], 'v', '#abc')).toBe('#abc');
    expect(
      choroplethFillExpr(
        [
          [1, '#a'],
          [2, '#b'],
        ],
        undefined,
        '#abc',
      ),
    ).toBe('#abc');
  });
  it('builds an interpolate expression for >=2 stops', () => {
    const e = choroplethFillExpr(
      [
        [0, '#lo'],
        [10, '#hi'],
      ],
      'v',
      '#abc',
    );
    expect(Array.isArray(e)).toBe(true);
    expect((e as unknown[])[0]).toBe('interpolate');
    expect(e).toContain('#lo');
    expect(e).toContain('#hi');
  });
});

describe('heatmapWeightExpr (M2)', () => {
  it('returns constant 1 without property or finite values', () => {
    expect(heatmapWeightExpr(fc([pt({ v: 1 })]), undefined)).toBe(1);
    expect(heatmapWeightExpr(fc([pt({ v: 'x' })]), 'v')).toBe(1);
  });
  it('returns constant 1 when all values are equal', () => {
    expect(heatmapWeightExpr(fc([pt({ v: 5 }), pt({ v: 5 })]), 'v')).toBe(1);
  });
  it('builds a strictly-ascending interpolate for all-negative values', () => {
    const e = heatmapWeightExpr(fc([pt({ v: -5 }), pt({ v: -3 }), pt({ v: -1 })]), 'v');
    expect(Array.isArray(e)).toBe(true);
    const arr = e as unknown[];
    // [..., min, 0, max, 1] — 입력 stop은 min(-5) < max(-1) 로 오름차순
    const min = arr[arr.length - 4] as number;
    const max = arr[arr.length - 2] as number;
    expect(min).toBe(-5);
    expect(max).toBe(-1);
    expect(min).toBeLessThan(max);
  });
  it('builds an ascending interpolate for normal positive values', () => {
    const e = heatmapWeightExpr(fc([pt({ v: 2 }), pt({ v: 8 })]), 'v') as unknown[];
    expect(e[e.length - 4]).toBe(2);
    expect(e[e.length - 2]).toBe(8);
  });
});

describe('bboxOf', () => {
  it('returns null for an empty collection', () => {
    expect(bboxOf(fc([]))).toBeNull();
  });
  it('computes the bounding box of points', () => {
    expect(bboxOf(fc([pt({}, [1, 2]), pt({}, [3, 4])]))).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
  it('handles a single point (degenerate box)', () => {
    expect(bboxOf(fc([pt({}, [5, 6])]))).toEqual([
      [5, 6],
      [5, 6],
    ]);
  });
  it('recurses into nested polygon coordinates', () => {
    const poly: Feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [10, 0],
            [10, 5],
            [0, 5],
            [0, 0],
          ],
        ],
      },
    };
    expect(bboxOf(fc([poly]))).toEqual([
      [0, 0],
      [10, 5],
    ]);
  });
});
