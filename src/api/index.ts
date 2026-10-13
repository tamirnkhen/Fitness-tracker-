import { rpc, type RpcResult } from './rpc';
import type { PartyInfo, PartyBoard, ServerPayload, Imgs, PubCard } from './types';

export * from './types';
export { rpc, setApiConfig, isNetErr } from './rpc';

type R<T> = Promise<(RpcResult & T) | (RpcResult & { ok: false })>;

export const api = {
  config: () => rpc('q_config_get', {}) as R<{ terms_ver: number; min_version: string; broadcast: string; broadcast_id: string }>,
  register: (phone: string, pin: string, name: string, consentVer: number) =>
    rpc('q_register', { p_phone: phone, p_pin: pin, p_name: name, p_consent_ver: consentVer }) as R<ServerPayload & { token: string }>,
  login: (phone: string, pin: string) => rpc('q_login', { p_phone: phone, p_pin: pin }) as R<ServerPayload & { token: string }>,
  logout: (token: string) => rpc('q_logout', { p_token: token }),
  load: (token: string) => rpc('q_load', { p_token: token }) as R<ServerPayload>,
  save: (token: string, base: number, state: unknown, pub: PubCard, imgs?: Imgs | null, imgV?: number) =>
    rpc(
      'q_save',
      imgV === undefined
        ? { p_token: token, p_base: base, p_state: state, p_pub: pub }
        : { p_token: token, p_base: base, p_state: state, p_pub: pub, p_imgs: imgs ?? null, p_img_v: imgV },
      30000,
    ) as R<{ saved_at: number; state?: unknown; imgs?: Imgs | null; img_v?: number }>,
  consent: (token: string, ver: number) => rpc('q_consent', { p_token: token, p_ver: ver }),
  changePin: (token: string, oldPin: string, newPin: string) => rpc('q_change_pin', { p_token: token, p_old: oldPin, p_new: newPin }),
  deleteAccount: (token: string, pin: string) => rpc('q_delete', { p_token: token, p_pin: pin }),
  partyCreate: (token: string, name: string) =>
    rpc('q_party_create', { p_token: token, p_name: name }) as R<{ code: string; parties: PartyInfo[] }>,
  partyJoin: (token: string, code: string) =>
    rpc('q_party_join', { p_token: token, p_code: code }) as R<{ code: string; parties: PartyInfo[] }>,
  partyLeave: (token: string, code: string) => rpc('q_party_leave', { p_token: token, p_code: code }) as R<{ parties: PartyInfo[] }>,
  party: (token: string, code: string) => rpc('q_party', { p_token: token, p_code: code }) as R<PartyBoard>,
  admin: (key: string) => rpc('q_admin', { p_key: key }),
  adminSet: (key: string, k: string, v: string) => rpc('q_admin_set', { p_key: key, p_k: k, p_v: v }),
};
