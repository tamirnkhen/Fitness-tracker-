"use client";
import { useActionState, useState } from "react";
import { Button, FormError, inputClass } from "@/components/ui";
import { deleteAccount, type DeleteState } from "./actions";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, undefined);

  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)} className="w-full">
        מחיקת החשבון
      </Button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <p className="text-sm leading-6 text-body">
        זה ימחק לצמיתות את החשבון, המטרות, ההיסטוריה, ה-XP, התמונה המקורית והדמות. אי אפשר לשחזר. כדי לאשר, כתוב/י <strong>מחיקה</strong>.
      </p>
      <label htmlFor="confirm" className="sr-only">
        אישור מחיקה
      </label>
      <input id="confirm" name="confirm" autoComplete="off" className={inputClass} />
      <FormError message={state?.error} />
      <div className="flex gap-2">
        <Button type="submit" variant="danger" disabled={pending} className="flex-1">
          {pending ? "מוחקים..." : "מחיקה לצמיתות"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          ביטול
        </Button>
      </div>
    </form>
  );
}
