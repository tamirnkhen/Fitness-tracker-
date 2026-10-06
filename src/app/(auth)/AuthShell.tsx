import Link from "next/link";
import type { ReactNode } from "react";
import { LogoLockup } from "@/components/brand/Logo";

export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-10 self-center" aria-label="חזרה לדף הבית">
        <LogoLockup size="md" />
      </Link>
      <h1 className="mb-6 text-2xl font-black">{title}</h1>
      {children}
      <div className="mt-8 text-center text-sm text-muted">{footer}</div>
    </main>
  );
}
