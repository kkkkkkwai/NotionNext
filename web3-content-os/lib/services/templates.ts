import { and, asc, eq, isNull, or } from 'drizzle-orm'
import { getDb, schema } from '../db'

export const TEMPLATE_CATEGORIES: { id: string; label: string; zh: string }[] = [
  { id: 'foundation', label: 'Foundation', zh: '基础资料' },
  { id: 'marketing', label: 'Marketing', zh: '营销文案' },
  { id: 'social', label: 'Social Media', zh: '社媒' },
  { id: 'poster', label: 'Poster Copy', zh: '海报文案' },
  { id: 'video', label: 'Video', zh: '视频脚本' },
  { id: 'community', label: 'Community', zh: '社区' },
  { id: 'pr', label: 'PR', zh: '公关稿' },
  { id: 'kol', label: 'KOL', zh: 'KOL' }
]

type T = { category: string; name: string; slug: string; contentType: string; objective: string; audience: string; platform?: string; tone: string; structure: string; length: string; requiredFacts?: string[]; optionalFacts?: string[]; promptInstructions: string; taskType?: string }

const F = (cat: string, name: string, slug: string, contentType: string, rest: Partial<T> & { promptInstructions: string; structure: string; length: string }): T => ({
  category: cat, name, slug, contentType, objective: rest.objective ?? '', audience: rest.audience ?? 'Web3 用户', platform: rest.platform, tone: rest.tone ?? '品牌语气（见项目 DNA）',
  structure: rest.structure, length: rest.length, requiredFacts: rest.requiredFacts ?? [], optionalFacts: rest.optionalFacts ?? [], promptInstructions: rest.promptInstructions, taskType: rest.taskType ?? 'content_fast'
})

