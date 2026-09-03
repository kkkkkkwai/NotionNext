'use client'
import * as React from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title?: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!mounted || !open) return null
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn('card flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-bg-soft animate-fade-in sm:rounded-2xl', sizes[size])} role="dialog" aria-modal>
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              {title ? <h2 className="text-[15px] font-semibold text-fg">{title}</h2> : null}
              {description ? <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p> : null}
            </div>
            <button onClick={onClose} className="rounded-lg p-1 text-fg-muted hover:bg-white/[0.06] hover:text-fg" aria-label="关闭"><X className="h-4 w-4" /></button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = '确认', danger }: { open: boolean; onClose: () => void; onConfirm: () => void | Promise<void>; title: string; description?: string; confirmLabel?: string; danger?: boolean }) {
  const [loading, setLoading] = React.useState(false)
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="sm" footer={
      <>
        <button className="rounded-xl px-3 py-2 text-sm text-fg-muted hover:text-fg" onClick={onClose}>取消</button>
        <button className={cn('rounded-xl px-3 py-2 text-sm font-medium', danger ? 'bg-danger/20 text-danger hover:bg-danger/30' : 'bg-primary text-primary-text')} disabled={loading} onClick={async () => { setLoading(true); try { await onConfirm(); onClose() } finally { setLoading(false) } }}>{loading ? '处理中…' : confirmLabel}</button>
      </>
    }>
      <span className="sr-only">确认</span>
    </Dialog>
  )
}
