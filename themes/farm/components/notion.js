/**
 * 把 Notion 板块页面里的内容块，解析成主题能用的简单数据
 * 约定：
 *  - 提示框（callout）= 一张卡片：第一行是标题/数值，其余是说明；里面的图片是缩略图，文件/PDF 是下载
 *  - 普通段落 = 板块导语
 *  - 表格 = 数据（饼图用：第一列名称，第二列数值）
 *  - 图片 = 板块配图（大标题板块用作背景）
 */
import BLOG from '@/blog.config'
import { mapImgUrl } from '@/lib/notion/mapImage'

export const getBlock = (map, id) => map?.block?.[id]?.value

/** 找到板块页面本身那个 block */
export function getRoot(post) {
  const map = post?.blockMap
  if (!map?.block) return null
  const direct = getBlock(map, post.id)
  if (direct) return direct
  const hit = Object.values(map.block).find(
    b => b?.value?.type === 'page' && b?.value?.parent_table === 'collection'
  )
  return hit?.value || null
}

/** 纯文本 */
export function plain(title) {
  return (title || []).map(seg => seg?.[0] ?? '').join('')
}

/** 富文本片段：[{text, bold, italic, href, color}] */
export function segments(title) {
  return (title || []).map(seg => {
    const [text, decos] = seg
    const out = { text: text ?? '' }
    ;(decos || []).forEach(d => {
      if (d[0] === 'b') out.bold = true
      if (d[0] === 'i') out.italic = true
      if (d[0] === 'a') out.href = d[1]
      if (d[0] === 'h') out.color = d[1]
    })
    return out
  })
}

/** 首个链接 */
export function firstLink(title) {
  return segments(title).find(s => s.href)?.href || null
}

export function fileUrl(map, b) {
  const signed = map?.signed_urls?.[b.id]
  if (signed) return signed
  const src = b?.properties?.source?.[0]?.[0]
  if (!src) return null
  if (src.startsWith('http') && !src.includes('amazonaws.com')) return src
  if (src.includes('notion.so/signed')) return src
  return `${BLOG.NOTION_HOST || 'https://www.notion.so'}/signed/${encodeURIComponent(src)}?table=block&id=${b.id}`
}

export function imageUrl(map, b) {
  const src =
    map?.signed_urls?.[b.id] ||
    b?.format?.display_source ||
    b?.properties?.source?.[0]?.[0]
  if (!src) return null
  return mapImgUrl(src, b, 'block', false)
}

function iconOf(b) {
  const icon = b?.format?.page_icon
  if (!icon) return null
  if (/^(https?:|\/|attachment)/.test(icon)) {
    return { type: 'image', src: mapImgUrl(icon, b, 'block', false) }
  }
  return { type: 'emoji', text: icon }
}

/** Notion 颜色名 → 主题色调 */
export function toneOf(color) {
  const c = (color || '').replace('_background', '')
  return (
    {
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
    }[c] || 'n'
  )
}

function isTextual(b) {
  return ['text', 'header', 'sub_header', 'sub_sub_header', 'quote'].includes(
    b?.type
  )
}

/** 把一个提示框解析成卡片 */
function parseCallout(map, b) {
  const lines = []
  if (plain(b.properties?.title).trim()) lines.push(b.properties.title)
  let image = null
  const files = []
  ;(b.content || []).forEach(cid => {
    const c = getBlock(map, cid)
    if (!c) return
    if (isTextual(c) && plain(c.properties?.title).trim()) {
      lines.push(c.properties.title)
    } else if (c.type === 'image' && !image) {
      image = imageUrl(map, c)
    } else if (['file', 'pdf'].includes(c.type)) {
      files.push({
        url: fileUrl(map, c),
        name: plain(c.properties?.title) || '下载文件',
        size: plain(c.properties?.size)
      })
    } else if (c.type === 'bookmark') {
      lines.push([[plain(c.properties?.title) || plain(c.properties?.link), [['a', plain(c.properties?.link)]]]])
    }
  })
  const [head, ...rest] = lines
  const link = lines.map(firstLink).find(Boolean) || null
  return {
    id: b.id,
    icon: iconOf(b),
    tone: toneOf(b.format?.block_color),
    head: head ? plain(head) : '',
    desc: rest,
    link,
    image,
    files
  }
}

function parseTable(map, b) {
  const order = b.format?.table_block_column_order || []
  const rows = (b.content || [])
    .map(id => getBlock(map, id))
    .filter(r => r?.type === 'table_row')
    .map(r => order.map(col => plain(r.properties?.[col])))
  const hasHeader = b.format?.table_block_column_header
  return hasHeader ? rows.slice(1) : rows
}

/** 解析整个板块 */
export function parseSection(post) {
  const map = post?.blockMap
  const root = getRoot(post)
  const result = { intro: [], cards: [], tables: [], images: [], links: [] }
  if (!root) return result
  ;(root.content || []).forEach(id => {
    const b = getBlock(map, id)
    if (!b) return
    if (b.type === 'callout') result.cards.push(parseCallout(map, b))
    else if (isTextual(b) && plain(b.properties?.title).trim())
      result.intro.push(b.properties.title)
    else if (b.type === 'table') result.tables.push(parseTable(map, b))
    else if (b.type === 'image') {
      const u = imageUrl(map, b)
      if (u) result.images.push(u)
    } else if (['file', 'pdf'].includes(b.type)) {
      result.cards.push({
        id: b.id,
        icon: { type: 'emoji', text: '📄' },
        tone: 'n',
        head: plain(b.properties?.title) || '文件',
        desc: [],
        files: [{ url: fileUrl(map, b), name: plain(b.properties?.title), size: plain(b.properties?.size) }]
      })
    }
  })
  return result
}
