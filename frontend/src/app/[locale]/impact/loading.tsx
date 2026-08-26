export default function ImpactLoading() {
  return (
    <main className="mx-auto max-w-lg px-5 py-6 animate-pulse">
      <div className="h-9 w-32 rounded-md bg-foreground/10 mb-4" />
      <div className="h-7 w-48 rounded-md bg-foreground/15" />
      <div className="mt-2 h-4 w-72 rounded-md bg-foreground/10" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-foreground/5" />
        ))}
      </div>
      <div className="mt-3 h-24 rounded-2xl bg-foreground/5" />
    </main>
  );
}
