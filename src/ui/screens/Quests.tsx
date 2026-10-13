import { useEffect, useRef, useState } from 'preact/hooks';
import { T } from '../../i18n/he';
import { useApp } from '../../app/store';
import { completeQuest, progressQuest, easeQuest, setQuestText, setSetting } from '../../app/actions';
import type { Quest } from '../../game/types';
import { REALMS } from '../../content/realms';
import { bossDef } from '../../game/engine';
import { RETURN_LINES, pick } from '../../content/messages';
import { Button } from '../components/common';
import { IconCheck, IconMinus, IconPlus, IconFocus, RealmIcon } from '../components/icons';

const SOURCE_LABEL: Partial<Record<Quest['source'], string>> = {
  wild: T.quests.wild,
  creator: T.quests.creator,
  micro: T.quests.micro,
};

function TextQuest({ q }: { q: Quest }) {
  const [v, setV] = useState(q.text ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = `qt-${q.id}`;
  return (
    <form
      class="textq"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim().length >= 2) completeQuest(q.id, v);
      }}
    >
      <label for={id} class="sr-only">
        {q.prompt ?? q.title}
      </label>
      <textarea
        id={id}
        class="input"
        rows={2}
        maxLength={2000}
        placeholder={q.source === 'creator' ? T.quests.creatorPh : q.prompt}
        value={v}
        onInput={(e) => {
          const val = e.currentTarget.value;
          setV(val);
          if (timer.current) clearTimeout(timer.current);
          // draft is kept, without re-rendering the list
          timer.current = setTimeout(() => setQuestText(q.id, val), 800);
        }}
      />
      <div class="row">
        <Button type="submit" class="primary small" disabled={v.trim().length < 2}>
          {T.quests.save}
        </Button>
      </div>
    </form>
  );
}

