import { useEffect, useState } from 'preact/hooks';
import { T } from '../i18n/he';
import { app, useApp, type Tab } from '../app/store';
import { setTab, clearPendingJoin, seenBroadcast, syncNow } from '../app/actions';
import { levelInfo } from '../game/level';
import { titleName } from '../game/engine';
import { SetupScreen, AuthScreen, ConsentScreen } from './screens/Auth';
import { OnboardingScreen } from './screens/Onboarding';
import { QuestsScreen } from './screens/Quests';
import { WorldScreen } from './screens/World';
import { HeroScreen, JoinSheet } from './screens/Hero';
import { Avatar, Button, XpBar } from './components/common';
import { Overlays, Toasts } from './components/Overlays';
import { IconFlame, IconMap, IconShield, IconSword } from './components/icons';
import { isOutdated } from '../app/version';
import type { ComponentType } from 'preact';

function LazyAdmin() {
  const [C, setC] = useState<ComponentType | null>(null);
  useEffect(() => {
    void import('./screens/Admin').then((m) => setC(() => m.AdminScreen));
  }, []);
  return C ? <C /> : <main class="screen plain" aria-busy="true" />;
}

function Hud() {
  const g = useApp((s) => s.game!);
  const thumb = useApp((s) => s.thumb);
  const imgs = useApp((s) => s.imgs);
  const sync = useApp((s) => s.sync);
  const name = g.profile.heroName || app.get().session?.name || '';
  const info = levelInfo(g.xp);
  return (
    <header class="hud">
      {thumb ? (
        <div class="avatar" style={{ width: '52px', height: '52px' }} role="img" aria-label={`הדמות של ${name}`}>
          <img src={thumb.src} alt="" />
        </div>
      ) : (
        <Avatar cut={imgs?.cut} legacy={imgs?.legacy} level={info.level} size={52} label={`הדמות של ${name}`} />
      )}
      <div class="who">
        <div class="row" style={{ gap: '8px' }}>
          <span class="name">{name}</span>
          <span class="lvl-badge" aria-label={`${T.hero.level} ${info.level}`}>
            LV {info.level}
          </span>
        </div>
        <div class="meta">
          <span>{titleName(g.title)}</span>
          <span class="streak-pill" aria-label={T.quests.streak(g.streak.count)}>
            <IconFlame width={14} height={14} />
            <span class="num">{g.streak.count}</span>
            {g.streak.shields ? <span aria-label={T.quests.shields(g.streak.shields)}>🛡️{g.streak.shields}</span> : null}
          </span>
          <button
            type="button"
            class="sync-dot linkbtn"
            style={{ textDecoration: 'none', minHeight: 'auto' }}
            data-s={sync}
            onClick={syncNow}
            aria-live="polite"
          >
            {T.sync[sync]}
          </button>
        </div>
        <XpBar pct={info.pct} label={`XP: ${info.into} מתוך ${info.need} לדרגה הבאה`} />
        <div class="small muted num" style={{ fontSize: '0.72rem', textAlign: 'left' }} aria-hidden="true">
          {info.into}/{info.need} XP
        </div>
      </div>
    </header>
  );
}

function Nav({ tab }: { tab: Tab }) {
  const items: { id: Tab; label: string; Icon: typeof IconSword }[] = [
    { id: 'quests', label: T.nav.quests, Icon: IconSword },
    { id: 'world', label: T.nav.world, Icon: IconMap },
    { id: 'hero', label: T.nav.hero, Icon: IconShield },
  ];
  return (
    <nav class="nav" aria-label="ניווט ראשי">
      <ul>
        {items.map(({ id, label, Icon }) => (
          <li key={id}>
            <button
              type="button"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                setTab(id);
                window.scrollTo({ top: 0 });
              }}
            >
              <Icon />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Banners() {
  const online = useApp((s) => s.online);
  const update = useApp((s) => s.updateReady);
  const server = useApp((s) => s.server);
  const seen = useApp((s) => s.game?.seenBroadcast ?? '');
  const outdated = !!server && isOutdated(server.min_version);
  return (
    <>
      {!online ? (
        <div class="banner warn" role="status">
          {T.common.offline}
        </div>
      ) : null}
      {update || outdated ? (
        <div class="banner gold" role="status">
          <span class="grow">{outdated ? T.common.minVersion : T.common.update}</span>
          <Button class="small primary" onClick={() => location.reload()}>
            {T.common.refresh}
          </Button>
        </div>
      ) : null}
      {server?.broadcast && server.broadcast_id && server.broadcast_id !== seen ? (
        <div class="banner gold" role="status">
          <span aria-hidden="true">📣</span>
          <span class="grow">{server.broadcast}</span>
          <button type="button" class="iconbtn" aria-label={T.common.close} onClick={() => seenBroadcast(server.broadcast_id)}>
            ✕
          </button>
        </div>
      ) : null}
    </>
  );
}

function Game() {
  const tab = useApp((s) => s.tab);
  const pendingJoin = useApp((s) => s.pendingJoin);
  const overlays = useApp((s) => s.overlays.length);
  const [scrolls] = useState(() => new Map<Tab, number>());
  // keep the scroll position per tab
  useEffect(() => {
    const y = scrolls.get(tab) ?? 0;
    window.scrollTo({ top: y });
    const onScroll = () => scrolls.set(tab, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [tab]);
  return (
    <>
      <main class="screen" id="main" aria-hidden={overlays ? 'true' : undefined}>
        <Hud />
        <Banners />
        {tab === 'quests' ? <QuestsScreen /> : tab === 'world' ? <WorldScreen /> : <HeroScreen />}
      </main>
      <Nav tab={tab} />
      {pendingJoin ? (
        <JoinSheet
          code={pendingJoin}
          onYes={() => {
            clearPendingJoin();
            setTab('hero');
          }}
          onNo={clearPendingJoin}
        />
      ) : null}
    </>
  );
}

export function App() {
  const phase = useApp((s) => s.phase);
  return (
    <>
      {phase === 'boot' ? (
        <main class="screen plain center" aria-busy="true">
          <p class="muted" style={{ marginTop: '40vh' }}>
            …
          </p>
        </main>
      ) : phase === 'setup' ? (
        <SetupScreen />
      ) : phase === 'admin' ? (
        <LazyAdmin />
      ) : phase === 'auth' ? (
        <AuthScreen />
      ) : phase === 'consent' ? (
        <ConsentScreen />
      ) : phase === 'onboarding' ? (
        <OnboardingScreen />
      ) : (
        <Game />
      )}
      <Overlays />
      <Toasts />
    </>
  );
}
