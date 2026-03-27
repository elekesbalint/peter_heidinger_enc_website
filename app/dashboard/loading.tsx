export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
      </div>
      <div className="mt-8 h-24 animate-pulse rounded-2xl bg-slate-100" />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}
