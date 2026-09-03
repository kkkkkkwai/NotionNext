/** Display labels (Chinese) for raw enum-like values used across the UI. Values themselves never change. */
export const CONTENT_TYPE_LABELS: Record<string, string> = {
  project_overview: '项目概述', one_pager: 'One Pager', litepaper: 'Litepaper', whitepaper: '白皮书', gitbook: 'GitBook 文档', business_plan: '商业计划书', pitch_deck: 'Pitch Deck', faq: 'FAQ', roadmap: '路线图', tokenomics: '代币经济',
  project_intro: '项目介绍', project_background: '项目背景', project_advantages: '项目优势', product_advantages: '产品优势', tech_advantages: '技术优势', ecosystem_advantages: '生态优势', token_value: '代币价值', launch_announcement: '上线公告', listing_announcement: '上所公告', countdown: '倒计时',
  tweet: '推文', thread: 'Thread', telegram_post: 'Telegram', discord_post: 'Discord', article: '文章', linkedin_post: 'LinkedIn', community_announcement: '社区公告',
  poster_copy: '海报文案', video_script: '视频脚本', kol_script: 'KOL 脚本', ama_kit: 'AMA', training: '培训手册', talking_points: '社群话术', support_replies: '客服回复', event: '社区活动', airdrop: '空投活动', quest: '任务活动',
  press_release: '新闻稿', media_article: '媒体稿', partnership_announcement: '合作公告', funding_announcement: '融资公告', product_launch_pr: '产品发布稿', listing_pr: '上所稿',
  kol_tweet: 'KOL 推文', kol_thread: 'KOL Thread', kol_recommendation: '项目推荐', kol_analysis: '深度分析', content_calendar: '内容日历', custom: '自定义'
}
export const CATEGORY_LABELS: Record<string, string> = { foundation: '基础资料', marketing: '营销文案', social: '社媒', poster: '海报文案', video: '视频脚本', community: '社区', pr: '公关稿', kol: 'KOL' }
export const STATUS_LABELS: Record<string, string> = { draft: '草稿', review: '待审核', approved: '已批准', scheduled: '已排期', published: '已发布', archived: '已归档', pending: '待处理', processing: '处理中', ready: '已就绪', failed: '失败', confirmed: '已确认', locked: '已锁定', outdated: '已过期', conflict: '冲突', queued: '排队中', running: '进行中', completed: '已完成', generating: '生成中', active: '有效', success: '成功' }
export const PLATFORM_LABELS: Record<string, string> = { twitter: 'Twitter/X', telegram: 'Telegram', discord: 'Discord', medium: 'Medium', linkedin: 'LinkedIn', x: 'X' }
export const FACT_CATEGORY_LABELS: Record<string, string> = { token: '代币', funding: '融资', partners: '合作方', product: '产品', team: '团队', roadmap: '路线图', exchange: '交易所', audit: '审计', contract: '合约', metrics: '数据指标', brand: '品牌', general: '通用' }
export const MEMORY_TYPE_LABELS: Record<string, string> = { terminology: '术语', brand_rule: '品牌规则', decision: '决策', preference: '偏好', narrative: '叙事', tokenomics: '代币经济', note: '备注' }
export const ROLE_LABELS: Record<string, string> = { owner: '所有者', admin: '管理员', editor: '编辑', viewer: '查看者' }
export const READINESS_LABELS: Record<string, string> = { brand: '品牌', narrative: '叙事', tokenomics: '代币经济', marketing: '营销', community: '社区', launch: '上线' }
export const contentTypeLabel = (t: string | null | undefined) => (t ? CONTENT_TYPE_LABELS[t] ?? t : '')
export const statusLabel = (s: string | null | undefined) => (s ? STATUS_LABELS[s] ?? s : '')
export const categoryLabel = (c: string | null | undefined) => (c ? CATEGORY_LABELS[c] ?? c : '')
export const platformLabel = (p: string | null | undefined) => (p ? PLATFORM_LABELS[p] ?? p : '')
export const factCategoryLabel = (c: string | null | undefined) => (c ? FACT_CATEGORY_LABELS[c] ?? c : '')
export const memoryTypeLabel = (t: string | null | undefined) => (t ? MEMORY_TYPE_LABELS[t] ?? t : '')
export const roleLabel = (r: string | null | undefined) => (r ? ROLE_LABELS[r] ?? r : '')
export const RULE_TYPE_LABELS: Record<string, string> = { do: '建议', dont: '禁止', tone: '语气', restricted_claim: '禁止表述', keyword: '关键词' }
export const SOURCE_TYPE_LABELS: Record<string, string> = { file: '文件', url: '网页', gitbook: 'GitBook', text: '文本', manual: '手动' }
export const TX_TYPE_LABELS: Record<string, string> = { grant: '充值', usage: '消耗', adjustment: '调整' }
export const TIER_LABELS: Record<string, string> = { fast: '快速', strong: '强推理', long: '长上下文', embedding: '向量' }
export const TASK_TYPE_LABELS: Record<string, string> = { extraction: '资料提取', dna: '项目 DNA', narrative: '叙事引擎', content_fast: '短内容', content_quality: '高质量内容', long_form: '长文档', translation: '翻译', consistency: '一致性检查', risk: '风险检查', chat: 'AI 问答', memory: '记忆提取', embedding: 'Embedding' }
export const EVENT_LABELS: Record<string, string> = { created: '创建', updated: '更新', deleted: '删除', restored: '恢复', pinned: '置顶', unpinned: '取消置顶', locked: '锁定', unlocked: '解锁', conflict: '冲突' }
export const FORMAT_LABELS: Record<string, string> = { tweet: '推文', thread: 'Thread', poster: '海报', video: '视频', article: '文章', ama: 'AMA' }
export const TASK_CLASS_LABELS: Record<string, string> = { tokenomics: '代币经济', product: '产品', brand: '品牌', launch: '上线', community: '社区', investor: '投资人', technical: '技术', general: '通用' }
export const LANGUAGE_LABELS: Record<string, string> = { zh: '中文', en: 'English', ko: '한국어', ja: '日本語', vi: 'Tiếng Việt', th: 'ไทย', ru: 'Русский', es: 'Español' }
export const languageLabel = (c: string | null | undefined) => (c ? LANGUAGE_LABELS[c] ?? c : '')
export const label = (map: Record<string, string>, v: string | null | undefined) => (v ? map[v] ?? v : '')
