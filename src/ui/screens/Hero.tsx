import { useEffect, useState } from 'preact/hooks';
import { T } from '../../i18n/he';
import { app, useApp, toast } from '../../app/store';
import {
  chooseTitle,
  setSetting,
  partyCreate,
  partyJoin,
  partyLeave,
  loadBoard,
  signOut,
  changePin,
  deleteAccount,
  setHeroName,
} from '../../app/actions';
import { levelInfo } from '../../game/level';
import { backdropFor } from '../../game/backdrop';
import { unlockedTitles, titleName } from '../../game/engine';
import { TITLES } from '../../content/progress';
import { validateHeroName } from '../../game/analyze';
import { formatPhone } from '../../game/phone';
import { Avatar, Button, Sheet, Switch, Thumb } from '../components/common';
import { IconCopy, IconShare } from '../components/icons';
import { TermsSheet } from './Auth';
import { CharacterCreator } from '../../character/Creator';
import { googleLink, reminderSpecs, buildIcs } from '../../calendar/calendar';

declare const __APP_VERSION__: string;

function HeroCard() {
  const g = useApp((s) => s.game!);
  const imgs = useApp((s) => s.imgs);
  const [titles, setTitles] = useState(false);
  const [rename, setRename] = useState(false);
  const [creator, setCreator] = useState(false);
  const info = levelInfo(g.xp);
  const bd = backdropFor(info.level);
  const name = g.profile.heroName || app.get().session?.name || '';
  return (
    <section class="card gold hero-card" aria-labelledby="hero-name">
      <Avatar cut={imgs?.cut} legacy={imgs?.legacy} level={info.level} size={210} big label={`הדמות של ${name}, רקע ${bd.name}`} />
      <div class="hname" id="hero-name">
        {name}
      </div>
      <div class="htitle">{titleName(g.title)}</div>
      <div class="small muted">
        {T.hero.level} <span class="num">{info.level}</span> · {bd.name}
      </div>
      <div class="stats">
        <div class="stat">
          <b>{info.level}</b>
          <span>{T.hero.level}</span>
        </div>
        <div class="stat">
          <b>{g.xp}</b>
          <span>{T.hero.xp}</span>
        </div>
        <div class="stat">
          <b>{g.counters.quests}</b>
          <span>{T.hero.quests}</span>
        </div>
        <div class="stat">
          <b>{g.streak.count}</b>
          <span>רצף</span>
        </div>
        <div class="stat">
          <b>{g.streak.best}</b>
          <span>{T.hero.best}</span>
        </div>
        <div class="stat">
          <b>{g.bossesDefeated.length}</b>
          <span>{T.hero.bosses}</span>
        </div>
      </div>
      {imgs?.legacy && !imgs.cut ? (
        <p class="notice small" style={{ marginTop: '12px' }}>
          {T.hero.legacy}
        </p>
      ) : null}
      <div class="row wrap" style={{ marginTop: '14px', justifyContent: 'center' }}>
        <Button class="small" onClick={() => setTitles(true)}>
          {T.hero.chooseTitle}
        </Button>
        <Button class="small" onClick={() => setRename(true)}>
          {T.hero.rename}
        </Button>
        <Button class="small primary" onClick={() => setCreator(true)}>
          {imgs?.cut || imgs?.legacy ? T.hero.recreate : T.hero.create}
        </Button>
      </div>
      {titles ? <TitleSheet onClose={() => setTitles(false)} /> : null}
      {rename ? <RenameSheet current={name} onClose={() => setRename(false)} /> : null}
      {creator ? (
        <div class="overlay" style={{ placeItems: 'stretch', padding: 0, background: 'var(--bg)', overflowY: 'auto' }}>
          <CharacterCreator onDone={() => setCreator(false)} />
        </div>
      ) : null}
    </section>
  );
}

