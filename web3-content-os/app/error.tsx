'use client'
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-danger">Something went wrong</div>
      <p className="mt-2 max-w-lg break-words text-[13px] text-fg-muted">{error.message}</p>
      <button onClick={reset} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-text">Try again</button>
    </div>
  )
}
