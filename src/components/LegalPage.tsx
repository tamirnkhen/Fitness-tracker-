import Link from "next/link";
import type { ReactNode } from "react";
import { LogoLockup } from "@/components/brand/Logo";
import { LegalDraftNotice } from "@/components/ui";
import { TERMS_VERSION } from "@/lib/env";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/" className="mb-8 inline-block" aria-label="דף הבית">
        <LogoLockup size="sm" />
      </Link>
      <h1 className="mb-2 text-3xl font-black">{title}</h1>
      <p className="mb-6 text-xs text-muted" dir="ltr">
        Version {TERMS_VERSION}
      </p>
      <LegalDraftNotice />
      <article className="mt-8 space-y-6 leading-7 text-body [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-cream [&_li]:ms-5 [&_li]:list-disc">
        {children}
      </article>
    </main>
  );
}
