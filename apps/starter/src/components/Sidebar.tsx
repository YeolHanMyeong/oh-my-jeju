import { useState } from 'react';
import type { MapMode } from '@oh-my-jeju/map-react';
import type { Spot } from '../sample-data.js';
import type { Viz } from '../App.js';

interface SidebarProps {
  spots: Spot[];
  /** 뷰포트 안에 있는 스팟 id (null이면 전체) */
  visibleIds: Set<string> | null;
  selectedId: string | null;
  onSelect: (spot: Spot) => void;
  viz: Viz;
  onVizChange: (v: Viz) => void;
  mode: MapMode;
  onModeChange: (m: MapMode) => void;
  showRoute: boolean;
  onShowRouteChange: (v: boolean) => void;
}

/** 앱 셸 — 데스크톱: 좌측 패널 / 모바일: 바텀시트 */
export function Sidebar({
  spots,
  visibleIds,
  selectedId,
  onSelect,
  viz,
  onVizChange,
  mode,
  onModeChange,
  showRoute,
  onShowRouteChange,
}: SidebarProps) {
  const [open, setOpen] = useState(false); // 모바일 바텀시트 펼침 상태
  const list = visibleIds ? spots.filter((s) => visibleIds.has(s.properties.id)) : spots;

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <header className="sidebar-head">
        <h1>
          oh-my-jeju <span className="badge">starter</span>
        </h1>
        <p className="tagline">제주 지도 스타터팩 — 목록의 샘플을 너희 데이터로 교체하세요</p>
        <button className="sheet-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? '지도 보기 ▾' : '목록 보기 ▴'}
        </button>
      </header>

      <div className="controls">
        <select value={viz} onChange={(e) => onVizChange(e.target.value as Viz)}>
          <option value="cluster">클러스터</option>
          <option value="heatmap">히트맵</option>
          <option value="circle">포인트</option>
        </select>
        <button className="ghost" onClick={() => onModeChange(mode === '3d' ? '2d' : '3d')}>
          {mode === '3d' ? '2D' : '3D'}
        </button>
        <label className="route-toggle">
          <input
            type="checkbox"
            checked={showRoute}
            onChange={(e) => onShowRouteChange(e.target.checked)}
          />
          드라이브 경로
        </label>
      </div>

      <p className="count">지도 영역 내 {list.length}곳</p>

      <ul className="spot-list">
        {list.map((s) => (
          <li key={s.properties.id}>
            <button
              className={`spot-card ${selectedId === s.properties.id ? 'selected' : ''}`}
              onClick={() => onSelect(s)}
            >
              <span className="row">
                <strong>{s.properties.name}</strong>
                <span className="rating">★ {s.properties.rating.toFixed(1)}</span>
              </span>
              <span className="cat">{s.properties.category}</span>
              <span className="desc">{s.properties.desc}</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="empty">현재 지도 영역에 스팟이 없습니다</li>}
      </ul>
    </aside>
  );
}
