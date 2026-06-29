import type { Feature, FeatureCollection, Point } from 'geojson';

/**
 * ════════════════════════════════════════════════════════════════════
 *  ★ 여기가 데이터 교체 지점입니다 ★
 *
 *  아래 SAMPLE_SPOTS는 스타터 데모용 샘플(유명 관광지 15곳, 좌표는 근사치,
 *  rating은 가상의 값)입니다. 너희 팀 데이터로 교체하세요:
 *
 *  방법 1) GeoJSON 파일 import
 *     import myData from './my-data.json';
 *     <JejuDataLayer data={myData as FeatureCollection} ... />
 *
 *  방법 2) URL로 로드 (백엔드 API, 정적 파일 등)
 *     <JejuDataLayer data="/api/spots.geojson" ... />
 *
 *  방법 3) 실시간 갱신
 *     const handle = jeju.addDataLayer({ data: initial });
 *     setInterval(async () => handle.setData(await fetchLatest()), 5000);
 *
 *  CSV/SHP 등 다른 형식을 GeoJSON으로 바꾸는 법: docs/data-sources.md 참고
 * ════════════════════════════════════════════════════════════════════
 */

export interface SpotProps {
  id: string;
  name: string;
  category: string;
  desc: string;
  rating: number;
}

export type Spot = Feature<Point, SpotProps>;

function spot(
  id: string,
  name: string,
  category: string,
  desc: string,
  rating: number,
  lng: number,
  lat: number,
): Spot {
  return {
    type: 'Feature',
    properties: { id, name, category, desc, rating },
    geometry: { type: 'Point', coordinates: [lng, lat] },
  };
}

export const SAMPLE_SPOTS: FeatureCollection<Point, SpotProps> = {
  type: 'FeatureCollection',
  features: [
    spot('s01', '한라산 백록담', '자연', '해발 1,947m 남한 최고봉', 4.9, 126.533, 33.362),
    spot('s02', '성산일출봉', '자연', '유네스코 세계자연유산', 4.8, 126.941, 33.459),
    spot('s03', '우도', '섬', '소가 누운 모양의 섬, 땅콩 아이스크림', 4.6, 126.951, 33.503),
    spot('s04', '협재해수욕장', '해변', '에메랄드빛 바다와 비양도 풍경', 4.7, 126.24, 33.394),
    spot('s05', '함덕해수욕장', '해변', '서우봉과 맞닿은 백사장', 4.6, 126.669, 33.543),
    spot('s06', '만장굴', '자연', '세계 최장급 용암동굴', 4.5, 126.77, 33.528),
    spot('s07', '비자림', '자연', '천년 비자나무 숲길', 4.7, 126.812, 33.486),
    spot('s08', '새별오름', '오름', '억새와 들불축제로 유명한 오름', 4.6, 126.357, 33.367),
    spot('s09', '천지연폭포', '자연', '서귀포 도심 속 폭포', 4.4, 126.554, 33.247),
    spot('s10', '정방폭포', '자연', '바다로 직접 떨어지는 폭포', 4.5, 126.572, 33.245),
    spot('s11', '대포 주상절리대', '자연', '육각형 돌기둥 해안 절벽', 4.5, 126.425, 33.238),
    spot('s12', '오설록 티 뮤지엄', '카페', '녹차밭과 차 문화 공간', 4.4, 126.289, 33.306),
    spot('s13', '카멜리아힐', '정원', '동백 수목원', 4.3, 126.37, 33.289),
    spot('s14', '용두암', '자연', '용 머리 모양 화산암', 4.1, 126.512, 33.516),
    spot('s15', '동문시장', '시장', '제주 최대 전통시장, 야시장 먹거리', 4.5, 126.527, 33.512),
  ],
};

/** 경로 기능(JejuRoute) 데모용 — 제주공항에서 서부 해안을 도는 드라이브 코스 예시 */
export const WEST_DRIVE_ROUTE: [number, number][] = [
  [126.493, 33.507], // 제주국제공항
  [126.512, 33.516], // 용두암
  [126.431, 33.493], // 이호테우
  [126.337, 33.471], // 애월
  [126.24, 33.394], // 협재
  [126.289, 33.306], // 오설록
  [126.37, 33.289], // 카멜리아힐
  [126.425, 33.244], // 중문
];
