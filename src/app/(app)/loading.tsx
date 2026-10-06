// Skeleton shown while any app page streams in — never a blank screen.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="טוען" className="animate-fade-up">
      <div className="mb-5 flex items-center gap-4">
        <div className="skeleton size-16" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-6 w-40" />
        </div>
      </div>
      <div className="skeleton mb-8 h-3 w-full" />
      <div className="skeleton mb-3 h-5 w-32" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton mb-2.5 h-20 w-full" />
      ))}
      <div className="skeleton mt-6 h-40 w-full" />
    </div>
  );
}
