'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Link2, FileText, ArrowRight, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Field, Card, Select } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { api, errorMessage } from '@/lib/client'

const INDUSTRIES = ['DeFi', 'DePIN', 'AI', 'Infrastructure / L1 / L2', 'GameFi', 'SocialFi', 'RWA', 'NFT', 'Wallet / Payments', 'Exchange', 'Meme', 'Other']
const INDUSTRY_LABELS: Record<string, string> = { 'Infrastructure / L1 / L2': '基础设施 / L1 / L2', 'Wallet / Payments': '钱包 / 支付', Exchange: '交易所', Other: '其他' }

export function NewProjectWizard() {
  const router = useRouter()
  const toast = useToast()
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', idea: '', slogan: '', website: '', twitter: '', telegram: '', discord: '', industry: '', positioning: '', tokenName: '', tokenSymbol: '', launchDate: '' })
  const [files, setFiles] = useState<File[]>([])
  const [urls, setUrls] = useState<string[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [extra, setExtra] = useState('')
  const [autoDna, setAutoDna] = useState(true)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const addUrl = () => {
    const u = urlInput.trim()
    if (!u) return
    setUrls((x) => Array.from(new Set([...x, u])))
    setUrlInput('')
  }

  const submit = async () => {
    if (!form.name.trim()) return toast.error('请填写项目名称')
    setLoading(true)
    try {
      const { project } = await api<{ project: { id: string } }>('/api/projects', { method: 'POST', json: form })
      const sourceIds: string[] = []
      if (files.length) {
        const fd = new FormData()
        files.forEach((f) => fd.append('files', f))
        const r = await api<{ sources: { id: string }[] }>(`/api/projects/${project.id}/sources`, { method: 'POST', body: fd })
        sourceIds.push(...r.sources.map((s) => s.id))
      }
      for (const u of urls) {
        const r = await api<{ sources: { id: string }[] }>(`/api/projects/${project.id}/sources`, { method: 'POST', json: { url: u } })
        sourceIds.push(...r.sources.map((s) => s.id))
      }
      const notes = [form.idea.trim() ? `PROJECT IDEA (from founder):\n${form.idea.trim()}` : '', extra.trim() ? `ADDITIONAL INFORMATION:\n${extra.trim()}` : ''].filter(Boolean).join('\n\n')
      if (notes) {
        const r = await api<{ sources: { id: string }[] }>(`/api/projects/${project.id}/sources`, { method: 'POST', json: { text: notes, name: '创始人笔记' } })
        sourceIds.push(...r.sources.map((s) => s.id))
      }
      if (sourceIds.length) {
        try {
          const { job } = await api<{ job: { id: string } }>(`/api/projects/${project.id}/ingest`, { method: 'POST', json: { sourceIds, generateDna: autoDna } })
          router.push(`/projects/${project.id}?job=${job.id}`)
        } catch (e) {
          toast.error('项目已创建，但 AI 阅读未能启动', errorMessage(e))
          router.push(`/projects/${project.id}`)
        }
      } else router.push(`/projects/${project.id}`)
      router.refresh()
    } catch (e) {
      toast.error('无法创建项目', errorMessage(e))
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">新建项目</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg">项目只需要讲一次。</h1>
        <p className="mt-1 text-[13.5px] text-fg-muted">只需一个名字和一段介绍。上传白皮书 / PPT 或贴上官网，AI 会自己读资料、提取事实、构建项目 DNA，其余字段都不用填。</p>
      </div>
      <Card className="space-y-5 p-5">
        <Field label="项目名称 *"><Input value={form.name} onChange={set('name')} placeholder="例如：TOKI Network" autoFocus /></Field>
        <Field label="用你自己的话介绍这个项目" hint="想到什么写什么：做什么、给谁用、为什么是现在、Token 怎么运作、有哪些进展。越具体，AI 越懂你。"><Textarea rows={7} value={form.idea} onChange={set('idea')} placeholder="例如：我们在做一个 DePIN 网络，让闲置的 GPU 变成可验证的算力节点，用 TOKI 奖励在线时长……" /></Field>
        <div>
          <div className="label">项目资料（可选，强烈推荐）</div>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line px-4 py-6 text-center transition hover:border-primary/50 hover:bg-primary/[0.03]">
            <Upload className="mb-2 h-5 w-5 text-fg-muted" />
            <div className="text-[13px] text-fg">拖拽文件到此处，或点击上传</div>
            <div className="mt-1 text-[12px] text-fg-dim">白皮书 · 路演 PPT · 代币经济文档 · 任何 PDF / Word / PPT / TXT / Markdown</div>
            <input type="file" multiple accept=".pdf,.docx,.pptx,.txt,.md,.markdown" className="hidden" onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])} />
          </label>
          {files.length ? <ul className="mt-2 space-y-1">{files.map((f, i) => <li key={i} className="flex items-center justify-between rounded-lg border border-line px-3 py-1.5 text-[13px]"><span className="flex items-center gap-2 truncate"><FileText className="h-3.5 w-3.5 text-fg-muted" />{f.name}<span className="text-fg-dim">{(f.size / 1024).toFixed(0)} KB</span></span><button onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="text-fg-dim hover:text-danger"><X className="h-3.5 w-3.5" /></button></li>)}</ul> : null}
          <div className="mt-3 flex gap-2"><Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())} placeholder="官网 / GitBook / 文档链接，例如 https://docs.yourproject.xyz" /><Button variant="secondary" onClick={addUrl}><Link2 className="h-4 w-4" /> 添加</Button></div>
          {urls.length ? <ul className="mt-2 space-y-1">{urls.map((u) => <li key={u} className="flex items-center justify-between rounded-lg border border-line px-3 py-1.5 text-[13px]"><span className="truncate">{u}</span><button onClick={() => setUrls((x) => x.filter((y) => y !== u))} className="text-fg-dim hover:text-danger"><X className="h-3.5 w-3.5" /></button></li>)}</ul> : null}
        </div>
        <button type="button" onClick={() => setMore((v) => !v)} className="text-[12.5px] text-fg-muted hover:text-fg">{more ? '收起可选信息 ▴' : '补充可选信息（Token、官网、社媒、上线日期…）▾'}</button>
        {more ? (
          <div className="space-y-4 rounded-xl border border-line bg-white/[0.02] p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Token 符号"><Input value={form.tokenSymbol} onChange={set('tokenSymbol')} placeholder="TOKI" /></Field>
              <Field label="上线 / TGE 日期"><Input type="date" value={form.launchDate} onChange={set('launchDate')} /></Field>
              <Field label="行业"><Select value={form.industry} onChange={set('industry')}><option value="">请选择…</option>{INDUSTRIES.map((i) => <option key={i} value={i}>{INDUSTRY_LABELS[i] ?? i}</option>)}</Select></Field>
              <Field label="官网"><Input value={form.website} onChange={set('website')} placeholder="https://" /></Field>
              <Field label="Twitter / X"><Input value={form.twitter} onChange={set('twitter')} placeholder="@handle" /></Field>
              <Field label="Telegram"><Input value={form.telegram} onChange={set('telegram')} placeholder="t.me/…" /></Field>
            </div>
            <Field label="代币经济 / 融资 / 合作伙伴等补充文本" hint="直接粘贴即可，之后随时可在「知识库」补充。"><Textarea rows={4} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="总量 100 亿，TGE 定于 Q4… 已从 … 融资 $X… 合作伙伴：…" /></Field>
          </div>
        ) : null}
        <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-[13px]"><input type="checkbox" className="mt-0.5 accent-[#43FFB0]" checked={autoDna} onChange={(e) => setAutoDna(e.target.checked)} /><span><span className="flex items-center gap-1.5 font-medium text-fg"><Sparkles className="h-3.5 w-3.5 text-primary" /> 创建后立即让 AI 阅读资料并生成项目 DNA</span><span className="text-fg-muted">解析资料 → 构建知识库 → 提取项目事实 → 生成项目 DNA（需要已配置 AI 模型）。</span></span></label>
        <div className="flex justify-end"><Button size="lg" onClick={submit} loading={loading} disabled={!form.name.trim()}>创建项目并构建 AI 大脑 <ArrowRight className="h-4 w-4" /></Button></div>
      </Card>
    </div>
  )
}