export const SYSTEM_TEMPLATES: T[] = [
  // FOUNDATION
  F('foundation', '项目概述', 'foundation-project-overview', 'project_overview', { objective: 'Explain the project clearly to anyone', audience: 'Everyone', structure: 'Headline → What it is → Problem → Solution → Product → Token → Why now → Links', length: '400-600 words', taskType: 'content_quality', promptInstructions: 'Write a complete project overview in Markdown with short headers. Precise and factual. Mark unknowns as [Missing: …].' }),
  F('foundation', 'One Pager 一页纸', 'foundation-one-pager', 'one_pager', { objective: 'Single page summary for partners/investors', audience: 'Partners, investors', structure: 'Positioning · Problem · Solution · Product · Traction · Token · Team · Roadmap · Contact', length: '500-700 words', taskType: 'content_quality', promptInstructions: 'Produce a one-pager in Markdown with bold section labels and tight bullets. Include a "Key Facts" box.' }),
  F('foundation', 'Litepaper 轻白皮书', 'foundation-litepaper', 'litepaper', { objective: 'Concise technical + economic description', audience: 'Crypto-native readers', structure: 'Abstract · Background · Problem · Architecture · Product · Tokenomics · Roadmap · Team · Risks · Disclaimer', length: '1500-2500 words', taskType: 'long_form', promptInstructions: 'Write a litepaper in Markdown with numbered sections. Use tables for tokenomics when data exists. Include a standard non-financial-advice disclaimer.' }),
  F('foundation', '白皮书大纲与初稿', 'foundation-whitepaper', 'whitepaper', { objective: 'Full whitepaper draft', audience: 'Researchers, investors, builders', structure: '12-15 sections', length: '3000-5000 words', taskType: 'long_form', promptInstructions: 'Write a whitepaper draft in Markdown. Each section should be substantive; where facts are missing, insert [Missing: …] placeholders rather than invented content.' }),
  F('foundation', 'GitBook 文档结构', 'foundation-gitbook', 'gitbook', { objective: 'Documentation site structure with page drafts', audience: 'Users & developers', structure: 'Intro · Getting Started · Product · Tokenomics · Roadmap · FAQ · Links', length: '1500-2500 words', taskType: 'long_form', promptInstructions: 'Output a GitBook-style documentation tree, then draft each page briefly in Markdown.' }),
  F('foundation', '商业计划书', 'foundation-business-plan', 'business_plan', { objective: 'Commercial plan', audience: 'Investors, partners', structure: 'Executive Summary · Market · Product · Business Model · Go-to-market · Token · Financial logic · Team · Roadmap · Risks', length: '2000-3000 words', taskType: 'long_form', promptInstructions: 'Write a business plan in Markdown. Never invent revenue figures or user numbers.' }),
  F('foundation', 'Pitch Deck 文案（15 页）', 'foundation-pitch-deck', 'pitch_deck', { objective: 'Slide-by-slide copy', audience: 'Investors', structure: '15 slides: Title, Problem, Solution, Product, Why now, Market, Business model, Tokenomics, Traction, Competition, Team, Roadmap, Ask, Vision, Contact', length: '15 slides', taskType: 'content_quality', promptInstructions: 'For each slide output: Slide N — Title / Headline / 3-5 bullets / Speaker note (2 sentences).' }),
  F('foundation', 'FAQ（30 问）', 'foundation-faq', 'faq', { objective: 'Answer common questions', audience: 'Community & users', structure: '30 Q&A grouped: Project, Product, Token, Security, Community', length: '30 Q&A', taskType: 'content_quality', promptInstructions: 'Write 30 realistic questions with concise answers. Include a few hard questions (risks, competition, unlocks) answered honestly.' }),
  F('foundation', '路线图', 'foundation-roadmap', 'roadmap', { objective: 'Phased roadmap', audience: 'Community, investors', structure: 'Phases/quarters with milestones', length: '300-500 words', promptInstructions: 'Write a roadmap based strictly on known milestones; mark planned/unconfirmed items clearly.' }),
  F('foundation', '代币经济说明', 'foundation-tokenomics', 'tokenomics', { objective: 'Explain the token economy', audience: 'Holders, investors', structure: 'Overview · Supply · Allocation · Vesting · Utility · Value capture · Disclaimer', length: '500-800 words', requiredFacts: ['token_symbol', 'token_supply'], taskType: 'content_quality', promptInstructions: 'Explain tokenomics with a table for allocation if known. Never promise price appreciation.' }),
  // MARKETING
  F('marketing', '项目介绍', 'marketing-intro', 'project_intro', { objective: 'Persuasive introduction', structure: 'Hook · What · Why it matters · How it works · Token · CTA', length: '250-400 words', promptInstructions: 'Write a marketing introduction that is confident but factual.' }),
  F('marketing', '项目背景', 'marketing-background', 'project_background', { objective: 'Origin story & why now', structure: 'Trend · Problem · Insight · Founding · Today', length: '250-400 words', promptInstructions: 'Tell the background story with a clear "why now".' }),
  F('marketing', '项目优势', 'marketing-advantages', 'project_advantages', { objective: 'Top advantages', structure: '5-7 advantages with proof', length: '250-400 words', promptInstructions: 'List advantages each with a one-line proof or fact. No superlatives without support.' }),
  F('marketing', '产品优势', 'marketing-product-advantages', 'product_advantages', { objective: 'Product-level differentiation', structure: 'Feature → Benefit → Proof', length: '250-400 words', promptInstructions: 'Focus on product features and user benefits.' }),
  F('marketing', '技术优势', 'marketing-tech-advantages', 'tech_advantages', { objective: 'Technical edge', structure: 'Architecture · Security · Performance · Interoperability', length: '250-400 words', taskType: 'content_quality', promptInstructions: 'Explain technical differentiation for a semi-technical audience.' }),
  F('marketing', '生态优势', 'marketing-ecosystem', 'ecosystem_advantages', { objective: 'Ecosystem & partners', structure: 'Ecosystem map · Partners · Integrations · Flywheel', length: '250-400 words', promptInstructions: 'Describe ecosystem strengths using only confirmed partners.' }),
  F('marketing', '代币价值叙事', 'marketing-token-value', 'token_value', { objective: 'Why the token matters', structure: 'Utility · Demand drivers · Supply dynamics · Alignment', length: '300-500 words', requiredFacts: ['token_symbol'], taskType: 'content_quality', promptInstructions: 'Explain token value capture logically without price predictions.' }),
  F('marketing', '上线公告', 'marketing-launch', 'launch_announcement', { objective: 'Announce launch', structure: 'Headline · What launches · When · Where · How to participate · Links', length: '200-350 words', optionalFacts: ['launch_date', 'exchanges'], promptInstructions: 'Announcement style. Dates/venues must come from facts; otherwise [Missing: …].' }),
  F('marketing', '交易所上线公告', 'marketing-listing', 'listing_announcement', { objective: 'Announce exchange listing', structure: 'Headline · Exchange · Pair · Time · Deposit/Trading · CTA', length: '150-300 words', requiredFacts: ['exchanges'], promptInstructions: 'Only reference exchanges that are confirmed facts.' }),
  F('marketing', '倒计时文案', 'marketing-countdown', 'countdown', { objective: 'Build anticipation', structure: 'Series of 7 short countdown messages (T-7…T-1)', length: '7 items', promptInstructions: 'Write 7 countdown messages, each with a different angle and a light CTA.' }),
  // SOCIAL
  F('social', 'Twitter/X 推文', 'social-tweet', 'tweet', { platform: 'twitter', objective: 'Native tweet', structure: 'Hook line · 1-3 lines · optional CTA', length: '≤ 280 chars', promptInstructions: 'Write ONE native tweet. No hashtags spam (max 2), no "Excited to announce". Sound like a real crypto account. Output only the tweet.' }),
  F('social', 'Twitter/X 推文 — 科普', 'social-tweet-educational', 'tweet', { platform: 'twitter', objective: 'Teach one concept', structure: 'Insight · Explanation · Why it matters', length: '≤ 280 chars', promptInstructions: 'Educational tweet about one project concept. No fluff.' }),
  F('social', 'Twitter/X 推文 — FOMO', 'social-tweet-fomo', 'tweet', { platform: 'twitter', objective: 'Urgency without hype violations', structure: 'Tension · Reveal · CTA', length: '≤ 280 chars', promptInstructions: 'Create urgency using timing and scarcity of participation — never promise returns.' }),
  F('social', 'Twitter Thread', 'social-thread', 'thread', { platform: 'twitter', objective: 'Deep dive thread', structure: '8-12 tweets: hook · context · 5-8 points · summary · CTA', length: '8-12 tweets', taskType: 'content_quality', promptInstructions: 'Number each tweet (1/, 2/ …). First tweet must be a strong hook. Each tweet ≤ 280 chars.' }),
  F('social', 'Telegram 公告', 'social-telegram', 'telegram_post', { platform: 'telegram', objective: 'Community update', structure: 'Title line · body · links', length: '80-200 words', promptInstructions: 'Telegram announcement style with sparse emoji and clear structure.' }),
  F('social', 'Discord 公告', 'social-discord', 'discord_post', { platform: 'discord', objective: 'Server announcement', structure: 'Header · body · what to do · links', length: '80-200 words', promptInstructions: 'Discord announcement using Markdown bold headers.' }),
  F('social', 'Medium 文章', 'social-medium', 'article', { platform: 'medium', objective: 'Long-form article', structure: 'Title · Intro · 3-5 sections · Conclusion', length: '800-1200 words', taskType: 'content_quality', promptInstructions: 'Write a Medium article in Markdown with a compelling title and subtitle.' }),
  F('social', 'LinkedIn 帖子', 'social-linkedin', 'linkedin_post', { platform: 'linkedin', objective: 'Professional update', structure: 'Hook · insight · project relevance · CTA', length: '120-200 words', promptInstructions: 'Professional, institutional tone. No emoji walls.' }),
  F('social', '社区公告', 'social-community-announcement', 'community_announcement', { objective: 'Cross-platform announcement', structure: 'Title · What · Why · Action · Links', length: '100-200 words', promptInstructions: 'Platform-neutral announcement.' }),
  // POSTER
  F('poster', '海报 — 项目概述', 'poster-overview', 'poster_copy', { objective: 'Poster copy', structure: 'Headline (≤8 words) · Subheadline · 3 bullets · CTA · footer links', length: 'Poster', promptInstructions: 'Output poster copy blocks labeled HEADLINE / SUBHEAD / BULLETS / CTA / FOOTER. Punchy.' }),
  F('poster', '海报 — 项目优势', 'poster-advantages', 'poster_copy', { objective: 'Advantages poster', structure: 'Headline · 4-5 advantage tiles (title + one line)', length: 'Poster', promptInstructions: 'Output HEADLINE and 4-5 TILES, each with title (≤4 words) and one-line description.' }),
  F('poster', '海报 — 玩法', 'poster-how-it-works', 'poster_copy', { objective: 'Explain mechanics', structure: 'Headline · 3-4 steps', length: 'Poster', promptInstructions: 'Output HEADLINE and STEP 1..4 with ≤12 words each.' }),
  F('poster', '海报 — 代币经济', 'poster-tokenomics', 'poster_copy', { objective: 'Token poster', structure: 'Headline · supply · allocation · utility bullets', length: 'Poster', requiredFacts: ['token_symbol'], promptInstructions: 'Output HEADLINE, KEY NUMBERS (only known facts), ALLOCATION, UTILITY bullets.' }),
  F('poster', '海报 — 生态', 'poster-ecosystem', 'poster_copy', { objective: 'Ecosystem poster', structure: 'Headline · ecosystem pillars', length: 'Poster', promptInstructions: 'Output HEADLINE and 4-6 PILLARS.' }),
  F('poster', '海报 — 合作伙伴', 'poster-partners', 'poster_copy', { objective: 'Partnership poster', structure: 'Headline · partner line · what it enables', length: 'Poster', requiredFacts: ['partners'], promptInstructions: 'Only confirmed partners. Output HEADLINE / PARTNERS / WHAT IT MEANS.' }),
  F('poster', '海报 — 路线图', 'poster-roadmap', 'poster_copy', { objective: 'Roadmap poster', structure: 'Headline · phases', length: 'Poster', promptInstructions: 'Output HEADLINE and PHASES (title + 2 bullets each).' }),
  F('poster', '海报 — 上线', 'poster-launch', 'poster_copy', { objective: 'Launch poster', structure: 'Headline · date · where · CTA', length: 'Poster', optionalFacts: ['launch_date'], promptInstructions: 'Output HEADLINE / DATE / WHERE / CTA. Use [Missing: …] if date unknown.' }),
  F('poster', '海报 — 倒计时', 'poster-countdown', 'poster_copy', { objective: 'Countdown poster series', structure: '7 posters T-7…T-1', length: '7 posters', promptInstructions: 'Output 7 poster blocks each with HEADLINE / LINE / CTA.' }),
  // VIDEO
  F('video', '30 秒脚本', 'video-30s', 'video_script', { objective: 'Short promo', structure: 'Hook (0-3s) · Problem · Solution · Proof · CTA', length: '~75 words', promptInstructions: 'Format as a two-column script: VISUAL | VOICEOVER with timestamps.' }),
  F('video', '60 秒脚本', 'video-60s', 'video_script', { objective: 'Explainer', structure: 'Hook · Problem · Solution · How it works · Token · CTA', length: '~150 words', promptInstructions: 'Two-column VISUAL | VOICEOVER with timestamps.' }),
  F('video', '90 秒脚本', 'video-90s', 'video_script', { objective: 'Full story', structure: 'Hook · Story · Product · Ecosystem · Token · Vision · CTA', length: '~220 words', taskType: 'content_quality', promptInstructions: 'Two-column VISUAL | VOICEOVER with timestamps.' }),
  F('video', '宣传片', 'video-promo', 'video_script', { objective: 'Brand promo', structure: 'Cinematic beats', length: '60-90s', taskType: 'content_quality', promptInstructions: 'Cinematic promo script with scene descriptions and on-screen text.' }),
  F('video', '产品视频', 'video-product', 'video_script', { objective: 'Product walkthrough', structure: 'Intro · 3 features · CTA', length: '60-120s', promptInstructions: 'Screen-recording style script with feature callouts.' }),
  F('video', '代币视频', 'video-token', 'video_script', { objective: 'Token explainer', structure: 'What · Utility · Supply · How to get · Disclaimer', length: '60-90s', requiredFacts: ['token_symbol'], promptInstructions: 'Token explainer script; include compliant disclaimer line.' }),
  F('video', '教程视频', 'video-tutorial', 'video_script', { objective: 'How-to', structure: 'Goal · steps · tips', length: '90-180s', promptInstructions: 'Step-by-step tutorial script.' }),
  F('video', 'KOL 视频脚本', 'video-kol', 'kol_script', { objective: 'Creator-voiced script', structure: 'Personal hook · discovery · why it matters · CTA', length: '60-120s', taskType: 'content_quality', promptInstructions: 'Written in first person for a creator; natural spoken language.' }),
  // COMMUNITY
  F('community', 'AMA 套件', 'community-ama', 'ama_kit', { objective: 'Host an AMA', structure: 'Intro · 12 host questions with answers · 8 audience Q&A · closing', length: '1000-1500 words', taskType: 'content_quality', promptInstructions: 'Produce a full AMA kit with host script and prepared answers.' }),
  F('community', '社区 FAQ', 'community-faq', 'faq', { objective: 'Quick FAQ', structure: '15 Q&A', length: '15 Q&A', promptInstructions: 'Short answers a moderator can paste.' }),
  F('community', '社区培训手册', 'community-training', 'training', { objective: 'Onboard moderators/ambassadors', structure: 'Project 101 · key messages · do/don\'t · FAQ · escalation', length: '600-900 words', taskType: 'content_quality', promptInstructions: 'Training doc for ambassadors including restricted claims.' }),
  F('community', '社群话术', 'community-talking-points', 'talking_points', { objective: 'Reusable messages', structure: '10 talking points', length: '10 items', promptInstructions: '10 copy-paste talking points for community managers.' }),
  F('community', '客服回复', 'community-support', 'support_replies', { objective: 'Customer support scripts', structure: '10 common tickets with replies', length: '10 items', promptInstructions: 'Empathetic, precise, no promises. Include when to escalate.' }),
  F('community', '社区活动', 'community-event', 'event', { objective: 'Event plan', structure: 'Concept · rules · timeline · rewards · announcement copy', length: '300-500 words', promptInstructions: 'Design a community event; rewards must be from confirmed facts or [Missing].' }),
  F('community', '空投活动', 'community-airdrop', 'airdrop', { objective: 'Airdrop mechanics + copy', structure: 'Eligibility · tasks · timeline · anti-sybil · announcement', length: '300-500 words', promptInstructions: 'Airdrop plan and announcement copy with compliance-safe wording.' }),
  F('community', '任务活动', 'community-quest', 'quest', { objective: 'Task campaign (Galxe/Zealy style)', structure: '8-12 tasks · points · rewards · copy', length: '300-500 words', promptInstructions: 'Task list with points and announcement copy.' }),
  // PR
  F('pr', '新闻稿', 'pr-press-release', 'press_release', { objective: 'News-style release', structure: 'Headline · Dateline · Lead · Body · Quote · Boilerplate · Contact', length: '400-600 words', taskType: 'content_quality', promptInstructions: 'AP-style press release. Quotes attributed to "[Founder name]" placeholder if unknown.' }),
  F('pr', '媒体稿', 'pr-media-article', 'media_article', { objective: 'Contributed article', structure: 'Title · angle · 4 sections · conclusion', length: '700-1000 words', taskType: 'content_quality', promptInstructions: 'Thought-leadership article for crypto media (CoinDesk/Cointelegraph style).' }),
  F('pr', '合作公告', 'pr-partnership', 'partnership_announcement', { objective: 'Announce a partnership', structure: 'Headline · who · what · why · quotes · links', length: '250-400 words', requiredFacts: ['partners'], promptInstructions: 'Only confirmed partners; otherwise [Missing: partner name].' }),
  F('pr', '融资公告', 'pr-funding', 'funding_announcement', { objective: 'Announce a raise', structure: 'Headline · amount · investors · use of funds · quote', length: '250-400 words', requiredFacts: ['funding_amount', 'investors'], taskType: 'content_quality', promptInstructions: 'Amount and investors MUST be confirmed facts.' }),
  F('pr', '产品发布稿', 'pr-product-launch', 'product_launch_pr', { objective: 'Launch a product', structure: 'Headline · what · features · availability · quote', length: '300-500 words', taskType: 'content_quality', promptInstructions: 'Product launch press release.' }),
  F('pr', '交易所上线稿', 'pr-listing', 'listing_pr', { objective: 'Listing announcement PR', structure: 'Headline · exchange · pair · time · about', length: '250-400 words', requiredFacts: ['exchanges'], promptInstructions: 'Only confirmed exchanges.' }),
  // KOL
  F('kol', 'KOL 推文', 'kol-tweet', 'kol_tweet', { platform: 'twitter', objective: 'Creator-voiced tweet', structure: 'Personal take · project mention · why', length: '≤ 280 chars', promptInstructions: 'Written in a KOL\'s voice (not the project\'s). Genuine, not shill. Output 3 variants.' }),
  F('kol', 'KOL Thread', 'kol-thread', 'kol_thread', { platform: 'twitter', objective: 'Creator deep-dive', structure: '8-10 tweets', length: '8-10 tweets', taskType: 'content_quality', promptInstructions: 'KOL voice thread with honest framing including a risks tweet.' }),
  F('kol', 'KOL 脚本', 'kol-script', 'kol_script', { objective: 'Video/voice script', structure: 'Hook · story · analysis · CTA', length: '90-150s', taskType: 'content_quality', promptInstructions: 'Creator spoken script.' }),
  F('kol', '项目推荐', 'kol-recommendation', 'kol_recommendation', { objective: 'Short recommendation', structure: 'What · why I like it · watch-outs', length: '150-250 words', promptInstructions: 'Balanced recommendation with watch-outs.' }),
  F('kol', '深度分析', 'kol-analysis', 'kol_analysis', { objective: 'Research-style analysis', structure: 'Thesis · product · token · risks · verdict', length: '800-1200 words', taskType: 'content_quality', promptInstructions: 'Analyst-style deep dive; every number must be a project fact or [Missing].' })
]

