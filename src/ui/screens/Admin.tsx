import { useState } from 'preact/hooks';
import { T } from '../../i18n/he';
import { api } from '../../api';
import { Button } from '../components/common';
import { Brand } from './Auth';

interface Player {
  name: string;
  phone: string;
  level: number;
  xp: number;
  streak: number;
  last_seen: string;
  created_at: string;
  parties: number;
}
interface AdminData {
  counts: { users: number; active_1d: number; active_7d: number; parties: number; with_character: number };
  players: Player[];
  config: { terms_ver: string; min_version: string; broadcast: string };
}

const fmt = (s: string) => {
  try {
    return new Date(s).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return s;
  }
};

/** Hidden admin screen (#admin). Progress only: no answers, no photos, masked phones. */
export function AdminScreen() {
  const [key, setKey] = useState('');
  const [data, setData] = useState<AdminData | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [bc, setBc] = useState('');
  const [minV, setMinV] = useState('');
  const [note, setNote] = useState('');

  const load = async (k = key) => {
    setBusy(true);
    setErr('');
    const r = await api.admin(k);
    setBusy(false);
    if (!r.ok) {
      setErr(r.err === 'denied' ? T.admin.denied : String(r.err));
      return;
    }
    const d = r as unknown as AdminData;
    setData(d);
    setBc(d.config.broadcast ?? '');
    setMinV(d.config.min_version ?? '0');
  };
  const set = async (k: string, v: string) => {
    const r = await api.adminSet(key, k, v);
    setNote(r.ok ? T.admin.saved : String(r.err));
    if (r.ok) void load();
  };

  return (
    <main class="screen plain">
      <Brand />
      <h1>{T.admin.title}</h1>
      {!data ? (
        <form
          class="card"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          {err ? (
            <p class="error" role="alert">
              {err}
            </p>
          ) : null}
          <label class="field">
            <span>{T.admin.key}</span>
            <input class="input ltr" type="password" autocomplete="off" value={key} onInput={(e) => setKey(e.currentTarget.value.trim())} />
          </label>
          <Button type="submit" class="primary block" busy={busy}>
            {T.admin.enter}
          </Button>
        </form>
      ) : (
        <>
          <div class="stats card">
            {(
              [
                [T.admin.users, data.counts.users],
                [T.admin.active1, data.counts.active_1d],
                [T.admin.active7, data.counts.active_7d],
                [T.admin.parties, data.counts.parties],
                [T.admin.chars, data.counts.with_character],
              ] as [string, number][]
            ).map(([l, n]) => (
              <div class="stat" key={l}>
                <b>{n}</b>
                <span>{l}</span>
              </div>
            ))}
          </div>
          <div class="card">
            {note ? (
              <p class="notice" role="status">
                {note}
              </p>
            ) : null}
            <label class="field">
              <span>{T.admin.broadcast}</span>
              <textarea class="input" maxLength={500} value={bc} onInput={(e) => setBc(e.currentTarget.value)} />
            </label>
            <Button class="primary small" onClick={() => void set('broadcast', bc)}>
              {T.admin.broadcastSave}
            </Button>
            <label class="field" style={{ marginTop: '14px' }}>
              <span>{T.admin.minVersion}</span>
              <input class="input ltr" value={minV} onInput={(e) => setMinV(e.currentTarget.value.trim())} />
            </label>
            <Button class="small" onClick={() => void set('min_version', minV)}>
              {T.common.ok}
            </Button>
          </div>
          <div class="card table-wrap">
            <table class="table">
              <caption class="sr-only">{T.admin.users}</caption>
              <thead>
                <tr>
                  <th scope="col">שם</th>
                  <th scope="col">טלפון</th>
                  <th scope="col">דרגה</th>
                  <th scope="col">XP</th>
                  <th scope="col">רצף</th>
                  <th scope="col">נראה לאחרונה</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td class="num">{p.phone}</td>
                    <td class="num">{p.level}</td>
                    <td class="num">{p.xp}</td>
                    <td class="num">{p.streak}</td>
                    <td class="num">{fmt(p.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
