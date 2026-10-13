import { T } from '../../i18n/he';
import { useApp } from '../../app/store';
import { REALMS, REALM_ORDER } from '../../content/realms';
import { TIER_NAMES } from '../../content/tracks';
import { ACH } from '../../content/progress';
import { BOSSES } from '../../content/bosses';
import { RealmIcon } from '../components/icons';
import { addDays, dayKey } from '../../game/dates';

export function WorldScreen() {
  const g = useApp((s) => s.game);
  if (!g) return null;
  const today = dayKey();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  return (
    <section aria-labelledby="world-h">
      <h1 id="world-h">{T.world.title}</h1>
      <div class="realms">
        {REALM_ORDER.map((r) => {
          const realm = REALMS[r];
          const a = g.adapt[r];
          const focus = g.profile.focus.includes(r);
          const tierPct = (a.tier + a.hits / 3) / 6;
          return (
            <article
              key={r}
              class={`realm${focus ? ' focus' : ''}`}
              style={{ '--rc': realm.color } as Record<string, string>}
              aria-label={`${realm.name}: ${T.world.tier} ${a.tier + 1}, ${g.counters.perRealm[r]} משימות`}
            >
              <div class="ring" style={{ '--p': String(Math.min(1, tierPct)) } as Record<string, string>} aria-hidden="true">
                <span>{a.tier + 1}</span>
              </div>
              <RealmIcon realm={r} class="ri" />
              <h2 style={{ margin: '6px 0 0', fontSize: '1.05rem' }}>{realm.name}</h2>
              <div class="land">{realm.land}</div>
              <div class="small" style={{ marginTop: '6px', color: realm.color }}>
                {T.world.tier}: {TIER_NAMES[a.tier]}
              </div>
              <div class="small muted">
                <span class="num">{g.realmXp[r]} XP</span> · {g.counters.perRealm[r]} משימות
              </div>
            </article>
          );
        })}
      </div>

      <div class="section-title">
        <h2>{T.world.history}</h2>
      </div>
      <div class="card">
        <div class="hist" role="img" aria-label={`${days.filter((d) => (g.history[d]?.done ?? 0) > 0).length} ימים פעילים מתוך 14`}>
          {days.map((d) => {
            const h = g.history[d];
            const l = !h || !h.done ? 0 : h.done >= h.total ? 3 : h.done / h.total >= 0.5 ? 2 : 1;
            return <div key={d} data-l={l} title={d} />;
          })}
        </div>
      </div>

      <div class="section-title">
        <h2>{T.world.achievements}</h2>
        <span class="num muted small">
          {ACH.filter((a) => a.id in g.ach).length}/{ACH.length}
        </span>
      </div>
      <div class="ach-grid">
        {ACH.map((a) => {
          const on = a.id in g.ach;
          return (
            <div key={a.id} class={`ach${on ? ' on' : ''}`} aria-label={`${a.name}: ${a.desc}${on ? '' : ' (נעול)'}`} role="img">
              <span class="ai" aria-hidden="true">
                {a.icon}
              </span>
              <span class="an">{a.name}</span>
              <span class="muted" style={{ fontSize: '0.7rem' }}>
                {a.desc}
              </span>
            </div>
          );
        })}
      </div>

      <div class="section-title">
        <h2>{T.world.bosses}</h2>
      </div>
      <div class="card">
        {g.bossesDefeated.length ? (
          <ul style={{ margin: 0, paddingInlineStart: '18px' }}>
            {g.bossesDefeated.map((id, i) => {
              const b = BOSSES.find((x) => x.id === id);
              return <li key={id + i}>{b ? `${b.name}, ${b.epithet}` : id}</li>;
            })}
          </ul>
        ) : (
          <p class="muted" style={{ margin: 0 }}>
            {T.world.noBosses}
          </p>
        )}
      </div>

      <div class="section-title">
        <h2>{T.world.journal}</h2>
      </div>
      <div class="card">
        {g.journal.length ? (
          g.journal
            .slice(-30)
            .reverse()
            .map((j) => (
              <div class="journal-entry" key={`${j.at}-${j.day}`}>
                <div class="jd">
                  <span class="num">{j.day.split('-').reverse().join('.')}</span>
                  {j.q ? ` · ${j.q}` : ''}
                </div>
                <div>{j.text}</div>
              </div>
            ))
        ) : (
          <p class="muted" style={{ margin: 0 }}>
            {T.world.journalEmpty}
          </p>
        )}
      </div>
    </section>
  );
}
