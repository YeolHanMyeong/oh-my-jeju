import { describe, expect, it } from 'vitest';
import { hexToRgb, mix, withAlpha } from './color.js';

describe('hexToRgb (L1)', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#0a84ff')).toEqual([10, 132, 255]);
    expect(hexToRgb('ff0000')).toEqual([255, 0, 0]); // '#' 선택적
  });
  it('expands 3-digit hex', () => {
    expect(hexToRgb('#abc')).toEqual([0xaa, 0xbb, 0xcc]);
  });
  it('drops alpha in 8-digit (#rrggbbaa) and uses RGB', () => {
    expect(hexToRgb('#11223344')).toEqual([0x11, 0x22, 0x33]);
  });
  it('drops alpha in 4-digit (#rgba) and expands RGB', () => {
    expect(hexToRgb('#abcd')).toEqual([0xaa, 0xbb, 0xcc]);
  });
  it('falls back to default blue for unrecognized formats', () => {
    expect(hexToRgb('#zzz')).toEqual([10, 132, 255]);
    expect(hexToRgb('#12345')).toEqual([10, 132, 255]); // 잘못된 길이
  });
});

describe('mix / withAlpha', () => {
  it('mixes two colors by ratio', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('rgb(128,128,128)');
    expect(mix('#000000', '#ffffff', 0)).toBe('rgb(0,0,0)');
    expect(mix('#000000', '#ffffff', 1)).toBe('rgb(255,255,255)');
  });
  it('parses rgb() inputs too', () => {
    expect(mix('rgb(0,0,0)', 'rgb(10,20,30)', 1)).toBe('rgb(10,20,30)');
  });
  it('applies alpha', () => {
    expect(withAlpha('#0a84ff', 0.5)).toBe('rgba(10,132,255,0.5)');
  });
});
