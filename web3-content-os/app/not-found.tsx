import Link from 'next/link'
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">404</div>
      <h1 className="mt-1 text-xl font-semibold text-fg">Page not found</h1>
      <Link href="/dashboard" className="mt-4 text-[13px] text-primary hover:underline">Back to dashboard</Link>
    </div>
  )
}
