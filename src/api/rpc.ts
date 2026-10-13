import type { ConfigState } from '../config';

export type ApiFail =
  | 'network'
  | 'server'
  | 'timeout'
  | 'config'
  | 'auth'
  | 'rate'
  | 'locked'
  | 'bad_credentials'
  | 'conflict'
  | 'consent_required'
  | (string & {});

export interface Ok {
  ok: true;
  [k: string]: unknown;
}
export interface Fail {
  ok: false;
  err: ApiFail;
  status?: number;
  [k: string]: unknown;
}
export type RpcResult = Ok | Fail;

let cfg: ConfigState | null = null;
export function setApiConfig(c: ConfigState) {
  cfg = c;
}

/** Last-resort hook for tests and diagnostics. */
export const rpcStats = { calls: 0, failures: 0 };

/**
 * Calls a Postgres function through Supabase's PostgREST endpoint.
 * This is the *only* place in the app that talks to the network.
 */
export async function rpc(fn: string, args: Record<string, unknown>, timeoutMs = 15000): Promise<RpcResult> {
  if (!cfg || !cfg.ok) return { ok: false, err: 'config' };
  if (!/^q_[a-z_]+$/.test(fn)) return { ok: false, err: 'config' };
  rpcStats.calls++;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const headers: Record<string, string> = {
    apikey: cfg.key,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  // legacy anon JWT keys also go in Authorization; new publishable keys don't
  if (cfg.key.startsWith('eyJ')) headers.Authorization = `Bearer ${cfg.key}`;
  try {
    const res = await fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: ctl.signal,
    });
    if (!res.ok) {
      rpcStats.failures++;
      return { ok: false, err: res.status === 429 ? 'rate' : res.status === 401 ? 'config' : 'server', status: res.status };
    }
    const data = (await res.json()) as unknown;
    if (!data || typeof data !== 'object') return { ok: false, err: 'server' };
    return data as RpcResult;
  } catch (e) {
    rpcStats.failures++;
    if ((e as Error)?.name === 'AbortError') return { ok: false, err: 'timeout' };
    return { ok: false, err: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

export const isNetErr = (r: RpcResult) => !r.ok && (r.err === 'network' || r.err === 'timeout' || r.err === 'server');