export function QuestCard({ q, focus }: { q: Quest; focus?: boolean }) {
  const [just, setJust] = useState(false);
  const realm = REALMS[q.realm];
  const label = SOURCE_LABEL[q.source];
  const pct = q.kind === 'count' && q.target ? (q.progress ?? 0) / q.target : 0;
  const doneNow = () => {
    setJust(true);
    setTimeout(() => setJust(false), 500);
  };
  return (
    <article
      class={`quest${q.done ? ' done' : ''}${just ? ' just' : ''}`}
      style={{ '--rc': realm.color } as Record<string, string>}
      aria-label={q.title}
      data-qid={q.id}
      data-kind={q.kind}
    >
      {q.kind !== 'text' ? (
        <button
          type="button"
          class="tick"
          aria-pressed={q.done ? 'true' : 'false'}
          aria-label={q.done ? `${q.title}: ${T.quests.done}` : `סימון: ${q.title}`}
          disabled={q.done}
          onClick={() => {
            if (q.done) return;
            doneNow();
            completeQuest(q.id);
          }}
        >
          <IconCheck />
        </button>
      ) : (
        <div class="tick" aria-hidden="true" data-pressed={q.done}>
          {q.done ? (
            <IconCheck style={{ opacity: 1, transform: 'none' }} />
          ) : (
            <RealmIcon realm={q.realm} width={24} height={24} style={{ color: realm.color, opacity: 0.8 }} />
          )}
        </div>
      )}
      <div class="qbody">
        <div class="qtitle">{q.title}</div>
        {q.desc ? <div class="qdesc">{q.desc}</div> : null}
        {q.kind === 'count' && q.target && !q.done ? (
          <div class="counter">
            <Button class="small" aria-label={`פחות: ${q.title}`} onClick={() => progressQuest(q.id, -1)} disabled={(q.progress ?? 0) <= 0}>
              <IconMinus width={20} height={20} />
            </Button>
            <div
              class="progress"
              role="progressbar"
              aria-label={q.unit ?? q.title}
              aria-valuemin={0}
              aria-valuemax={q.target}
              aria-valuenow={q.progress ?? 0}
            >
              <div style={{ width: `${pct * 100}%` }} />
            </div>
            <span class="num small" aria-hidden="true">
              {q.progress ?? 0}/{q.target}
            </span>
            <Button
              class="small"
              aria-label={`עוד אחד: ${q.title}`}
              onClick={() => {
                if ((q.progress ?? 0) + 1 >= q.target!) doneNow();
                progressQuest(q.id, 1);
              }}
            >
              <IconPlus width={20} height={20} />
            </Button>
          </div>
        ) : null}
        {q.kind === 'text' && !q.done ? <TextQuest q={q} /> : null}
        {q.kind === 'text' && q.done && q.text ? <div class="qdesc">“{q.text}”</div> : null}
        <div class="qmeta">
          <span class="chip tagc" style={{ '--rc': realm.color } as Record<string, string>}>
            {realm.name}
          </span>
          {label ? <span class="chip">{label}</span> : null}
          {q.weak ? (
            <span class="chip" style={{ color: '#ff9fb2', borderColor: '#5c1020' }}>
              ⚔ {T.quests.weak}
            </span>
          ) : null}
          <span class="xp-tag">+{q.done && q.gained ? q.gained : q.xp} XP</span>
        </div>
        {!q.done && !q.eased && !focus ? (
          <div class="qactions">
            <button type="button" class="linkbtn" onClick={() => easeQuest(q.id)} title={T.quests.easeHint}>
              {T.quests.ease}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function BossCard() {
  const boss = useApp((s) => s.game?.boss ?? null);
  const def = bossDef(boss?.id);
  const [hit, setHit] = useState(false);
  const last = useRef(boss?.hp ?? 0);
  useEffect(() => {
    if (boss && boss.hp < last.current) {
      setHit(true);
      const t = setTimeout(() => setHit(false), 450);
      last.current = boss.hp;
      return () => clearTimeout(t);
    }
    last.current = boss?.hp ?? 0;
    return undefined;
  }, [boss?.hp]);
  if (!boss || !def) return null;
  const pct = boss.max ? boss.hp / boss.max : 0;
  return (
    <section
      class={`card boss${hit ? ' hit' : ''}`}
      aria-label={`בוס: ${def.name}`}
      style={{ borderColor: '#5c1020', background: 'linear-gradient(180deg,#2b1220,#160b14)' }}
    >
      <div class="row">
        <div class="grow">
          <div class="small" style={{ color: '#ff9fb2' }}>
            {def.epithet}
          </div>
          <div class="bname">{def.name}</div>
        </div>
        <div class="num" style={{ color: '#ff9fb2' }} aria-label={`${T.quests.bossHp}: ${boss.hp} מתוך ${boss.max}`}>
          {boss.hp}/{boss.max}
        </div>
      </div>
      <div class="hp" aria-hidden="true">
        <div style={{ width: `${pct * 100}%` }} />
      </div>
      <div class="taunt">{boss.hp > 0 ? pick(def.taunts, boss.hp) : T.boss.defeated}</div>
      <div class="chips" style={{ marginTop: '8px' }}>
        <span class="small muted">{T.quests.bossWeak}</span>
        {def.weak.map((r) => (
          <span key={r} class="chip tagc" style={{ '--rc': REALMS[r].color } as Record<string, string>}>
            {REALMS[r].name}
          </span>
        ))}
      </div>
    </section>
  );
}

export function QuestsScreen() {
  const day = useApp((s) => s.game?.day ?? null);
  const focusMode = useApp((s) => s.game?.settings.focusMode ?? false);
  if (!day) return null;
  const open = day.quests.filter((q) => !q.done);
  const doneCount = day.quests.length - open.length;

  if (focusMode) {
    const q = open[0];
    return (
      <section aria-labelledby="focus-h">
        <div class="row" style={{ justifyContent: 'space-between' }}>
          <h1 id="focus-h" style={{ margin: 0 }}>
            {T.quests.focusOn}
          </h1>
          <Button class="small" onClick={() => setSetting('focusMode', false)}>
            {T.quests.focusOff}
          </Button>
        </div>
        <div class="focus-wrap">
          {q ? (
            <>
              <p class="muted center num">
                {doneCount + 1} / {day.quests.length}
              </p>
              <QuestCard key={q.id} q={q} focus />
            </>
          ) : (
            <p class="center">{T.quests.allDone}</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="today-h">
      {day.returning ? <div class="banner gold">{pick(RETURN_LINES, day.key.length + day.quests.length)}</div> : null}
      <BossCard />
      <div class="section-title">
        <h1 id="today-h" style={{ fontSize: '1.2rem', margin: 0 }}>
          {T.quests.today}{' '}
          <span class="num muted small">
            {doneCount}/{day.quests.length}
          </span>
        </h1>
        <Button class="small ghost" onClick={() => setSetting('focusMode', true)} aria-label={T.quests.focusOn}>
          <IconFocus width={20} height={20} />
          {T.quests.focusOn}
        </Button>
      </div>
      <div>
        {day.quests.map((q) => (
          <QuestCard key={q.id} q={q} />
        ))}
      </div>
      {!open.length ? (
        <div class="card gold center" role="status">
          <p style={{ margin: 0, fontWeight: 700 }}>{T.quests.allDone}</p>
          <p class="muted small" style={{ margin: 0 }}>
            {T.quests.tomorrow}
          </p>
        </div>
      ) : null}
    </section>
  );
}
