'use client'
import * as React from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Toast = { id: number; title: string; description?: string; tone: 'success' | 'error' | 'info' }
const Ctx = React.createContext<{ push: (t: Omit<Toast, 'id'>) => void } | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const push = React.useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    setToasts((xs) => [...xs, { ...t, id }])
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), t.tone === 'error' ? 7000 : 4000)
  }, [])
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={cn('pointer-events-auto flex items-start gap-3 rounded-xl border bg-bg-soft/95 px-4 py-3 shadow-soft backdrop-blur animate-fade-in', t.tone === 'error' ? 'border-danger/40' : t.tone === 'success' ? 'border-primary/40' : 'border-line')}>
            {t.tone === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" /> : t.tone === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 text-danger" /> : <Info className="mt-0.5 h-4 w-4 text-fg-muted" />}
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-fg">{t.title}</div>
              {t.description ? <div className="mt-0.5 break-words text-xs text-fg-muted">{t.description}</div> : null}
            </div>
            <button onClick={() => setToasts((xs) => xs.filter((x) => x.id !== t.id))} className="text-fg-dim hover:text-fg"><X className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  const push = ctx.push
  return React.useMemo(() => ({
    success: (title: string, description?: string) => push({ title, description, tone: 'success' }),
    error: (title: string, description?: string) => push({ title, description, tone: 'error' }),
    info: (title: string, description?: string) => push({ title, description, tone: 'info' })
  }), [push])
}
