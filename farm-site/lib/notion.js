/**
 * 用 Notion 官方接口读取「欢乐农场官网后台」数据库
 * 需要环境变量 NOTION_TOKEN 与 NOTION_DATABASE_ID
 */
const API = 'https://api.notion.com/v1'
const VERSION = '2022-06-28'

// Notion 官方接口限速约每秒 3 次：同时最多 3 个请求，被限速时按 Retry-After 等待重试
const MAX_ACTIVE = 3
let active = 0
const waiting = []
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function slot(fn) {
  if (active >= MAX_ACTIVE) await new Promise(r => waiting.push(r))
  active++
  try {
    return await fn()
  } finally {
    active--
    waiting.shift()?.()
  }
}

async function call(path, { method = 'GET', body } = {}) {
  const token = process.env.NOTION_TOKEN
  if (!token) throw new Error('缺少环境变量 NOTION_TOKEN')
  for (let attempt = 0; ; attempt++) {
    const res = await slot(() =>
      fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': VERSION,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      })
    )
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const wait = Number(res.headers.get('retry-after')) || 1 + attempt
      await sleep(wait * 1000)
      continue
    }
    const json = await res.json()
    if (!res.ok) throw new Error(`Notion ${res.status}: ${json.message}`)
    return json
  }
}

async function queryAll(databaseId, body = {}) {
  const out = []
  let cursor
  do {
    const r = await call(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: { ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }
    })
    out.push(...r.results)
    cursor = r.has_more ? r.next_cursor : null
  } while (cursor)
  return out
}

export async function getBlock(id) {
  return call(`/blocks/${id}`)
}

/** 取一个块的全部子块；带子块的块（提示框、表格、分栏等）会递归取 children */
async function getChildren(id, depth = 0) {
  const out = []
  let cursor
  do {
    const r = await call(
      `/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`
    )
    out.push(...r.results)
    cursor = r.has_more ? r.next_cursor : null
  } while (cursor)
  if (depth < 3) {
    await Promise.all(
      out
        .filter(b => b.has_children && !['child_page', 'child_database'].includes(b.type))
        .map(async b => {
          b.children = await getChildren(b.id, depth + 1)
        })
    )
  }
  return out
}

/* ---------- 文本 ---------- */

/** 官方富文本 → [{text,bold,italic,href,color}] */
export function segs(rich) {
  return (rich || []).map(t => {
    const o = { text: t.plain_text || '' }
    if (t.annotations?.bold) o.bold = true
    if (t.annotations?.italic) o.italic = true
    if (t.annotations?.color && t.annotations.color !== 'default') o.color = t.annotations.color
    if (t.href) o.href = t.href
    return o
  })
}
export const plain = rich => (rich || []).map(t => t.plain_text || '').join('')
const segText = s => s.map(x => x.text).join('')

function prop(page, name) {
  const p = page.properties?.[name]
  if (!p) return null
  switch (p.type) {
    case 'title':
      return plain(p.title)
    case 'rich_text':
      return plain(p.rich_text)
    case 'select':
      return p.select?.name || null
    case 'multi_select':
      return p.multi_select.map(o => o.name)
    case 'number':
      return p.number
    case 'checkbox':
      return p.checkbox
    case 'url':
      return p.url
    default:
      return null
  }
}

/* ---------- 文件与图片 ---------- */

/**
 * Notion 上传的文件链接 1 小时后过期，所以统一走 /api/asset/块ID，
 * 访问时再去 Notion 取最新链接并跳转；外链则直接用
 */
function assetUrl(b) {
  const f = b[b.type]
  if (!f) return null
  if (f.type === 'external') return f.external.url
  return `/api/asset/${b.id.replace(/-/g, '')}`
}

export function fileNameOf(b) {
  const f = b[b.type] || {}
  if (f.name) return f.name
  const cap = plain(f.caption)
  if (cap) return cap
  const u = f.file?.url || f.external?.url || ''
  try {
    return decodeURIComponent(new URL(u).pathname.split('/').pop())
  } catch {
    return '下载文件'
  }
}

/* ---------- 板块解析 ---------- */

const TONE = {
  yellow: 'y',
  orange: 'y',
  brown: 'y',
  green: 'm',
  red: 'r',
  pink: 'r',
  blue: 's',
  purple: 's',
  gray: 'n',
  default: 'n'
}
const toneOf = c => TONE[(c || '').replace('_background', '')] || 'n'

function iconOf(icon) {
  if (!icon) return null
  if (icon.type === 'emoji') return { type: 'emoji', text: icon.emoji }
  if (icon.type === 'external') return { type: 'image', src: icon.external.url }
  if (icon.type === 'file') return { type: 'image', src: icon.file.url }
  return null
}

const TEXTUAL = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'quote']
const richOf = b => b[b.type]?.rich_text

