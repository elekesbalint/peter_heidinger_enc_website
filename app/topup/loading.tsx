export default function TopupLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
      <div className="mt-6 h-9 w-2/3 max-w-lg animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-100" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}
