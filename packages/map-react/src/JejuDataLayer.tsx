import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Feature } from 'geojson';
import type { DataLayerHandle, DataLayerOptions } from '@oh-my-jeju/map-core';
import { useJejuMap } from './context.js';

export interface JejuDataLayerProps extends Omit<DataLayerOptions, 'popup'> {
  /** 피처 클릭 시 팝업 내용 — JSX 그대로 사용 가능 */
  popup?: (feature: Feature) => ReactNode;
}

/**
 * GeoJSON 데이터를 지도에 꽂는 BYOD 소켓 컴포넌트.
 *
 * ```tsx
 * <JejuDataLayer data={myGeojson} type="cluster" color="#ff8a3d"
 *   popup={f => <strong>{f.properties.name}</strong>} />
 * ```
 *
 * 모든 스타일 옵션(type·color·property·radius·opacity·width·stops·fitBounds)과 data URL 변경에
 * 반응해 레이어를 재생성하고, 객체 data 변경은 setData로 갱신한다. popup·onClick 콜백은 ref 경유라
 * 마운트 후에도 항상 최신값이 호출된다(재생성 없음).
 */
export function JejuDataLayer({ popup, ...options }: JejuDataLayerProps) {
  const jeju = useJejuMap();
  const [popupFeature, setPopupFeature] = useState<Feature | null>(null);
  const [container] = useState(() => document.createElement('div'));
  const handleRef = useRef<DataLayerHandle | null>(null);

  const popupRef = useRef(popup);
  popupRef.current = popup;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // 레이어 구성을 바꾸는 옵션(type·color·property·radius·opacity·width·stops·fitBounds·id·
  // 데이터 URL)이 바뀌면 레이어를 재생성한다. 객체 data는 아래 setData 경로로 갱신하므로
  // 키에서 제외하고, popup·onClick은 ref 경유로 항상 최신값을 호출하므로 재생성 트리거가 아니다.
  const { data, onClick, ...style } = options;
  const hasOnClick = onClick != null;
  const styleKey = JSON.stringify({
    ...style,
    dataUrl: typeof data === 'string' ? data : null,
    hasPopup: popup != null,
    hasOnClick,
  });

  useEffect(() => {
    setPopupFeature(null);
    const handle = jeju.addDataLayer({
      ...optionsRef.current,
      onClick: hasOnClick
        ? (f, lngLat) => optionsRef.current.onClick?.(f, lngLat)
        : undefined,
      popup: popupRef.current
        ? (f) => {
            setPopupFeature(f);
            return container;
          }
        : undefined,
    });
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
      handle.remove();
    };
  }, [jeju, container, styleKey, hasOnClick]);

  // 객체 data가 바뀌면 레이어 재생성 없이 setData로 갱신 (URL 문자열은 styleKey가 재생성 처리)
  const firstData = useRef(true);
  useEffect(() => {
    if (firstData.current) {
      firstData.current = false;
      return;
    }
    if (typeof data !== 'string') handleRef.current?.setData(data);
  }, [data]);

  return popup && popupFeature ? createPortal(popup(popupFeature), container) : null;
}
