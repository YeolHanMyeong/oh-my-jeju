import type { RouteOptions } from '@oh-my-jeju/map-core';
import { useEffect, useRef } from 'react';
import { useJejuMap } from './context.js';

export interface JejuRouteProps extends RouteOptions {
  /** [lng, lat] 좌표 배열 */
  coordinates: [number, number][];
}

/** 경로 라인 + (옵션) 이동 마커 애니메이션 */
export function JejuRoute({ coordinates, ...options }: JejuRouteProps) {
  const jeju = useJejuMap();

  // 좌표/옵션을 참조가 아닌 '내용' 기준으로 비교한다 — inline 배열 리터럴
  // (`coordinates={[...]}`)이 매 렌더 새 참조가 되어 경로를 재생성하던 문제 방지.
  // 내용이 실제로 바뀌면(좌표 또는 color/animate 등 옵션) 그때만 재생성한다.
  const key = JSON.stringify([coordinates, options]);
  const coordsRef = useRef(coordinates);
  coordsRef.current = coordinates;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // biome-ignore lint/correctness/useExhaustiveDependencies: key(내용 해시)는 의도적 재생성 트리거다 — 좌표/옵션은 ref 경유로 최신값을 쓴다.
  useEffect(() => {
    const handle = jeju.addRoute(coordsRef.current, optionsRef.current);
    return () => handle.remove();
  }, [jeju, key]);

  return null;
}
