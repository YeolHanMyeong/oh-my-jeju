import {
  JejuDataLayer,
  type JejuMap,
  JejuMapView,
  JejuRoute,
  type MapMode,
} from '@oh-my-jeju/map-react';
import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { SAMPLE_SPOTS, type Spot, type SpotProps, WEST_DRIVE_ROUTE } from './sample-data.js';

export type Viz = 'cluster' | 'heatmap' | 'circle';

export default function App() {
  const [jeju, setJeju] = useState<JejuMap | null>(null);
  const [mode, setMode] = useState<MapMode>('3d');
  const [viz, setViz] = useState<Viz>('cluster');
  const [showRoute, setShowRoute] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<Set<string> | null>(null);

  // 지도 ↔ 리스트 동기화: 현재 뷰포트 안에 있는 스팟만 리스트에 표시
  useEffect(() => {
    if (!jeju) return;
    const update = () => {
      const bounds = jeju.map.getBounds();
      setVisibleIds(
        new Set(
          SAMPLE_SPOTS.features
            .filter((f) => bounds.contains(f.geometry.coordinates as [number, number]))
            .map((f) => f.properties.id),
        ),
      );
    };
    update();
    jeju.map.on('moveend', update);
    return () => {
      jeju.map.off('moveend', update);
    };
  }, [jeju]);

  const handleSelect = (s: Spot) => {
    setSelectedId(s.properties.id);
    jeju?.flyTo(
      { center: s.geometry.coordinates as [number, number], zoom: 13.5 },
      { duration: 1600 },
    );
  };

  return (
    <div className="shell">
      <Sidebar
        spots={SAMPLE_SPOTS.features}
        visibleIds={visibleIds}
        selectedId={selectedId}
        onSelect={handleSelect}
        viz={viz}
        onVizChange={setViz}
        mode={mode}
        onModeChange={setMode}
        showRoute={showRoute}
        onShowRouteChange={setShowRoute}
      />
      <main className="map-pane">
        <JejuMapView
          mode={mode}
          basemap="satellite"
          terrainUrl={`${import.meta.env.BASE_URL}tiles/jeju-terrain.pmtiles`}
          view="hallasan"
          geolocate
          // 코어가 실제 모드를 강등(예: terrainUrl 없이 3d)하면 토글 state를 동기화
          onModeChange={setMode}
          onError={(err) => console.error('[starter] 지도 로드 실패:', err)}
          onReady={(m) => {
            setJeju(m);
            // 개발 중 콘솔 디버깅용: window.__jeju.map 으로 MapLibre API 직접 사용 가능
            if (import.meta.env.DEV) (window as unknown as { __jeju: unknown }).__jeju = m;
          }}
        >
          <JejuDataLayer
            data={SAMPLE_SPOTS}
            type={viz}
            color="#ff8a3d"
            property="rating"
            onClick={(f) => setSelectedId((f.properties as SpotProps).id)}
            popup={(f) => {
              const p = f.properties as SpotProps;
              return (
                <div className="spot-popup">
                  <strong>{p.name}</strong>
                  <span className="cat">
                    {p.category} · ★ {p.rating}
                  </span>
                  <p>{p.desc}</p>
                </div>
              );
            }}
          />
          {showRoute && <JejuRoute coordinates={WEST_DRIVE_ROUTE} color="#0a84ff" animate />}
        </JejuMapView>
      </main>
    </div>
  );
}
