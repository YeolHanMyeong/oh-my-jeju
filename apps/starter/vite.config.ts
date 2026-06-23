import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Connect, type Plugin } from 'vite';

/**
 * .pmtiles 파일에 HTTP Range 요청(206) 지원을 보장하는 미들웨어.
 * PMTiles는 단일 파일에서 바이트 구간만 읽는 방식이라 Range가 필수인데,
 * Vite 기본 정적 서버는 이를 보장하지 않는다.
 */
function pmtilesRange(): Plugin {
  const makeHandler = (rootDir: string): Connect.NextHandleFunction => (req, res, next) => {
    const urlPath = decodeURIComponent((req.url ?? '').split('?')[0]);
    if (!urlPath.endsWith('.pmtiles')) return next();
    const filePath = path.join(rootDir, urlPath);
    if (!fs.existsSync(filePath)) return next();

    const { size } = fs.statSync(filePath);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'application/octet-stream');

    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
    if (!range) {
      res.setHeader('Content-Length', size);
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    const start = range[1] ? parseInt(range[1], 10) : size - parseInt(range[2], 10);
    const end = range[2] && range[1] ? Math.min(parseInt(range[2], 10), size - 1) : size - 1;
    res.statusCode = 206;
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', end - start + 1);
    fs.createReadStream(filePath, { start, end }).pipe(res);
  };

  return {
    name: 'pmtiles-range',
    configureServer(server) {
      server.middlewares.use(makeHandler(path.join(server.config.root, 'public')));
    },
    configurePreviewServer(server) {
      server.middlewares.use(makeHandler(server.config.build.outDir));
    },
  };
}

export default defineConfig({
  // GitHub Pages 프로젝트 사이트(user.github.io/oh-my-jeju/)에 배포할 때는 GITHUB_PAGES=1로
  // 빌드해 서브패스 base를 설정한다. 로컬 dev와 루트 배포(*.github.io 직속, Cloudflare/Netlify)는 '/'.
  base: process.env.GITHUB_PAGES ? '/oh-my-jeju/' : '/',
  plugins: [react(), pmtilesRange()],
  resolve: {
    alias: {
      // dev에서 워크스페이스 패키지를 dist가 아닌 src로 직접 물려 HMR이 동작하게 한다
      // (프로덕션 빌드도 src를 번들 — 따라서 starter는 packages 사전 빌드가 필요 없다).
      '@oh-my-jeju/map-core': path.resolve(import.meta.dirname, '../../packages/map-core/src/index.ts'),
      '@oh-my-jeju/map-react': path.resolve(import.meta.dirname, '../../packages/map-react/src/index.ts'),
    },
  },
});