function TitleSheet({ onClose }: { onClose: () => void }) {
  const g = useApp((s) => s.game!);
  const unlocked = unlockedTitles(g);
  return (
    <Sheet title={T.hero.chooseTitle} onClose={onClose}>
      <div role="radiogroup" aria-label={T.hero.chooseTitle}>
        {TITLES.map((t) => {
          const on = unlocked.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={g.title === t.id ? 'true' : 'false'}
              class="list-btn"
              disabled={!on}
              onClick={() => {
                chooseTitle(t.id);
                onClose();
              }}
            >
              <span>
                <b style={{ color: on ? 'var(--gold2)' : 'var(--faint)' }}>{t.name}</b>
                <span class="small muted" style={{ display: 'block' }}>
                  {on ? '' : '🔒 '}
                  {t.how}
                </span>
              </span>
              {g.title === t.id ? <span aria-hidden="true">✓</span> : null}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

function RenameSheet({ current, onClose }: { current: string; onClose: () => void }) {
  const [v, setV] = useState(current);
  const [err, setErr] = useState('');
  return (
    <Sheet title={T.hero.rename} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const r = validateHeroName(v);
          if (!r.ok) {
            setErr('השם צריך להיות 2–20 אותיות, עד שלוש מילים.');
            return;
          }
          setHeroName(r.name);
          onClose();
        }}
      >
        {err ? (
          <p class="error" role="alert">
            {err}
          </p>
        ) : null}
        <label class="field">
          <span>{T.hero.rename}</span>
          <input class="input" value={v} maxLength={20} autofocus onInput={(e) => setV(e.currentTarget.value)} />
        </label>
        <Button type="submit" class="primary block">
          {T.common.ok}
        </Button>
      </form>
    </Sheet>
  );
}

// ------------------------------------------------------------ party

function inviteLink(code: string) {
  return `${location.origin}/#join=${code}`;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(T.party.copied, '📋', 'info');
  } catch {
    window.prompt(T.party.copy, text);
  }
}

function Board({ code }: { code: string }) {
  const board = useApp((s) => (s.board?.code === code ? s.board : null));
  useEffect(() => {
    void loadBoard(code);
    const tick = () => {
      if (document.visibilityState === 'visible') void loadBoard(code);
    };
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  }, [code]);
  if (!board) return <p class="muted small">…</p>;
  return (
    <ol class="board" aria-label={`טבלת הקבוצה ${code}`} aria-live="polite">
      {board.members.map((m, i) => (
        <li key={`${i}-${m.name}`} class={m.me ? 'me' : ''}>
          <span class="rank">{i + 1}</span>
          <Thumb src={m.thumb} name={m.name} />
          <div class="grow">
            <div style={{ fontWeight: 500 }}>
              {m.name}
              {m.me ? <span class="small muted"> ({T.party.you})</span> : null}
            </div>
            <div class="bt">
              {m.title ? `${m.title} · ` : ''}
              {T.hero.level} <span class="num">{m.level}</span> · 🔥 <span class="num">{m.streak}</span>
            </div>
          </div>
          <span class="xp-tag">{m.xp} XP</span>
        </li>
      ))}
    </ol>
  );
}

function PartySection() {
  const parties = useApp((s) => s.parties);
  const [active, setActive] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<'' | 'create' | 'join' | 'leave'>('');
  const [err, setErr] = useState('');
  const cur = parties.find((p) => p.code === active) ?? parties[0] ?? null;

  const join = async (e: Event) => {
    e.preventDefault();
    setErr('');
    setBusy('join');
    const r = await partyJoin(joinCode);
    setBusy('');
    if (!r.ok) setErr(r.msg ?? '');
    else {
      setJoinCode('');
      setActive(r.code ?? null);
    }
  };
  const create = async () => {
    setErr('');
    setBusy('create');
    const r = await partyCreate(name);
    setBusy('');
    if (!r.ok) setErr(r.msg ?? '');
    else {
      setName('');
      setActive(r.code ?? null);
    }
  };
  const share = async (code: string) => {
    const text = T.party.inviteText(code, inviteLink(code));
    if (navigator.share) {
      try {
        await navigator.share({ title: 'The Quest', text });
        return;
      } catch {
        /* cancelled */
      }
    } else void copy(text);
  };

  return (
    <section class="card" aria-labelledby="party-h">
      <h2 id="party-h">{T.party.title}</h2>
      <p class="small muted">{T.party.intro}</p>
      {err ? (
        <p class="error" role="alert">
          {err}
        </p>
      ) : null}
      {parties.length > 1 ? (
        <div class="chips" role="tablist" style={{ marginBottom: '10px' }}>
          {parties.map((p) => (
            <button
              key={p.code}
              type="button"
              role="tab"
              class="choice"
              aria-selected={cur?.code === p.code}
              aria-pressed={cur?.code === p.code ? 'true' : 'false'}
              onClick={() => setActive(p.code)}
            >
              {p.name || p.code}
            </button>
          ))}
        </div>
      ) : null}
      {cur ? (
        <div class="stack">
          <div class="row">
            <div class="grow">
              <div style={{ fontWeight: 700 }}>{cur.name || 'הקבוצה שלי'}</div>
              <div class="small muted">
                {T.party.members(cur.count)} · {T.party.updated}
              </div>
            </div>
          </div>
          <div class="code-box" aria-label={`${T.party.code}: ${cur.code.split('').join(' ')}`}>
            {cur.code}
          </div>
          <div class="row wrap">
            <a
              class="btn small"
              href={`https://wa.me/?text=${encodeURIComponent(T.party.inviteText(cur.code, inviteLink(cur.code)))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {T.party.whatsapp}
            </a>
            <Button class="small" onClick={() => void copy(inviteLink(cur.code))}>
              <IconCopy width={18} height={18} />
              {T.party.copy}
            </Button>
            <Button class="small" onClick={() => void share(cur.code)}>
              <IconShare width={18} height={18} />
              {T.party.share}
            </Button>
          </div>
          <Board code={cur.code} />
          <Button
            class="danger small"
            busy={busy === 'leave'}
            onClick={async () => {
              if (!confirm(T.party.leaveConfirm)) return;
              setBusy('leave');
              await partyLeave(cur.code);
              setBusy('');
              setActive(null);
            }}
          >
            {T.party.leave}
          </Button>
        </div>
      ) : (
        <p class="muted">{T.party.empty}</p>
      )}
      <hr style={{ borderColor: 'var(--line)', margin: '16px 0' }} />
      <form onSubmit={join} class="row" style={{ alignItems: 'flex-end' }}>
        <label class="field grow" style={{ margin: 0 }}>
          <span>{T.party.code}</span>
          <input
            class="input ltr"
            value={joinCode}
            maxLength={6}
            autocomplete="off"
            autocapitalize="characters"
            onInput={(e) => setJoinCode(e.currentTarget.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          />
        </label>
        <Button type="submit" busy={busy === 'join'} disabled={joinCode.length !== 6}>
          {T.party.join}
        </Button>
      </form>
      <div class="row" style={{ alignItems: 'flex-end', marginTop: '12px' }}>
        <label class="field grow" style={{ margin: 0 }}>
          <span>{T.party.createName}</span>
          <input class="input" value={name} maxLength={24} onInput={(e) => setName(e.currentTarget.value)} />
        </label>
        <Button class="primary" busy={busy === 'create'} onClick={create}>
          {T.party.create}
        </Button>
      </div>
    </section>
  );
}

export function JoinSheet({ code, onYes, onNo }: { code: string; onYes: () => void; onNo: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Sheet title={T.party.joinTitle} onClose={onNo}>
      <p>{T.party.joinBody(code)}</p>
      <div class="code-box">{code}</div>
      {err ? (
        <p class="error" role="alert" style={{ marginTop: '12px' }}>
          {err}
        </p>
      ) : null}
      <div class="stack" style={{ marginTop: '14px' }}>
        <Button
          class="primary block"
          busy={busy}
          onClick={async () => {
            setBusy(true);
            const r = await partyJoin(code);
            setBusy(false);
            if (r.ok) onYes();
            else setErr(r.msg ?? '');
          }}
        >
          {T.party.joinYes}
        </Button>
        <Button class="ghost block" onClick={onNo}>
          {T.party.joinNo}
        </Button>
      </div>
    </Sheet>
  );
}

// -------------------------------------------------------- reminders

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function Reminders() {
  const rem = useApp((s) => s.game!.settings.reminders);
  const [m, setM] = useState(rem?.morning ?? '08:00');
  const [e, setE] = useState(rem?.evening ?? '20:30');
  const on = !!rem?.on;
  const specs = on ? reminderSpecs(rem!.morning, rem!.evening) : [];
  const ics = on ? buildIcs(specs) : '';
  const canShareFile = typeof navigator !== 'undefined' && !!navigator.canShare;
  return (
    <section class="card" aria-labelledby="rem-h">
      <h2 id="rem-h">{T.remind.title}</h2>
      <p class="small muted">{on ? T.remind.isOn(rem!.morning, rem!.evening) : T.remind.intro}</p>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          setSetting('reminders', { on: true, morning: m, evening: e });
        }}
      >
        <div class="row">
          <label class="field grow">
            <span>{T.remind.morning}</span>
            <input class="input ltr" type="time" value={m} required onInput={(ev) => setM(ev.currentTarget.value)} />
          </label>
          <label class="field grow">
            <span>{T.remind.evening}</span>
            <input class="input ltr" type="time" value={e} required onInput={(ev) => setE(ev.currentTarget.value)} />
          </label>
        </div>
        <Button type="submit" class="primary block">
          {T.remind.confirm}
        </Button>
      </form>
      {on ? (
        <div class="stack" style={{ marginTop: '14px' }}>
          {specs.map((s) => (
            <a key={s.kind} class="btn block" href={googleLink(s)} target="_blank" rel="noopener noreferrer" data-reminder={s.kind}>
              {T.remind.google(s.kind === 'morning' ? `בוקר ${s.time}` : `ערב ${s.time}`)}
            </a>
          ))}
          <Button class="block" onClick={() => download('the-quest-reminders.ics', ics)}>
            {T.remind.ics}
          </Button>
          {canShareFile ? (
            <Button
              class="block ghost"
              onClick={async () => {
                const file = new File([ics], 'the-quest-reminders.ics', { type: 'text/calendar' });
                if (navigator.canShare?.({ files: [file] })) {
                  try {
                    await navigator.share({ files: [file], title: 'The Quest' });
                  } catch {
                    /* cancelled */
                  }
                } else download('the-quest-reminders.ics', ics);
              }}
            >
              {T.remind.shareIcs}
            </Button>
          ) : null}
          <p class="hint">{T.remind.note}</p>
          <Button class="danger small" onClick={() => setSetting('reminders', { on: false, morning: rem!.morning, evening: rem!.evening })}>
            {T.remind.off}
          </Button>
        </div>
      ) : rem ? (
        <p class="notice small" style={{ marginTop: '12px' }}>
          {T.remind.offNote}
        </p>
      ) : (
        <p class="hint">{T.remind.note}</p>
      )}
    </section>
  );
}

// ---------------------------------------------- account + settings

function Account() {
  const session = useApp((s) => s.session);
  const mute = useApp((s) => s.game!.settings.mute);
  const [sheet, setSheet] = useState<'' | 'pin' | 'delete' | 'terms'>('');
  return (
    <>
      <section class="card" aria-labelledby="set-h">
        <h2 id="set-h">{T.settings.title}</h2>
        <div class="list-btn" style={{ cursor: 'default' }}>
          <span>
            {T.settings.sound}: {mute ? T.settings.soundOff : T.settings.soundOn}
          </span>
          <Switch checked={!mute} label={T.settings.sound} onChange={(v) => setSetting('mute', !v)} />
        </div>
        <p class="hint">{T.settings.iosNote}</p>
        <p class="hint">{T.settings.motion}</p>
        <p class="hint">
          {T.settings.install}: {T.settings.installHint}
        </p>
      </section>
      <section class="card" aria-labelledby="acc-h">
        <h2 id="acc-h">{T.account.title}</h2>
        <p class="small muted">
          {T.account.phone}: <span class="num">{session ? formatPhone(session.phone) : ''}</span>
        </p>
        <button type="button" class="list-btn" onClick={() => setSheet('pin')}>
          {T.account.changePin}
        </button>
        <button type="button" class="list-btn" onClick={() => setSheet('terms')}>
          {T.account.terms}
        </button>
        <button type="button" class="list-btn" onClick={() => void signOut()}>
          {T.account.logout}
        </button>
        <button type="button" class="list-btn" style={{ color: 'var(--bad)' }} onClick={() => setSheet('delete')}>
          {T.account.del}
        </button>
        <p class="hint">
          {T.settings.version} <span class="num">{__APP_VERSION__}</span>
        </p>
      </section>
      {sheet === 'pin' ? <PinSheet onClose={() => setSheet('')} /> : null}
      {sheet === 'delete' ? <DeleteSheet onClose={() => setSheet('')} /> : null}
      {sheet === 'terms' ? <TermsSheet onClose={() => setSheet('')} /> : null}
    </>
  );
}

function PinSheet({ onClose }: { onClose: () => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <Sheet title={T.account.changePin} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await changePin(a, b);
          setBusy(false);
          setMsg({ ok: r.ok, t: r.msg ?? '' });
          if (r.ok) setTimeout(onClose, 1200);
        }}
      >
        {msg ? (
          <p class={msg.ok ? 'notice' : 'error'} role="alert">
            {msg.t}
          </p>
        ) : null}
        <label class="field">
          <span>{T.account.oldPin}</span>
          <input
            class="input pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            autocomplete="current-password"
            value={a}
            onInput={(e) => setA(e.currentTarget.value.replace(/\D/g, ''))}
          />
        </label>
        <label class="field">
          <span>{T.account.newPin}</span>
          <input
            class="input pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            autocomplete="new-password"
            value={b}
            onInput={(e) => setB(e.currentTarget.value.replace(/\D/g, ''))}
          />
        </label>
        <Button type="submit" class="primary block" busy={busy} disabled={a.length !== 4 || b.length !== 4}>
          {T.common.ok}
        </Button>
      </form>
    </Sheet>
  );
}

function DeleteSheet({ onClose }: { onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Sheet title={T.account.del} onClose={onClose}>
      <p class="error">{T.account.delBody}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const r = await deleteAccount(pin);
          setBusy(false);
          if (!r.ok) setErr(r.msg ?? '');
        }}
      >
        {err ? (
          <p class="error" role="alert">
            {err}
          </p>
        ) : null}
        <label class="field">
          <span>{T.account.delPin}</span>
          <input
            class="input pin"
            type="password"
            inputMode="numeric"
            maxLength={4}
            autocomplete="current-password"
            value={pin}
            onInput={(e) => setPin(e.currentTarget.value.replace(/\D/g, ''))}
          />
        </label>
        <Button type="submit" class="danger block" busy={busy} disabled={pin.length !== 4}>
          {T.account.delYes}
        </Button>
      </form>
    </Sheet>
  );
}

export function HeroScreen() {
  return (
    <section aria-label={T.hero.title}>
      <HeroCard />
      <PartySection />
      <Reminders />
      <Account />
    </section>
  );
}
