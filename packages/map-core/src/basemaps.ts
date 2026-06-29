import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';

/**
 * 베이스맵 프리셋.
 * - satellite: Esri World Imagery (키 불필요). 프로토타입용 — 공개 배포 앱은 Esri ToS상 키 없는
 *   사용이 제한될 수 있으니 osm 또는 vworld-*로 교체 권장.
 * - osm: OpenStreetMap (키 불필요).
 * - vworld-*: VWorld API 키 필요 (https://www.vworld.kr 발급) — 한국어 라벨, 국내 서비스 권장.
 *   ⚠️ VWorld 키는 발급 시 등록한 도메인에서만 동작한다. localhost는 기본 허용되지만, 배포
 *   도메인(예: *.github.io)을 vworld.kr 콘솔에 등록하지 않으면 타일이 403으로 빈 화면이 된다.
 */
export type BasemapId = 'satellite' | 'osm' | 'vworld-base' | 'vworld-satellite' | 'vworld-hybrid';

export interface BasemapSpec {
  sources: Record<string, SourceSpecification>;
  layers: LayerSpecification[];
}

function vworldTiles(key: string, layer: string, ext: string): SourceSpecification {
  return {
    type: 'raster',
    tiles: [`https://api.vworld.kr/req/wmts/1.0.0/${key}/${layer}/{z}/{y}/{x}.${ext}`],
    tileSize: 256,
    minzoom: 6,
    maxzoom: 19,
    attribution: '© <a href="https://www.vworld.kr">VWorld</a>',
  };
}

export function buildBasemap(id: BasemapId, vworldKey?: string): BasemapSpec {
  if (id.startsWith('vworld-') && !vworldKey) {
    throw new Error(
      `베이스맵 '${id}'에는 VWorld API 키가 필요합니다. JejuMap 옵션에 vworldKey를 전달하거나, 키가 없으면 basemap: 'satellite'를 사용하세요.`,
    );
  }

  switch (id) {
    case 'satellite':
      return {
        sources: {
          basemap: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 18,
            attribution: 'Esri, Maxar, Earthstar Geographics',
          },
        },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
      };
    case 'osm':
      return {
        sources: {
          basemap: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
      };
    case 'vworld-base':
      return {
        sources: { basemap: vworldTiles(vworldKey!, 'Base', 'png') },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
      };
    case 'vworld-satellite':
      return {
        sources: { basemap: vworldTiles(vworldKey!, 'Satellite', 'jpeg') },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
      };
    case 'vworld-hybrid':
      return {
        sources: {
          basemap: vworldTiles(vworldKey!, 'Satellite', 'jpeg'),
          'basemap-labels': vworldTiles(vworldKey!, 'Hybrid', 'png'),
        },
        layers: [
          { id: 'basemap', type: 'raster', source: 'basemap' },
          { id: 'basemap-labels', type: 'raster', source: 'basemap-labels' },
        ],
      };
  }
}
