"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Chevrons } from "@/components/brand/Logo";
import { DomainIcon } from "@/components/brand/icons";
import { Button, FormError, inputClass } from "@/components/ui";
import { DOMAINS, DOMAIN_INFO, domainLabel, type Domain } from "@/lib/game/domains";
import type { ChatMessage, GoalDraft } from "@/lib/ai/quest";

const MAX_GOALS = 4;
type Phase = "vision" | "chat" | "quick" | "review" | "building";

const VISION_LINES = [
  "קח/י נשימה עמוקה. ועוד אחת.",
  "דמיין/י את עצמך בעוד שנה מהיום — אחרי שנה שבה באמת שיחקת.",
  "איך את/ה נראה? איך זה מרגיש לקום בבוקר?",
  "מה את/ה עושה אחרת? במה את/ה הכי גאה?",
  "החזק/י את התמונה הזו. עכשיו נהפוך אותה למשימות.",
];

const GREETING = "מה ראית? ספר/י לי על הגרסה שלך בעוד שנה — מה השתנה בגוף, בכיוון, בראש?";

const emptyGoal = (): GoalDraft => ({ domain: "health", custom_label: null, title: "", baseline: "", target: "" });

export function QuestSetup(props: {
  name: string;
  aiEnabled: boolean;
  initialMessages: ChatMessage[];
  initialGoals: GoalDraft[];
  initialReady: boolean;
  isRedo: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(
    props.initialMessages.length > 0 ? "chat" : props.aiEnabled ? "vision" : "quick",
  );
  const [messages, setMessages] = useState<ChatMessage[]>(props.initialMessages);
  const [goals, setGoals] = useState<GoalDraft[]>(props.initialGoals.length ? props.initialGoals : []);
  const [ready, setReady] = useState(props.initialReady);
  const [error, setError] = useState<string | null>(null);

  async function buildQuest(finalGoals: GoalDraft[]) {
    setPhase("building");
    setError(null);
    const res = await fetch("/api/onboarding/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goals: finalGoals }),
    }).catch(() => null);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setError(data?.error ?? "לא הצלחנו לבנות את המסע. נסה/י שוב.");
      setPhase("review");
      return;
    }
    router.push(props.isRedo ? "/dashboard" : "/onboarding/character");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pt-6 pb-4">
      <header className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold tracking-[0.2em] text-amber">שלב 2 מתוך 3</p>
        <Chevrons size={26} />
      </header>

      {phase === "vision" && <Vision onDone={() => setPhase("chat")} />}

      {phase === "chat" && (
        <Chat
          messages={messages}
          goals={goals}
          ready={ready}
          onUpdate={(m, g, r) => {
            setMessages(m);
            setGoals(g);
            setReady(r);
          }}
          onAiDown={() => {
            setError("שיחת ה-AI לא זמינה כרגע — אפשר להגדיר את המטרות ידנית.");
            setGoals((g) => (g.length ? g : [emptyGoal()]));
            setPhase("quick");
          }}
          onContinue={() => setPhase("review")}
          onQuick={() => {
            setGoals((g) => (g.length ? g : [emptyGoal()]));
            setPhase("quick");
          }}
        />
      )}

      {(phase === "quick" || phase === "review") && (
        <GoalEditor
          title={phase === "quick" ? "הגדרה מהירה של המטרות" : "המטרות שלך"}
          goals={goals.length ? goals : [emptyGoal()]}
          error={error}
          onChange={setGoals}
          onSubmit={(g) => buildQuest(g)}
          onBackToChat={props.aiEnabled ? () => setPhase("chat") : undefined}
        />
      )}

      {phase === "building" && <Building />}
    </main>
  );
}

