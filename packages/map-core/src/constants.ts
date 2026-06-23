/** 카메라 프리셋 한 지점 */
export interface Landmark {
  name: string;
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

/** 제주 본섬 중심 */
export const JEJU_CENTER: [number, number] = [126.55, 33.38];

/**
 * 지도 이동 가능 범위 (제주 본섬 + 우도 + 마라도).
 * ⚠️ 지형 DEM 타일 커버리지(poc/terrain/scripts/build_terrain.sh의 BBOX_*)와 일치시킨다.
 * 이 범위가 타일 커버리지를 넘으면 3D에서 빈 영역의 DEM 타일이 누락되어 'load'가 영영
 * 발생하지 않을 수 있다. 지형을 더 넓게 다시 구우면 이 값도 함께 넓혀야 한다.
 */
export const JEJU_MAX_BOUNDS: [[number, number], [number, number]] = [
  [126.05, 33.05],
  [127.0, 33.65],
];

/** 주요 랜드마크 카메라 프리셋 */
export const LANDMARKS = {
  hallasan: { name: '한라산', center: [126.533, 33.362], zoom: 11.8, pitch: 68, bearing: -18 },
  seongsan: { name: '성산일출봉', center: [126.941, 33.459], zoom: 13.4, pitch: 65, bearing: -30 },
  jejuCity: { name: '제주시', center: [126.531, 33.5], zoom: 13, pitch: 45, bearing: 0 },
  seogwipo: { name: '서귀포', center: [126.56, 33.253], zoom: 13, pitch: 50, bearing: 10 },
  jungmun: { name: '중문관광단지', center: [126.425, 33.244], zoom: 13.5, pitch: 55, bearing: 0 },
  hyeopjae: { name: '협재해수욕장', center: [126.24, 33.394], zoom: 14, pitch: 55, bearing: -10 },
  udo: { name: '우도', center: [126.951, 33.503], zoom: 13.2, pitch: 60, bearing: 20 },
} as const satisfies Record<string, Landmark>;

export type LandmarkId = keyof typeof LANDMARKS;