export async function ensureSystemTemplates() {
  const db = await getDb()
  const existing = await db.query.contentTemplates.findMany({ columns: { slug: true } })
  const have = new Set(existing.map((e) => e.slug))
  const missing = SYSTEM_TEMPLATES.filter((t) => !have.has(t.slug))
  if (missing.length) {
    await db.insert(schema.contentTemplates).values(missing.map((t) => ({ ...t, isSystem: true, orgId: null, sortOrder: SYSTEM_TEMPLATES.indexOf(t) })))
  }
  // Keep display fields of system templates in sync with the code (names, structure, lengths) for existing databases.
  const g = globalThis as unknown as { __web3os_templates_synced?: boolean }
  if (!g.__web3os_templates_synced) {
    g.__web3os_templates_synced = true
    for (const t of SYSTEM_TEMPLATES) {
      await db.update(schema.contentTemplates).set({ name: t.name, objective: t.objective, audience: t.audience, structure: t.structure, length: t.length, tone: t.tone, promptInstructions: t.promptInstructions, taskType: t.taskType, requiredFacts: t.requiredFacts, optionalFacts: t.optionalFacts, sortOrder: SYSTEM_TEMPLATES.indexOf(t) }).where(and(eq(schema.contentTemplates.slug, t.slug), eq(schema.contentTemplates.isSystem, true)))
    }
  }
}

export async function listTemplates(orgId: string) {
  await ensureSystemTemplates()
  const db = await getDb()
  return db.query.contentTemplates.findMany({ where: or(isNull(schema.contentTemplates.orgId), eq(schema.contentTemplates.orgId, orgId)), orderBy: asc(schema.contentTemplates.sortOrder) })
}

export async function getTemplate(id: string) {
  const db = await getDb()
  return db.query.contentTemplates.findFirst({ where: eq(schema.contentTemplates.id, id) })
}

export async function getTemplateBySlug(slug: string) {
  await ensureSystemTemplates()
  const db = await getDb()
  return db.query.contentTemplates.findFirst({ where: eq(schema.contentTemplates.slug, slug) })
}
