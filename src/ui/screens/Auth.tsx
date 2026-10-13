import { useState, useRef } from 'preact/hooks';
import { T } from '../../i18n/he';
import { termsSections, TERMS_VERSION } from '../../i18n/terms';
import { Button, Sheet } from '../components/common';
import { Logo } from '../components/icons';
import { useApp } from '../../app/store';
import { login, register, acceptTerms, signOut } from '../../app/actions';
import { isWeakPin } from '../../game/phone';

export function Brand() {
  return (
    <div class="brand">
      <Logo class="logo" />
      <div class="word" lang="en">
        THE QUEST
      </div>
      <div class="tag">{T.tagline}</div>
    </div>
  );
}

export function TermsSheet({ onClose }: { onClose: () => void }) {
  const contact = useApp((s) => s.config?.contact ?? '');
  return (
    <Sheet title={T.auth.termsLink} onClose={onClose}>
      <div class="terms">
        {termsSections(contact).map((s) => (
          <section key={s.h}>
            <h3>{s.h}</h3>
            <ul>
              {s.p.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </section>
        ))}
        <div class="spacer" />
        <Button class="primary block" onClick={onClose}>
          {T.common.close}
        </Button>
      </div>
    </Sheet>
  );
}

export function SetupScreen() {
  const cfg = useApp((s) => s.config);
  return (
    <main class="screen plain">
      <Brand />
      <div class="card">
        <h1>{T.setup.title}</h1>
        {cfg?.problem === 'secret_key' ? (
          <p class="error" role="alert">
            {T.setup.secret}
          </p>
        ) : null}
        {cfg?.problem === 'bad_url' ? (
          <p class="error" role="alert">
            {T.setup.badUrl}
          </p>
        ) : null}
        <p>{T.setup.body}</p>
        <ol>
          {T.setup.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <pre class="small" dir="ltr" style={{ background: '#0f0c24', padding: '10px', borderRadius: '10px', overflowX: 'auto' }}>
          {`window.QUEST_CONFIG = {\n  SUPABASE_URL: 'https://xxxx.supabase.co',\n  SUPABASE_KEY: 'sb_publishable_...',\n  CONTACT: ''\n};`}
        </pre>
      </div>
    </main>
  );
}

export function AuthScreen() {
  const [tab, setTab] = useState<'login' | 'register'>('register');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [terms, setTerms] = useState(false);
  const pending = useApp((s) => s.pendingJoin);
  const errRef = useRef<HTMLParagraphElement>(null);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    setErr('');
    if (tab === 'register' && !agree) {
      setErr(T.auth.noTerms);
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setErr(T.err.bad_pin as string);
      return;
    }
    if (tab === 'register' && isWeakPin(pin)) {
      setErr(T.err.weak_pin as string);
      return;
    }
    setBusy(true);
    const r = tab === 'login' ? await login(phone, pin) : await register(phone, pin, name, agree);
    setBusy(false);
    if (!r.ok) {
      setErr(r.msg ?? (T.err.unknown as string));
      setTimeout(() => errRef.current?.focus(), 0);
    }
  };

  const switchTab = (t: 'login' | 'register') => {
    setTab(t);
    setErr('');
  };

  return (
    <main class="screen plain">
      <Brand />
      {pending ? <div class="banner gold">{T.party.joinBody(pending).split('.')[0]}.</div> : null}
      <div class="card">
        <div class="tabs" role="tablist" aria-label={T.app}>
          <button
            role="tab"
            type="button"
            id="tab-register"
            aria-selected={tab === 'register'}
            aria-controls="authform"
            onClick={() => switchTab('register')}
          >
            {T.auth.register}
          </button>
          <button
            role="tab"
            type="button"
            id="tab-login"
            aria-selected={tab === 'login'}
            aria-controls="authform"
            onClick={() => switchTab('login')}
          >
            {T.auth.login}
          </button>
        </div>
        <form id="authform" role="tabpanel" aria-labelledby={`tab-${tab}`} onSubmit={submit} noValidate>
          {err ? (
            <p class="error" role="alert" tabIndex={-1} ref={errRef}>
              {err}
            </p>
          ) : null}
          {tab === 'register' ? (
            <label class="field">
              <span>{T.auth.name}</span>
              <input
                class="input"
                name="name"
                autocomplete="nickname"
                maxLength={24}
                required
                value={name}
                onInput={(e) => setName(e.currentTarget.value)}
              />
            </label>
          ) : null}
          <label class="field">
            <span>{T.auth.phone}</span>
            <input
              class="input ltr"
              name="username"
              type="tel"
              inputMode="tel"
              autocomplete="username tel"
              placeholder={T.auth.phoneHint}
              required
              value={phone}
              onInput={(e) => setPhone(e.currentTarget.value)}
            />
          </label>
          <label class="field">
            <span>{tab === 'register' ? T.auth.pinNew : T.auth.pin}</span>
            <input
              class="input pin"
              name="password"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              autocomplete={tab === 'register' ? 'new-password' : 'current-password'}
              required
              value={pin}
              onInput={(e) => setPin(e.currentTarget.value.replace(/\D/g, '').slice(0, 4))}
            />
            {tab === 'register' ? <div class="hint">{T.auth.pinHint}</div> : null}
          </label>
          {tab === 'register' ? (
            <div class="field">
              <label class="check">
                <input type="checkbox" name="terms" checked={agree} onChange={(e) => setAgree(e.currentTarget.checked)} required />
                <span>
                  {T.auth.terms1}
                  <button type="button" class="linkbtn" onClick={() => setTerms(true)}>
                    {T.auth.termsLink}
                  </button>
                  {T.auth.terms2}
                </span>
              </label>
            </div>
          ) : null}
          <Button type="submit" class="primary block" busy={busy}>
            {tab === 'login' ? T.auth.submitLogin : T.auth.submitRegister}
          </Button>
          <p class="hint center">{T.auth.privacyNote}</p>
        </form>
      </div>
      <p class="center small">
        <button type="button" class="linkbtn" onClick={() => setTerms(true)}>
          {T.account.terms}
        </button>
      </p>
      {terms ? <TermsSheet onClose={() => setTerms(false)} /> : null}
    </main>
  );
}

export function ConsentScreen() {
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const serverVer = useApp((s) => s.termsVer);
  const outdated = serverVer > TERMS_VERSION;
  return (
    <main class="screen plain">
      <Brand />
      <div class="card">
        <h1>{T.consent.title}</h1>
        <p>{T.consent.body}</p>
        <p class="small muted">v{TERMS_VERSION}</p>
        {err ? (
          <p class="error" role="alert">
            {err}
          </p>
        ) : null}
        {outdated ? (
          <div class="stack">
            <p class="notice">{T.common.minVersion}</p>
            <Button class="primary block" onClick={() => location.reload()}>
              {T.common.refresh}
            </Button>
          </div>
        ) : null}
        <div class="stack" hidden={outdated}>
          <Button class="block" onClick={() => setTerms(true)}>
            {T.consent.read}
          </Button>
          <Button
            class="primary block"
            busy={busy}
            onClick={async () => {
              setBusy(true);
              const r = await acceptTerms();
              setBusy(false);
              if (!r.ok) setErr(r.msg ?? (T.err.unknown as string));
            }}
          >
            {T.consent.accept}
          </Button>
          <Button class="ghost block" onClick={() => void signOut()}>
            {T.consent.logout}
          </Button>
        </div>
      </div>
      {terms ? <TermsSheet onClose={() => setTerms(false)} /> : null}
    </main>
  );
}
