// Copies self-hosted third-party assets into public/ (fonts, MediaPipe wasm + model).
// Nothing is fetched from the network at build or run time.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const nm = (...p) => path.join(root, 'node_modules', ...p);
const pub = (...p) => path.join(root, 'public', ...p);
mkdirSync(pub('fonts'), { recursive: true });
mkdirSync(pub('seg'), { recursive: true });
mkdirSync(pub('licenses'), { recursive: true });

const fonts = [
  ['rubik', 'hebrew', 400],
  ['rubik', 'hebrew', 500],
  ['rubik', 'hebrew', 700],
  ['rubik', 'latin', 400],
  ['rubik', 'latin', 500],
  ['rubik', 'latin', 700],
  ['poppins', 'latin', 600],
  ['poppins', 'latin', 800],
];
for (const [f, sub, w] of fonts) {
  copyFileSync(nm('@fontsource', f, 'files', `${f}-${sub}-${w}-normal.woff2`), pub('fonts', `${f}-${sub}-${w}.woff2`));
}
copyFileSync(nm('@fontsource', 'rubik', 'LICENSE'), pub('licenses', 'rubik-OFL.txt'));
copyFileSync(nm('@fontsource', 'poppins', 'LICENSE'), pub('licenses', 'poppins-OFL.txt'));

for (const f of [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]) {
  copyFileSync(nm('@mediapipe', 'tasks-vision', 'wasm', f), pub('seg', f));
}
const model = path.join(root, 'assets', 'seg', 'selfie_segmenter.tflite');
if (!existsSync(model)) throw new Error('assets/seg/selfie_segmenter.tflite is missing');
copyFileSync(model, pub('seg', 'selfie_segmenter.tflite'));
const lic = nm('@mediapipe', 'tasks-vision', 'LICENSE');
if (existsSync(lic)) copyFileSync(lic, pub('licenses', 'mediapipe-Apache-2.0.txt'));
console.log('assets ready');
