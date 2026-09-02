import {
  pgTable, text, timestamp, integer, real, boolean, jsonb, vector, index, uniqueIndex, doublePrecision
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const id = () => text('id').primaryKey().default(sql`gen_random_uuid()`)
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()

// ---------------- Users / Organizations ----------------
export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: createdAt()
})

export const organizations = pgTable('organizations', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: text('owner_id').notNull(),
  credits: doublePrecision('credits').default(0).notNull(),
  settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: createdAt()
})

export const organizationMembers = pgTable('organization_members', {
  id: id(),
  orgId: text('org_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').default('owner').notNull(), // owner | admin | editor | viewer
  createdAt: createdAt()
}, (t) => ({ orgUser: uniqueIndex('org_members_org_user').on(t.orgId, t.userId) }))

// ---------------- Projects ----------------
export const projects = pgTable('projects', {
  id: id(),
  orgId: text('org_id').notNull(),
  createdBy: text('created_by').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  logoUrl: text('logo_url'),
  slogan: text('slogan'),
  website: text('website'),
  twitter: text('twitter'),
  telegram: text('telegram'),
  discord: text('discord'),
  industry: text('industry'),
  positioning: text('positioning'),
  tokenName: text('token_name'),
  tokenSymbol: text('token_symbol'),
  launchDate: text('launch_date'),
  idea: text('idea'), // the initial free-form project description
  status: text('status').default('active').notNull(),
  readiness: jsonb('readiness').$type<Record<string, number>>().default({}).notNull(),
  settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, (t) => ({ orgIdx: index('projects_org_idx').on(t.orgId) }))

export const projectSources = pgTable('project_sources', {
  id: id(),
  projectId: text('project_id').notNull(),
  type: text('type').notNull(), // file | url | gitbook | text | manual
  name: text('name').notNull(),
  url: text('url'),
  filePath: text('file_path'),
  mimeType: text('mime_type'),
  size: integer('size'),
  status: text('status').default('pending').notNull(), // pending | processing | ready | failed
  error: text('error'),
  chunkCount: integer('chunk_count').default(0).notNull(),
  charCount: integer('char_count').default(0).notNull(),
  meta: jsonb('meta').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: createdAt()
}, (t) => ({ projIdx: index('sources_project_idx').on(t.projectId) }))

export const projectDocuments = pgTable('project_documents', {
  id: id(),
  projectId: text('project_id').notNull(),
  sourceId: text('source_id').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  pageCount: integer('page_count'),
  charCount: integer('char_count').default(0).notNull(),
  createdAt: createdAt()
}, (t) => ({ projIdx: index('documents_project_idx').on(t.projectId) }))

export const EMBEDDING_DIM = 1536

export const projectChunks = pgTable('project_chunks', {
  id: id(),
  projectId: text('project_id').notNull(),
  sourceId: text('source_id').notNull(),
  documentId: text('document_id'),
  sourceName: text('source_name').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: EMBEDDING_DIM }),
  page: integer('page'),
  section: text('section'),
  chunkIndex: integer('chunk_index').default(0).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: createdAt()
}, (t) => ({ projIdx: index('chunks_project_idx').on(t.projectId) }))