function parseCallout(b) {
  const lines = []
  const head = segs(richOf(b))
  if (segText(head).trim()) lines.push(head)
  let image = null
  const files = []
  ;(b.children || []).forEach(c => {
    if (TEXTUAL.includes(c.type) || c.type.endsWith('list_item')) {
      const s = segs(richOf(c))
      if (segText(s).trim()) lines.push(s)
    } else if (c.type === 'image' && !image) {
      image = assetUrl(c)
    } else if (['file', 'pdf', 'video', 'audio'].includes(c.type)) {
      files.push({ url: assetUrl(c), name: fileNameOf(c) })
    } else if (['bookmark', 'embed', 'link_preview'].includes(c.type)) {
      const url = c[c.type].url
      lines.push([{ text: plain(c[c.type].caption) || url, href: url }])
    }
  })
  const [first, ...rest] = lines
  const link = lines.flat().find(s => s.href)?.href || null
  return {
    id: b.id,
    icon: iconOf(b.callout.icon),
    tone: toneOf(b.callout.color),
    head: first ? segText(first) : '',
    desc: rest,
    link,
    image,
    files
  }
}

function parseTable(b) {
  const rows = (b.children || [])
    .filter(r => r.type === 'table_row')
    .map(r => r.table_row.cells.map(plain))
  return b.table.has_column_header ? rows.slice(1) : rows
}

/** 简化后的块，给「自由图文」样式用 */
function simplify(b) {
  const base = { id: b.id, type: b.type }
  if (TEXTUAL.includes(b.type) || b.type.endsWith('list_item') || b.type === 'to_do')
    return { ...base, text: segs(richOf(b)), children: (b.children || []).map(simplify) }
  if (b.type === 'callout') return { ...base, card: parseCallout(b) }
  if (b.type === 'image') return { ...base, src: assetUrl(b), caption: plain(b.image.caption) }
  if (['file', 'pdf', 'video'].includes(b.type))
    return { ...base, url: assetUrl(b), name: fileNameOf(b) }
  if (b.type === 'table') return { ...base, rows: parseTable(b) }
  if (['bookmark', 'embed'].includes(b.type)) return { ...base, url: b[b.type].url }
  if (['column_list', 'column', 'toggle'].includes(b.type))
    return {
      ...base,
      text: b.type === 'toggle' ? segs(richOf(b)) : [],
      children: (b.children || []).map(simplify)
    }
  if (b.type === 'divider') return base
  return null
}

function parseSection(blocks) {
  const r = { intro: [], cards: [], tables: [], images: [], blocks: [] }
  blocks.forEach(b => {
    const s = simplify(b)
    if (s) r.blocks.push(s)
    if (b.type === 'callout') r.cards.push(parseCallout(b))
    else if (TEXTUAL.includes(b.type)) {
      const t = segs(richOf(b))
      if (segText(t).trim()) r.intro.push(t)
    } else if (b.type === 'table') r.tables.push(parseTable(b))
    else if (b.type === 'image') r.images.push(assetUrl(b))
    else if (['file', 'pdf'].includes(b.type))
      r.cards.push({
        id: b.id,
        icon: { type: 'emoji', text: '📄' },
        tone: 'n',
        head: fileNameOf(b),
        desc: [],
        link: null,
        image: null,
        files: [{ url: assetUrl(b), name: fileNameOf(b) }]
      })
  })
  return r
}

/* ---------- 站点设置 ---------- */

async function readConfig(page) {
  const config = {}
  if (!page) return config
  const blocks = await getChildren(page.id)
  const logo = blocks.find(b => b.type === 'image')
  if (logo) config.FARM_LOGO = assetUrl(logo)
  for (const db of blocks.filter(b => b.type === 'child_database')) {
    const rows = await queryAll(db.id)
    rows.forEach(row => {
      const name = prop(row, '配置名')
      const on = prop(row, '启用')
      if (name && on !== false) config[name.trim()] = (prop(row, '配置值') || '').trim()
    })
  }
  return config
}

/* ---------- 对外 ---------- */

export async function getSite() {
  const dbId = process.env.NOTION_DATABASE_ID
  if (!dbId) throw new Error('缺少环境变量 NOTION_DATABASE_ID')
  const pages = await queryAll(dbId, { sorts: [{ property: 'order', direction: 'ascending' }] })

  const configPage = pages.find(p => prop(p, 'type') === 'Config')
  const rows = pages.filter(
    p => prop(p, 'status') === 'Published' && ['Post', 'Page'].includes(prop(p, 'type'))
  )

  const [config, sections] = await Promise.all([
    readConfig(configPage),
    Promise.all(
      rows.map(async p => {
        const blocks = await getChildren(p.id)
        return {
          id: p.id,
          title: prop(p, 'title') || '',
          slug: prop(p, 'slug') || p.id.slice(0, 8),
          nav: prop(p, 'icon') || '',
          summary: prop(p, 'summary') || '',
          tags: prop(p, 'tags') || [],
          category: prop(p, 'category') || '',
          cover:
            p.cover?.type === 'external'
              ? p.cover.external.url
              : p.cover?.type === 'file'
                ? `/api/asset/page-cover-${p.id.replace(/-/g, '')}`
                : null,
          data: parseSection(blocks)
        }
      })
    )
  ])
  return { config, sections }
}
