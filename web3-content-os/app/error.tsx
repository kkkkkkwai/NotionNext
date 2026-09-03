'use client'
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const msg = error.message || ''
  const translationHint = /removeChild|insertBefore|not a child of this node/.test(msg)
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-danger">出错了</div>
      <p className="mt-2 max-w-lg break-words text-[13px] text-fg-muted">{msg}</p>
      {translationHint ? <p className="mt-2 max-w-lg text-[13px] text-warn">看起来是浏览器翻译插件修改了页面导致的，请关闭网页翻译后刷新。</p> : null}
      <button onClick={reset} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-text">重试</button>
    </div>
  )
}
