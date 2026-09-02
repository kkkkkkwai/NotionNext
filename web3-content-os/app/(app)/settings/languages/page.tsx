import { Card, CardHeader, PageHeader, Badge } from '@/components/ui/primitives'
import { LANGUAGES } from '@/lib/services/content'

export const metadata = { title: 'Languages' }

export default function LanguagesSettings() {
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Languages" description="Localisation is native rewriting, not literal translation: Web3 terminology, brand tone, project facts and platform style are preserved." />
      <Card>
        <CardHeader title="Supported languages" description="Available in the Content Generator, AI Editor (Translate) and Launch Kit" />
        <ul className="grid gap-px sm:grid-cols-2">{LANGUAGES.map((l) => <li key={l.code} className="flex items-center gap-3 px-5 py-3 text-[13px]"><Badge>{l.code}</Badge><span className="text-fg">{l.native}</span><span className="text-fg-dim">{l.label}</span></li>)}</ul>
      </Card>
      <p className="mt-3 text-[12.5px] text-fg-dim">Translation uses the “Translation” task in the AI Router — point it at a strong multilingual model for best results.</p>
    </div>
  )
}
