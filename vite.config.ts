import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const BUILD_ID = `${pkg.version}-${Date.now().toString(36)}`;

function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p, base) : [path.relative(base, p).split(path.sep).join('/')];
  });
}

/** Writes version.json and the service worker with the precache list. */
function questBuild(): Plugin {
  let outDir = 'dist';
  return {
    name: 'quest-build',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      writeFileSync(path.join(outDir, 'version.json'), JSON.stringify({ version: pkg.version, build: BUILD_ID }) + '\n');
      const files = walk(outDir).filter(
        (f) => !f.startsWith('seg/') && !f.startsWith('licenses/') && !['sw.js', 'version.json', '_headers'].includes(f),
      );
      const shell = ['/', ...files.map((f) => '/' + f).filter((f) => f !== '/index.html')];
      const sw = readFileSync('src/sw/sw.js', 'utf8').replace('__BUILD_ID__', BUILD_ID).replace('__PRECACHE__', JSON.stringify(shell));
      writeFileSync(path.join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact', legalComments: 'none' },
  build: {
    target: 'es2020',
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0,
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 400,
  },
  plugins: [questBuild()],
  server: { port: 5173 },
});
