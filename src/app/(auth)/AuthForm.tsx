"use client";
import { useActionState } from "react";
import { Button, Field, FormError, inputClass } from "@/components/ui";
import { signIn, signInWithGoogle, signUp, type AuthState } from "./actions";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.9 35 44 30 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, undefined);

  if (state?.info) {
    return (
      <p role="status" className="rounded-xl border border-amber-dim bg-card p-5 leading-7 text-body">
        {state.info}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        <Button type="submit" variant="secondary" className="w-full">
          <GoogleMark /> המשך עם Google
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> או עם אימייל <span className="h-px flex-1 bg-line" />
      </div>

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        {mode === "signup" && (
          <Field label="איך לקרוא לך?" htmlFor="display_name">
            <input id="display_name" name="display_name" required maxLength={60} autoComplete="nickname" className={inputClass} />
          </Field>
        )}
        <Field label="אימייל" htmlFor="email">
          <input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className={inputClass} />
        </Field>
        <Field label="סיסמה" htmlFor="password" hint={mode === "signup" ? "לפחות 8 תווים" : undefined}>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            dir="ltr"
            className={inputClass}
          />
        </Field>
        <FormError message={state?.error} />
        <Button type="submit" disabled={pending}>
          {pending ? "רגע..." : mode === "login" ? "כניסה" : "יצירת חשבון"}
        </Button>
      </form>
    </div>
  );
}
