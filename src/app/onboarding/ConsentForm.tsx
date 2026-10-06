"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, FormError, inputClass } from "@/components/ui";
import { acceptConsent, type ConsentState } from "./actions";

export function ConsentForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState<ConsentState, FormData>(acceptConsent, undefined);
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="איך לקרוא לך?" htmlFor="display_name">
        <input id="display_name" name="display_name" defaultValue={defaultName} required maxLength={60} className={inputClass} />
      </Field>
      <Field label="תאריך לידה" htmlFor="birth_date" hint="The Quest מיועדת לבני 18 ומעלה. משמש רק לאימות גיל.">
        <input id="birth_date" name="birth_date" type="date" required className={inputClass} dir="ltr" />
      </Field>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-card p-4 text-sm leading-6 text-body">
        <input type="checkbox" name="accept_terms" required className="mt-1 size-5 shrink-0 accent-amber" />
        <span>
          קראתי ואני מסכים/ה ל
          <Link href="/terms" target="_blank" className="text-amber underline">
            תנאי השימוש
          </Link>{" "}
          ול
          <Link href="/privacy" target="_blank" className="text-amber underline">
            מדיניות הפרטיות
          </Link>
          . (הסכמה לשימוש בתמונה תתבקש בנפרד, רק אם תבחר/י ליצור דמות.)
        </span>
      </label>
      <FormError message={state?.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "רגע..." : "המשך"}
      </Button>
    </form>
  );
}