// ---------------- Memory Level 1: Structured Facts ----------------
export const projectFacts = pgTable('project_facts', {
  id: id(),
  projectId: text('project_id').notNull(),
  key: text('key').notNull(),
  label: text('label').notNull(),
  value: text('value').notNull(),
  category: text('category').default('general').notNull(), // token | funding | partners | product | team | roadmap | exchange | audit | contract | general
  source: text('source').default('user').notNull(),
  sourceRef: jsonb('source_ref').$type<{ sourceId?: string; sourceName?: string; page?: number; quote?: string }>().default({}).notNull(),
  confidence: real('confidence').default(0.8).notNull(),
  version: integer('version').default(1).notNull(),
  status: text('status').default('confirmed').notNull(), // draft | confirmed | locked | outdated | conflict
  pinned: boolean('pinned').default(false).notNull(),
  createdBy: text('created_by'),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, (t) => ({ projKey: uniqueIndex('facts_project_key').on(t.projectId, t.key) }))

export const projectFactVersions = pgTable('project_fact_versions', {
  id: id(),
  factId: text('fact_id').notNull(),
  projectId: text('project_id').notNull(),
  version: integer('version').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value').notNull(),
  source: text('source'),
  modifiedBy: text('modified_by'),
  note: text('note'),
  createdAt: createdAt()
}, (t) => ({ factIdx: index('fact_versions_fact_idx').on(t.factId) }))

// ---------------- Memory Level 2: Project DNA ----------------
export const projectDna = pgTable('project_dna', {
  id: id(),
  projectId: text('project_id').notNull(),
  version: integer('version').default(1).notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().default({}).notNull(),
  model: text('model'),
  generatedBy: text('generated_by'),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, (t) => ({ projIdx: index('dna_project_idx').on(t.projectId) }))

// ---------------- Memory Level 4: Long-term memories ----------------
export const projectMemories = pgTable('project_memories', {
  id: id(),
  projectId: text('project_id').notNull(),
  type: text('type').notNull(), // terminology | brand_rule | decision | preference | narrative | note | tokenomics
  title: text('title').notNull(),
  content: text('content').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  pinned: boolean('pinned').default(false).notNull(),
  locked: boolean('locked').default(false).notNull(),
  status: text('status').default('active').notNull(), // active | archived
  source: text('source').default('user').notNull(), // user | ai | import
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, (t) => ({ projIdx: index('memories_project_idx').on(t.projectId) }))

export const projectMemoryEvents = pgTable('project_memory_events', {
  id: id(),
  projectId: text('project_id').notNull(),
  memoryId: text('memory_id'),
  event: text('event').notNull(), // created | updated | deleted | restored | pinned | locked | unlocked
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
  actor: text('actor'),
  createdAt: createdAt()
}, (t) => ({ projIdx: index('memory_events_project_idx').on(t.projectId) }))

export const projectConversations = pgTable('project_conversations', {
  id: id(),
  projectId: text('project_id').notNull(),
  userId: text('user_id').notNull(),
  title: text('title').default('New conversation').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, (t) => ({ projIdx: index('conversations_project_idx').on(t.projectId) }))

export const projectMessages = pgTable('project_messages', {
  id: id(),
  conversationId: text('conversation_id').notNull(),
  projectId: text('project_id').notNull(),
  role: text('role').notNull(), // user | assistant | system
  content: text('content').notNull(),
  meta: jsonb('meta').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: createdAt()
}, (t) => ({ convIdx: index('messages_conversation_idx').on(t.conversationId) }))

export const brandRules = pgTable('brand_rules', {
  id: id(),
  projectId: text('project_id').notNull(),
  ruleType: text('rule_type').notNull(), // tone | do | dont | restricted_claim | keyword
  content: text('content').notNull(),
  priority: integer('priority').default(0).notNull(),
  createdAt: createdAt()
}, (t) => ({ projIdx: index('brand_rules_project_idx').on(t.projectId) }))

export const terminology = pgTable('terminology', {
  id: id(),
  projectId: text('project_id').notNull(),
  oldTerm: text('old_term').notNull(),
  newTerm: text('new_term').notNull(),
  note: text('note'),
  locked: boolean('locked').default(false).notNull(),
  createdAt: createdAt()
}, (t) => ({ projIdx: index('terminology_project_idx').on(t.projectId) }))

export const narratives = pgTable('narratives', {
  id: id(),
  projectId: text('project_id').notNull(),
  version: integer('version').default(1).notNull(),
  data: jsonb('data').$type<Record<string, unknown>>().default({}).notNull(),
  model: text('model'),
  createdAt: createdAt()
}, (t) => ({ projIdx: index('narratives_project_idx').on(t.projectId) }))

// ---------------- Content ----------------
export const contentTemplates = pgTable('content_templates', {
  id: id(),
  orgId: text('org_id'), // null = system template
  category: text('category').notNull(), // foundation | marketing | social | poster | video | community | pr | kol
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  contentType: text('content_type').notNull(),
  objective: text('objective'),
  audience: text('audience'),
  platform: text('platform'),
  tone: text('tone'),
  structure: text('structure'),
  length: text('length'),
  requiredFacts: jsonb('required_facts').$type<string[]>().default([]).notNull(),
  optionalFacts: jsonb('optional_facts').$type<string[]>().default([]).notNull(),
  promptInstructions: text('prompt_instructions').notNull(),
  taskType: text('task_type').default('content_fast').notNull(),
  isSystem: boolean('is_system').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: createdAt()
})

export const contentItems = pgTable('content_items', {
  id: id(),
  projectId: text('project_id').notNull(),
  templateId: text('template_id'),
  campaignId: text('campaign_id'),
  jobId: text('job_id'),
  title: text('title').notNull(),
  contentType: text('content_type').notNull(),
  category: text('category').default('social').notNull(),
  platform: text('platform'),
  language: text('language').default('en').notNull(),
  status: text('status').default('draft').notNull(), // draft | review | approved | scheduled | published | archived
  tags: jsonb('tags').$type<string[]>().default([]).notNull(),
  folder: text('folder'),
  angle: text('angle'),
  factsUsed: jsonb('facts_used').$type<string[]>().default([]).notNull(),
  body: text('body').notNull(),
  currentVersion: integer('current_version').default(1).notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdBy: text('created_by'),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, (t) => ({ projIdx: index('content_project_idx').on(t.projectId) }))

export const contentVersions = pgTable('content_versions', {
  id: id(),
  contentId: text('content_id').notNull(),
  projectId: text('project_id').notNull(),
  version: integer('version').notNull(),
  body: text('body').notNull(),
  note: text('note'),
  model: text('model'),
  createdBy: text('created_by'),
  createdAt: createdAt()
}, (t) => ({ contentIdx: index('content_versions_content_idx').on(t.contentId) }))

export const campaigns = pgTable('campaigns', {
  id: id(),
  projectId: text('project_id').notNull(),
  name: text('name').notNull(),
  goal: text('goal'),
  type: text('type').default('launch').notNull(),
  startDate: text('start_date'),
  endDate: text('end_date'),
  status: text('status').default('draft').notNull(),
  plan: jsonb('plan').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: createdAt()
}, (t) => ({ projIdx: index('campaigns_project_idx').on(t.projectId) }))

export const campaignItems = pgTable('campaign_items', {
  id: id(),
  campaignId: text('campaign_id').notNull(),
  projectId: text('project_id').notNull(),
  dayOffset: integer('day_offset').default(0).notNull(),
  date: text('date'),
  theme: text('theme'),
  contentId: text('content_id'),
  contentType: text('content_type'),
  status: text('status').default('planned').notNull(),
  createdAt: createdAt()
}, (t) => ({ campIdx: index('campaign_items_campaign_idx').on(t.campaignId) }))

// ---------------- AI ----------------
export const aiProviders = pgTable('ai_providers', {
  id: id(),
  orgId: text('org_id').notNull(),
  provider: text('provider').notNull(), // openai | anthropic | gemini | openrouter | openai_compatible
  name: text('name').notNull(),
  apiKeyEnc: text('api_key_enc'),
  baseUrl: text('base_url'),
  defaultModel: text('default_model'),
  embeddingModel: text('embedding_model'),
  temperature: real('temperature').default(0.7).notNull(),
  maxTokens: integer('max_tokens').default(4096).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: createdAt()
}, (t) => ({ orgIdx: index('ai_providers_org_idx').on(t.orgId) }))

export const aiModels = pgTable('ai_models', {
  id: id(),
  orgId: text('org_id'),
  providerId: text('provider_id'),
  provider: text('provider').notNull(),
  modelId: text('model_id').notNull(),
  label: text('label').notNull(),
  kind: text('kind').default('chat').notNull(), // chat | embedding
  contextWindow: integer('context_window'),
  inputCostPerM: doublePrecision('input_cost_per_m').default(0).notNull(),
  outputCostPerM: doublePrecision('output_cost_per_m').default(0).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: createdAt()
})

export const aiSettings = pgTable('ai_settings', {
  id: id(),
  orgId: text('org_id').notNull(),
  taskType: text('task_type').notNull(),
  providerId: text('provider_id'),
  model: text('model'),
  temperature: real('temperature'),
  maxTokens: integer('max_tokens'),
  createdAt: createdAt()
}, (t) => ({ orgTask: uniqueIndex('ai_settings_org_task').on(t.orgId, t.taskType) }))

export const aiRequests = pgTable('ai_requests', {
  id: id(),
  orgId: text('org_id').notNull(),
  projectId: text('project_id'),
  userId: text('user_id'),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  taskType: text('task_type').notNull(),
  contentType: text('content_type'),
  inputTokens: integer('input_tokens').default(0).notNull(),
  outputTokens: integer('output_tokens').default(0).notNull(),
  cost: doublePrecision('cost').default(0).notNull(),
  latencyMs: integer('latency_ms').default(0).notNull(),
  status: text('status').default('success').notNull(),
  error: text('error'),
  createdAt: createdAt()
}, (t) => ({ orgIdx: index('ai_requests_org_idx').on(t.orgId), projIdx: index('ai_requests_project_idx').on(t.projectId) }))

export const aiUsage = pgTable('ai_usage', {
  id: id(),
  orgId: text('org_id').notNull(),
  projectId: text('project_id'),
  day: text('day').notNull(), // YYYY-MM-DD
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  taskType: text('task_type').notNull(),
  contentType: text('content_type'),
  requests: integer('requests').default(0).notNull(),
  inputTokens: integer('input_tokens').default(0).notNull(),
  outputTokens: integer('output_tokens').default(0).notNull(),
  cost: doublePrecision('cost').default(0).notNull()
}, (t) => ({ key: uniqueIndex('ai_usage_key').on(t.orgId, t.projectId, t.day, t.provider, t.model, t.taskType, t.contentType) }))

export const generationJobs = pgTable('generation_jobs', {
  id: id(),
  projectId: text('project_id').notNull(),
  orgId: text('org_id').notNull(),
  userId: text('user_id'),
  type: text('type').notNull(), // ingest | extract_facts | dna | narrative | launch_kit | campaign | consistency
  status: text('status').default('queued').notNull(), // queued | running | completed | failed
  progress: integer('progress').default(0).notNull(),
  step: text('step'),
  steps: jsonb('steps').$type<{ name: string; status: string }[]>().default([]).notNull(),
  input: jsonb('input').$type<Record<string, unknown>>().default({}).notNull(),
  result: jsonb('result').$type<Record<string, unknown>>().default({}).notNull(),
  error: text('error'),
  createdAt: createdAt(),
  updatedAt: updatedAt()
}, (t) => ({ projIdx: index('jobs_project_idx').on(t.projectId) }))

export type User = typeof users.$inferSelect
export type Organization = typeof organizations.$inferSelect
export type Project = typeof projects.$inferSelect
export type ProjectSource = typeof projectSources.$inferSelect
export type ProjectChunk = typeof projectChunks.$inferSelect
export type ProjectFact = typeof projectFacts.$inferSelect
export type ProjectFactVersion = typeof projectFactVersions.$inferSelect
export type ProjectDna = typeof projectDna.$inferSelect
export type ProjectMemory = typeof projectMemories.$inferSelect
export type ProjectConversation = typeof projectConversations.$inferSelect
export type ProjectMessage = typeof projectMessages.$inferSelect
export type Terminology = typeof terminology.$inferSelect
export type BrandRule = typeof brandRules.$inferSelect
export type Narrative = typeof narratives.$inferSelect
export type ContentTemplate = typeof contentTemplates.$inferSelect
export type ContentItem = typeof contentItems.$inferSelect
export type ContentVersion = typeof contentVersions.$inferSelect
export type Campaign = typeof campaigns.$inferSelect
export type CampaignItem = typeof campaignItems.$inferSelect
export type AiProvider = typeof aiProviders.$inferSelect
export type AiModel = typeof aiModels.$inferSelect
export type AiSetting = typeof aiSettings.$inferSelect
export type AiRequest = typeof aiRequests.$inferSelect
export type GenerationJob = typeof generationJobs.$inferSelect
