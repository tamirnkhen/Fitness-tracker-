"use client";
import { useState } from "react";
import { DomainIcon } from "@/components/brand/icons";
import { Button, FormError, inputClass } from "@/components/ui";
import { DOMAINS, DOMAIN_INFO, type Domain } from "@/lib/game/domains";
import type { Task } from "@/lib/types";

export function AddTaskSheet({ onAdded }: { onAdded: (task: Task) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [domain, setDomain] = useState<Domain | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/tasks/manual", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, domain }),
    }).catch(() => null);
    setPending(false);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setError(data?.error ?? "אין חיבור — נסה/י שוב");
      return;
    }
    onAdded(data.task as Task);
    setText("");
    setDomain(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong text-sm text-muted transition hover:border-amber hover:text-cream"
      >
        <DomainIcon domain="personal" size={20} /> משימה אישית
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-dashed border-amber-dim bg-card p-4">
      <label htmlFor="manual-task" className="text-sm font-medium">
        מה את/ה הולך/ת לעשות היום?
      </label>
      <textarea
        id="manual-task"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        minLength={3}
        maxLength={200}
        rows={2}
        placeholder="למשל: לנגן חצי שעה בגיטרה"
        className={`${inputClass} resize-none py-3`}
      />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="תחום (לא חובה)">
        {DOMAINS.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={domain === d}
            onClick={() => setDomain(domain === d ? null : d)}
            className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-xs ${domain === d ? "border-amber text-cream" : "border-line-strong text-muted"}`}
          >
            <DomainIcon domain={d} size={14} /> {DOMAIN_INFO[d].label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">ה-AI יקבע את הניקוד (‎+2 עד ‎+10) לפי המאמץ.</p>
      <FormError message={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || text.trim().length < 3} className="flex-1">
          {pending ? "מחשבים ניקוד..." : "הוספה"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          ביטול
        </Button>
      </div>
    </form>
  );
}
