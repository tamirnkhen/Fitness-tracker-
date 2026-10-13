/// <reference lib="webworker" />
import { toon, type ToonInput } from './toon';

self.onmessage = (e: MessageEvent<ToonInput>) => {
  try {
    const out = toon(e.data);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ ok: true, ...out }, [out.rgba.buffer]);
  } catch (err) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ ok: false, error: String(err) });
  }
};