function Vision({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const last = index === VISION_LINES.length - 1;
  useEffect(() => {
    if (last) return;
    const t = setTimeout(() => setIndex((i) => i + 1), 3800);
    return () => clearTimeout(t);
  }, [index, last]);

  return (
    <section className="flex flex-1 flex-col items-center justify-center text-center" aria-live="polite">
      <div className="mb-10 size-28 animate-[pulse_4s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,rgba(217,164,65,0.35),transparent_70%)]" aria-hidden="true" />
      <p key={index} className="max-w-xs animate-fade-up text-xl leading-9 text-cream">
        {VISION_LINES[index]}
      </p>
      <div className="mt-12 flex w-full max-w-xs flex-col gap-3">
        {last ? (
          <Button onClick={onDone}>בוא/י נתחיל</Button>
        ) : (
          <Button variant="ghost" onClick={onDone}>
            דלג/י
          </Button>
        )}
      </div>
    </section>
  );
}

function GoalChips({ goals }: { goals: GoalDraft[] }) {
  if (!goals.length) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2" aria-label="המטרות עד עכשיו">
      {goals.map((g, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-card-raised px-3 py-1 text-xs">
          <DomainIcon domain={g.domain} size={14} />
          {g.title}
        </span>
      ))}
      <span className="self-center text-xs text-muted" dir="ltr">
        {goals.length}/{MAX_GOALS}
      </span>
    </div>
  );
}

