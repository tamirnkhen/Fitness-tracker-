import { useEffect, useRef, useState } from 'preact/hooks';
import { T } from '../../i18n/he';
import { startInterview, answerInterview, type BotMsg, type Interview, type Prompt } from '../../game/interview';
import { app, useApp } from '../../app/store';
import { finishInterview } from '../../app/actions';
import { Button } from '../components/common';
import { IconChevron } from '../components/icons';
import { LazyCreator as CharacterCreator } from '../components/LazyCreator';

interface Line {
  id: number;
  from: 'bot' | 'me';
  text: string;
  tone?: BotMsg['tone'];
}

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let lineId = 0;

export function OnboardingScreen() {
  const accountName = useApp((s) => s.session?.name ?? '');
  const [showCreator, setShowCreator] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [iv, setIv] = useState<Interview | null>(null);
  const [prompt, setPrompt] = useState<Prompt>({ input: 'none' });
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const say = (msgs: BotMsg[], next: Prompt) => {
    setPrompt({ input: 'none' });
    queue.current = queue.current.then(async () => {
      for (const m of msgs) {
        if (!reduced()) {
          setTyping(true);
          await new Promise((r) => setTimeout(r, Math.min(1100, 350 + m.text.length * 9)));
          setTyping(false);
        }
        setLines((l) => [...l, { id: ++lineId, from: 'bot', text: m.text, ...(m.tone ? { tone: m.tone } : {}) }]);
      }
      setPrompt(next);
      setPicked([]);
      setTimeout(() => inputRef.current?.focus(), 30);
    });
  };

  useEffect(() => {
    const t = startInterview(accountName);
    setIv(t.iv);
    say(t.msgs, t.prompt);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'end' });
  }, [lines.length, typing, prompt]);

  const send = (chips: string[] = picked) => {
    if (!iv) return;
    const t = text.trim();
    if (!t && !chips.length) return;
    const labels = chips.map((c) => (c === 'account' ? accountName : (prompt.chips?.find((x) => x.id === c)?.label ?? c)));
    const mine = [t, ...labels].filter(Boolean).join(' · ');
    setLines((l) => [...l, { id: ++lineId, from: 'me', text: mine }]);
    setText('');
    const turn = answerInterview(iv, { text: t, chips }, accountName);
    setIv(turn.iv);
    if (turn.iv.step === 'done') {
      finishInterview({
        heroName: turn.iv.name,
        focus: turn.iv.focus,
        struggles: turn.iv.struggles,
        minutes: turn.iv.minutes,
        goal: turn.iv.goal,
        block: turn.iv.block,
      });
      app.set({ creatingCharacter: true });
    }
    say(turn.msgs, turn.prompt);
  };

  const toggle = (id: string) => {
    if (!prompt.multi) {
      send([id]);
      return;
    }
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));
  };

  const done = iv?.step === 'done' && prompt.input === 'none' && !typing;
  if (showCreator) {
    return <CharacterCreator onDone={() => app.set({ creatingCharacter: false, phase: 'game' })} />;
  }

  return (
    <main class="screen plain" aria-labelledby="qm-title">
      <div class="master">
        <div class="orb" aria-hidden="true" />
        <div>
          <h1 id="qm-title" style={{ margin: 0, fontSize: '1.15rem' }}>
            {T.onboarding.master}
          </h1>
          <div class="small muted">{T.tagline}</div>
        </div>
      </div>
      <div class="chat" role="log" aria-live="polite" aria-relevant="additions" aria-label="שיחה עם ה-Quest Master">
        {lines.map((l) => (
          <div key={l.id} class={`bubble ${l.from}${l.tone ? ' ' + l.tone : ''}`}>
            <span class="sr-only">{l.from === 'bot' ? `${T.onboarding.master}: ` : `${T.onboarding.you}: `}</span>
            {l.text}
          </div>
        ))}
        {typing ? (
          <div class="typing" aria-label={T.onboarding.typing}>
            <i />
            <i />
            <i />
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <div class="composer">
        {prompt.chips && prompt.chips.length && prompt.input !== 'none' ? (
          <div class="chips" style={{ marginBottom: '10px' }} role="group" aria-label="תשובות מוכנות">
            {prompt.chips.map((c) => (
              <button
                key={c.id}
                type="button"
                class="choice"
                aria-pressed={picked.includes(c.id) ? 'true' : 'false'}
                onClick={() => toggle(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : null}
        {prompt.input === 'text' || prompt.input === 'both' ? (
          <form
            class="row"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <label class="grow">
              <span class="sr-only">{prompt.placeholder ?? 'תשובה'}</span>
              <input
                ref={inputRef}
                class="input"
                value={text}
                maxLength={prompt.maxLen ?? 400}
                placeholder={prompt.placeholder}
                onInput={(e) => setText(e.currentTarget.value)}
                enterKeyHint="send"
                autocomplete="off"
              />
            </label>
            <Button type="submit" class="primary" aria-label={T.common.send} disabled={!text.trim() && !picked.length}>
              <IconChevron width={22} height={22} />
            </Button>
          </form>
        ) : null}
        {prompt.input === 'chips' && prompt.multi ? (
          <Button class="primary block" disabled={!picked.length} onClick={() => send()}>
            {T.common.next}
          </Button>
        ) : null}
        {done ? (
          <div class="stack">
            <Button class="primary block" onClick={() => setShowCreator(true)}>
              {T.hero.create}
            </Button>
            <Button class="ghost block" onClick={() => app.set({ creatingCharacter: false, phase: 'game' })}>
              {T.common.skip}
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
