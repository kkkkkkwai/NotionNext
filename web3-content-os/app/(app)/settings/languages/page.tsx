import { Card, CardHeader, PageHeader, Badge } from '@/components/ui/primitives'
import { LANGUAGES } from '@/lib/services/content'

export const metadata = { title: '语言' }

export default function LanguagesSettings() {
  return (
    <div>
      <PageHeader eyebrow="设置" title="语言" description="本地化是母语级改写而非逐字翻译：Web3 术语、品牌语调、项目事实与平台风格都会被完整保留。" />
      <Card>
        <CardHeader title="支持的语言" description="可在内容生成、AI 编辑器（翻译）和上线内容包中使用" />
        <ul className="grid gap-px sm:grid-cols-2">{LANGUAGES.map((l) => <li key={l.code} className="flex items-center gap-3 px-5 py-3 text-[13px]"><Badge>{l.code}</Badge><span className="text-fg">{l.native}</span><span className="text-fg-dim">{l.label}</span></li>)}</ul>
      </Card>
      <p className="mt-3 text-[12.5px] text-fg-dim">翻译使用 AI 路由中的「翻译」任务——将其指向多语言能力强的模型可获得最佳效果。</p>
    </div>
  )
}