function Chat(props: {
  messages: ChatMessage[];
  goals: GoalDraft[];
  ready: boolean;
  onUpdate: (m: ChatMessage[], g: GoalDraft[], ready: boolean) => void;
  onAiDown: () => void;
  onContinue: () => void;
  onQuick: () => void;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [props.messages.length, pending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || pending) return;
    setPending(true);
    setError(null);
    const optimistic: ChatMessage[] = [...props.messages, { role: "user", content: message }];
    props.onUpdate(optimistic, props.goals, props.ready);
    setText("");

    const res = await fetch("/api/onboarding/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    }).catch(() => null);
    setPending(false);

    if (!res || !res.ok) {
      const data = await res?.json().catch(() => null);
      if (res?.status === 503) return props.onAiDown();
      props.onUpdate(props.messages, props.goals, props.ready);
      setText(message);
      setError(data?.error ?? "ההודעה לא נשלחה — בדוק/י את החיבור ונסה/י שוב.");
      return;
    }
    const data = (await res.json()) as { reply: string; goals: GoalDraft[]; ready: boolean };
    props.onUpdate([...optimistic, { role: "assistant", content: data.reply }], data.goals, data.ready);
  }

  return (
    <section className="flex flex-1 flex-col">
      <GoalChips goals={props.goals} />
      <div className="flex-1 space-y-3 overflow-y-auto pb-4" aria-live="polite">
        <Bubble role="assistant" content={GREETING} />
        {props.messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}
        {pending && (
          <div className="flex gap-1 px-2 py-3" aria-label="המדריך מקליד">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 animate-bounce rounded-full bg-amber" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <FormError message={error} />

      {(props.ready || props.goals.length > 0) && (
        <Button onClick={props.onContinue} className="mb-3" variant={props.ready ? "primary" : "secondary"}>
          {props.ready ? "יוצאים לדרך ←" : "סיימתי — להמשיך עם המטרות האלה"}
        </Button>
      )}

      <form onSubmit={send} className="sticky bottom-0 flex gap-2 bg-ink pt-2 pb-[env(safe-area-inset-bottom)]">
        <label htmlFor="chat-input" className="sr-only">
          ההודעה שלך
        </label>
        <textarea
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="כתוב/י כאן..."
          className={`${inputClass} resize-none py-3`}
        />
        <Button type="submit" disabled={pending || !text.trim()} aria-label="שליחה" className="px-4">
          שלח
        </Button>
      </form>
      <button type="button" onClick={props.onQuick} className="mt-2 self-center text-xs text-muted underline">
        מעדיף/ה להגדיר מטרות בלי שיחה
      </button>
    </section>
  );
}

function Bubble({ role, content }: ChatMessage) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 leading-7 ${
          mine ? "rounded-bl-sm bg-card-raised text-cream" : "rounded-br-sm border border-line bg-card text-body"
        }`}
      >
        {content}
      </p>
    </div>
  );
}

function GoalEditor(props: {
  title: string;
  goals: GoalDraft[];
  error: string | null;
  onChange: (g: GoalDraft[]) => void;
  onSubmit: (g: GoalDraft[]) => void;
  onBackToChat?: () => void;
}) {
  const [goals, setLocal] = useState<GoalDraft[]>(props.goals);
  const update = (next: GoalDraft[]) => {
    setLocal(next);
    props.onChange(next);
  };
  const set = (i: number, patch: Partial<GoalDraft>) => update(goals.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const valid = goals.filter((g) => g.title.trim());

  return (
    <section className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-black">{props.title}</h1>
        <p className="mt-1 text-sm text-muted">עד {MAX_GOALS} מטרות. לכל אחת: איפה את/ה היום ולאן רוצה להגיע.</p>
      </div>

      {goals.map((goal, i) => (
        <fieldset key={i} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
          <legend className="sr-only">מטרה {i + 1}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="תחום">
            {DOMAINS.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={goal.domain === d}
                onClick={() => set(i, { domain: d as Domain })}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs transition ${
                  goal.domain === d ? "border-amber bg-amber/10 text-cream" : "border-line-strong text-muted"
                } ${d === "personal" ? "border-dashed" : ""}`}
              >
                <DomainIcon domain={d} size={16} />
                {DOMAIN_INFO[d].label}
              </button>
            ))}
          </div>
          {goal.domain === "personal" && (
            <input
              aria-label="שם התחום האישי"
              placeholder="שם התחום (למשל: גיטרה)"
              value={goal.custom_label ?? ""}
              maxLength={40}
              onChange={(e) => set(i, { custom_label: e.target.value })}
              className={inputClass}
            />
          )}
          <input aria-label="המטרה" placeholder="המטרה — למשל: לרוץ 10 ק״מ" value={goal.title} maxLength={140} onChange={(e) => set(i, { title: e.target.value })} className={inputClass} />
          <input aria-label="איפה אני היום" placeholder="איפה אני היום — למשל: לא רץ בכלל" value={goal.baseline} maxLength={280} onChange={(e) => set(i, { baseline: e.target.value })} className={inputClass} />
          <input aria-label="לאן אני רוצה להגיע" placeholder="היעד — למשל: 10 ק״מ תוך 4 חודשים" value={goal.target} maxLength={280} onChange={(e) => set(i, { target: e.target.value })} className={inputClass} />
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              <DomainIcon domain={goal.domain} size={14} className="me-1 inline" />
              {domainLabel(goal.domain, goal.custom_label)}
            </span>
            {goals.length > 1 && (
              <button type="button" className="min-h-10 px-2 text-danger" onClick={() => update(goals.filter((_, j) => j !== i))}>
                הסרה
              </button>
            )}
          </div>
        </fieldset>
      ))}

      {goals.length < MAX_GOALS && (
        <Button variant="secondary" className="border-dashed" onClick={() => update([...goals, emptyGoal()])}>
          + מטרה נוספת
        </Button>
      )}

      <FormError message={props.error} />

      <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-ink pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button disabled={valid.length === 0} onClick={() => props.onSubmit(valid)}>
          בנו לי את המסע
        </Button>
        {props.onBackToChat && (
          <Button variant="ghost" onClick={props.onBackToChat}>
            חזרה לשיחה
          </Button>
        )}
      </div>
    </section>
  );
}

function Building() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center text-center" role="status">
      <Chevrons size={80} animated />
      <h2 className="mt-8 text-2xl font-black">בונים את המסע שלך</h2>
      <p className="mt-2 max-w-xs text-sm leading-6 text-muted">מתרגמים את המטרות למשימות יומיות, שבועיות — ועוד כמה הפתעות.</p>
      <div className="mt-8 h-2.5 w-56 overflow-hidden rounded-md border-[1.5px] border-line-strong">
        <div className="skeleton h-full !rounded-none" />
      </div>
    </section>
  );
}
