import type { JejuMap } from '@oh-my-jeju/map-core';
import { createContext, useContext } from 'react';

export const JejuMapContext = createContext<JejuMap | null>(null);

/**
 * 가장 가까운 <JejuMapView>의 JejuMap 인스턴스를 반환.
 * JejuMapView의 children 안에서만 사용 가능 (지도 로드 완료 후 mount됨).
 */
export function useJejuMap(): JejuMap {
  const map = useContext(JejuMapContext);
  if (!map) {
    throw new Error('useJejuMap은 <JejuMapView> 내부에서만 사용할 수 있습니다.');
  }
  return map;
}
