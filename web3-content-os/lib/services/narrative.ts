import { desc, eq } from 'drizzle-orm'
import { getDb, schema } from '../db'
import { runJson } from '../ai'
import { GLOBAL_SYSTEM_PROMPT } from '../prompts/system'
import { getLatestDna, renderDna, type DnaData } from './dna'
import { listFacts, renderFacts } from './facts'
import { getProject, touchProject } from './projects'
import { searchKnowledge } from './knowledge'

export interface NarrativeData {
  chain: { stage: string; text: string }[]
  core_narrative: string
  investor_narrative: string
  community_narrative: string
  institutional_narrative: string
  user_narrative: string
  technical_narrative: string
  primary_themes: { title: string; description: string }[]
  secondary_themes: { theme: string; title: string; description: string }[]
  content_angles: { angle: string; theme: string; format: string }[]
}

export async function getLatestNarrative(projectId: string) {
  const db = await getDb()
  return db.query.narratives.findFirst({ where: eq(schema.narratives.projectId, projectId), orderBy: desc(schema.narratives.version) })
}

export async function generateNarrative(ctx: { orgId: string; projectId: string; userId?: string | null }, opts: { language?: string } = {}) {
  const project = await getProject(ctx.orgId, ctx.projectId)
  if (!project) throw new Error('项目不存在')
  const [dna, facts] = await Promise.all([getLatestDna(ctx.projectId), listFacts(ctx.projectId)])
  if (!dna) throw new Error('请先生成项目 DNA，叙事引擎需要基于 DNA 构建。')
  const hits = await searchKnowledge(ctx.orgId, ctx.projectId, 'market trend industry problem why now ecosystem growth token value', 6)
  const lang = opts.language || 'Chinese (Simplified), keeping tickers and Web3 terms as-is'
  const { data, model } = await runJson<NarrativeData>({ ...ctx, taskType: 'narrative' }, {
    messages: [
      { role: 'system', content: GLOBAL_SYSTEM_PROMPT },
      { role: 'user', content: `You are building the NARRATIVE SYSTEM for the Web3 project "${project.name}".

PROJECT DNA:\n${renderDna(dna.data as DnaData)}\n\nPROJECT FACTS:\n${renderFacts(facts) || '(none)'}\n\nKNOWLEDGE EXCERPTS:\n${hits.map((h) => `[${h.sourceName}] ${h.content}`).join('\n\n').slice(0, 12000)}

Return JSON:
{
 "chain": [{"stage":"Industry Trend","text":"..."},{"stage":"Market Shift","text":"..."},{"stage":"User Need","text":"..."},{"stage":"Industry Problem","text":"..."},{"stage":"Why This Project Exists","text":"..."},{"stage":"Solution","text":"..."},{"stage":"Ecosystem Growth Logic","text":"..."},{"stage":"Token Value Capture","text":"..."},{"stage":"Future Vision","text":"..."}],
 "core_narrative": "300-500 words",
 "investor_narrative": "200-300 words — market size, moat, value capture, traction (only known facts)",
 "community_narrative": "150-250 words — belonging, participation, why join now",
 "institutional_narrative": "150-250 words — compliance-safe, infrastructure framing",
 "user_narrative": "150-250 words — practical benefits",
 "technical_narrative": "150-250 words — architecture & differentiation",
 "primary_themes": [5 items {"title","description"}],
 "secondary_themes": [20 items {"theme":"primary theme title","title","description"}],
 "content_angles": [50 items {"angle":"one-line hook","theme":"primary theme title","format":"tweet|thread|poster|video|article|ama"}]
}
Write in ${lang}. No fabricated numbers, partners, or exchanges — use [Missing: ...] placeholders where facts are absent.` }
    ],
    maxTokens: 12000, temperature: 0.6
  }, null as unknown as NarrativeData)
  if (!data || !data.core_narrative) throw new Error('模型没有返回有效的叙事结果，请重试。')
  const db = await getDb()
  const latest = await getLatestNarrative(ctx.projectId)
  const [row] = await db.insert(schema.narratives).values({ projectId: ctx.projectId, version: (latest?.version ?? 0) + 1, data: data as unknown as Record<string, unknown>, model }).returning()
  await touchProject(ctx.projectId)
  return row
}
