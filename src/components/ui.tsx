import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const buttonClass = {
  primary:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber px-5 font-bold text-ink transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-card px-5 font-medium text-cream transition hover:border-amber active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-muted transition hover:text-cream disabled:opacity-50",
  danger:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-danger/60 px-5 font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50",
};

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: keyof typeof buttonClass }) {
  return <button className={`${buttonClass[variant]} ${className}`} {...props} />;
}

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: keyof typeof buttonClass }) {
  return <Link className={`${buttonClass[variant]} ${className}`} {...props} />;
}

export function Card({ className = "", children, ...props }: ComponentProps<"section">) {
  return (
    <section className={`rounded-2xl border border-line bg-card p-5 ${className}`} {...props}>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-1 text-xs font-semibold tracking-[0.2em] text-amber uppercase">{children}</p>;
}

export const inputClass =
  "w-full min-h-12 rounded-xl border border-line-strong bg-ink px-4 text-cream placeholder:text-muted/80 focus:border-amber focus:outline-none";

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-body">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-cream">
      {message}
    </p>
  );
}

export function LegalDraftNotice() {
  return (
    <div role="note" className="rounded-xl border border-amber-dim bg-[#1e1812] px-4 py-3 text-sm text-[#D9C9A8]">
      <strong className="text-amber">טיוטה — טרם אושר משפטית.</strong> המסמך נכתב כטיוטה ראשונית ויש לבדוק אותו עם עורך/ת דין לפני
      פתיחת האפליקציה למשתמשים אמיתיים.
    </div>
  );
}
