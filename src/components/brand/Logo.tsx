// Three rising chevrons over one XP bar — the brand mark.

export function Chevrons({ size = 56, animated = false, className = "" }: { size?: number; animated?: boolean; className?: string }) {
  // Widest chevron on top, as in the brand book logo.
  const rows = [
    { w: 1, opacity: 1 },
    { w: 0.72, opacity: animated ? 0.65 : 1 },
    { w: 0.44, opacity: animated ? 0.35 : 1 },
  ];
  return (
    <div className={`flex flex-col items-center ${className}`} style={{ gap: size * 0.02 }} aria-hidden="true">
      {rows.map((row, i) => (
        <svg
          key={i}
          viewBox="0 0 70 20"
          width={size * row.w}
          height={(size * row.w * 20) / 70}
          className={animated ? "animate-chevron" : undefined}
          style={{ opacity: row.opacity, animationDelay: animated ? `${i * 0.25}s` : undefined }}
        >
          <polyline points="5,18 35,4 65,18" fill="none" stroke="#D9A441" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ))}
    </div>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-wide text-cream ${className}`} dir="ltr">
      THE QUEST
    </span>
  );
}

export function LogoLockup({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const chevron = { sm: 22, md: 48, lg: 72 }[size];
  const text = { sm: "text-lg", md: "text-3xl", lg: "text-5xl" }[size];
  if (size === "sm") {
    return (
      <span className="inline-flex items-center gap-2" aria-label="The Quest">
        <Chevrons size={chevron} />
        <Wordmark className={text} />
      </span>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4" aria-label="The Quest">
      <Chevrons size={chevron} animated={size === "lg"} />
      <Wordmark className={text} />
    </div>
  );
}
