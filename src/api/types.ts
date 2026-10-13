export interface PartyInfo {
  code: string;
  name: string;
  count: number;
}

export interface PartyMember {
  name: string;
  level: number;
  xp: number;
  streak: number;
  title: string;
  thumb: string | null;
  me: boolean;
  active: boolean;
}

export interface PartyBoard {
  code: string;
  name: string;
  members: PartyMember[];
}

/** Images synced to the server. Never the original photo. */
export interface Imgs {
  /** transparent character cut-out (PNG/WebP data URL) */
  cut?: string;
  /** small square with the rank backdrop (for HUD / party) */
  thumb?: string;
  /** framing metadata of the cut-out */
  frame?: { w: number; h: number; v: number; face?: [number, number, number, number] };
  /** older characters with a baked-in background */
  legacy?: string;
  style?: number;
}

export interface PubCard {
  name: string;
  level: number;
  xp: number;
  streak: number;
  title: string;
  thumb: string | null;
}

export interface ServerPayload {
  user: { name: string };
  state: unknown;
  imgs: Imgs | null;
  img_v: number;
  saved_at: number;
  consent_ver: number;
  terms_ver: number;
  parties: PartyInfo[];
}

/** Only small raster data URLs are ever rendered from other players. */
export const SAFE_IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
export const safeImg = (s: unknown): string | null => (typeof s === 'string' && s.length < 900000 && SAFE_IMG.test(s) ? s : null);
