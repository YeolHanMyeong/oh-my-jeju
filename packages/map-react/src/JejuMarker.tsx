import { Marker, Popup } from 'maplibre-gl';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useJejuMap } from './context.js';

export interface JejuMarkerProps {
  lng: number;
  lat: number;
  /** 마커 색상 (CSS color) */
  color?: string;
  /** 클릭 시 열리는 팝업 내용 — JSX 그대로 사용 가능 */
  children?: ReactNode;
  onClick?: () => void;
}

/** 지도 위 마커. children을 주면 클릭 시 JSX 팝업이 열린다. */
export function JejuMarker({ lng, lat, color, children, onClick }: JejuMarkerProps) {
  const jejuMap = useJejuMap();
  const [popupContainer] = useState(() => document.createElement('div'));
  const hasPopup = children != null;

  // onClick은 ref 경유 — 콜백 identity가 바뀌어도 마커를 재생성하지 않는다
  // (다른 컴포넌트와 동일한 패턴. inline 콜백이 매 렌더 마커를 재생성하고 팝업을 닫던 문제 방지).
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    const marker = new Marker({ color }).setLngLat([lng, lat]);
    if (hasPopup) {
      marker.setPopup(new Popup({ offset: 32, closeButton: false }).setDOMContent(popupContainer));
    }
    marker.addTo(jejuMap.map);

    const el = marker.getElement();
    const handleClick = () => onClickRef.current?.();
    el.addEventListener('click', handleClick);
    return () => {
      el.removeEventListener('click', handleClick);
      marker.remove();
    };
  }, [jejuMap, lng, lat, color, hasPopup, popupContainer]);

  return hasPopup ? createPortal(children, popupContainer) : null;
}
