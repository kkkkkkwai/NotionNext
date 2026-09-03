import { unzipSync, strFromU8 } from 'fflate'

export interface ParsedDocument {
  title: string
  text: string
  pages?: { page: number; text: string }[]
  meta?: Record<string, unknown>
}

function cleanText(t: string) {
  return t
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export async function parsePdf(buf: Buffer, name: string): Promise<ParsedDocument> {
  const pdfParse = (await import('pdf-parse')).default as unknown as (b: Buffer, o?: Record<string, unknown>) => Promise<{ text: string; numpages: number; info?: Record<string, unknown> }>
  const pages: { page: number; text: string }[] = []
  let pageNo = 0
  const data = await pdfParse(buf, {
    pagerender: async (pageData: { getTextContent: () => Promise<{ items: { str: string; transform: number[] }[] }> }) => {
      const tc = await pageData.getTextContent()
      let lastY: number | undefined
      let text = ''
      for (const item of tc.items) {
        const y = item.transform?.[5]
        if (lastY !== undefined && y !== lastY) text += '\n'
        text += item.str
        lastY = y
      }
      pageNo += 1
      pages.push({ page: pageNo, text: cleanText(text) })
      return text
    }
  })
  return { title: name, text: cleanText(pages.map((p) => p.text).join('\n\n')) || cleanText(data.text), pages, meta: { pageCount: data.numpages } }
}

export async function parseDocx(buf: Buffer, name: string): Promise<ParsedDocument> {
  const mammoth = await import('mammoth')
  const res = await mammoth.extractRawText({ buffer: buf })
  return { title: name, text: cleanText(res.value) }
}

export async function parsePptx(buf: Buffer, name: string): Promise<ParsedDocument> {
  const files = unzipSync(new Uint8Array(buf))
  const slides = Object.keys(files)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort((a, b) => parseInt(a.match(/slide(\d+)/)![1]) - parseInt(b.match(/slide(\d+)/)![1]))
  const pages = slides.map((k, i) => {
    const xml = strFromU8(files[k])
    const texts = Array.from(xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)).map((m) => decodeXml(m[1]))
    const paragraphs = xml.split(/<\/a:p>/).map((p) => Array.from(p.matchAll(/<a:t>([^<]*)<\/a:t>/g)).map((m) => decodeXml(m[1])).join('')).filter(Boolean)
    return { page: i + 1, text: cleanText((paragraphs.length ? paragraphs : texts).join('\n')) }
  })
  const text = pages.map((p) => `[Slide ${p.page}]\n${p.text}`).join('\n\n')
  return { title: name, text: cleanText(text), pages, meta: { slideCount: pages.length } }
}

function decodeXml(s: string) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

export function htmlToText(html: string): { title: string; text: string; links: string[] } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? ''
  const links = Array.from(html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)).map((m) => m[1])
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote|pre)>/gi, '\n')
    .replace(/<(h[1-6])[^>]*>/gi, '\n## ')
    .replace(/<[^>]+>/g, ' ')
  t = decodeXml(t).replace(/&nbsp;/g, ' ').replace(/&#x27;/g, "'").replace(/&[a-z]+;/gi, ' ')
  return { title: decodeXml(title), text: cleanText(t.split('\n').map((l) => l.trim()).join('\n')), links }
}

export async function fetchUrl(url: string, opts: { timeoutMs?: number } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Web3ContentOS/1.0)', Accept: 'text/html,application/xhtml+xml,text/plain,*/*' }, redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('application/pdf')) {
      const buf = Buffer.from(await res.arrayBuffer())
      return { kind: 'pdf' as const, buf }
    }
    const html = await res.text()
    return { kind: 'html' as const, html, contentType: ct }
  } finally {
    clearTimeout(timer)
  }
}

/** Crawls a website / GitBook: the entry page plus same-origin links (depth 1) up to maxPages. */
export async function crawlSite(entry: string, maxPages = 12): Promise<ParsedDocument> {
  const root = new URL(entry)
  const visited = new Set<string>()
  const queue: string[] = [entry]
  const pages: { page: number; text: string; url: string }[] = []
  let title = ''
  while (queue.length && pages.length < maxPages) {
    const url = queue.shift()!
    const norm = url.split('#')[0].replace(/\/$/, '')
    if (visited.has(norm)) continue
    visited.add(norm)
    try {
      const res = await fetchUrl(url)
      if (res.kind === 'pdf') {
        const parsed = await parsePdf(res.buf, url)
        pages.push({ page: pages.length + 1, text: parsed.text, url })
        continue
      }
      const { title: t, text, links } = htmlToText(res.html)
      if (!title) title = t || root.hostname
      if (text.length > 80) pages.push({ page: pages.length + 1, text: `[${t || url}] (${url})\n${text}`, url })
      if (pages.length === 1) {
        for (const l of links) {
          try {
            const abs = new URL(l, url)
            if (abs.origin !== root.origin) continue
            if (/\.(png|jpe?g|gif|svg|css|js|ico|woff2?|zip|mp4)$/i.test(abs.pathname)) continue
            const key = abs.toString().split('#')[0].replace(/\/$/, '')
            if (!visited.has(key) && !queue.includes(abs.toString())) queue.push(abs.toString())
          } catch {}
        }
      }
    } catch (e) {
      if (pages.length === 0) throw e
    }
  }
  if (pages.length === 0) throw new Error('无法从该网址读取到内容：' + entry)
  return { title: title || root.hostname, text: pages.map((p) => p.text).join('\n\n'), pages: pages.map(({ page, text }) => ({ page, text })), meta: { urls: pages.map((p) => p.url) } }
}

export async function parseBuffer(buf: Buffer, name: string, mime?: string): Promise<ParsedDocument> {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf' || mime === 'application/pdf') return parsePdf(buf, name)
  if (ext === 'docx' || mime?.includes('wordprocessingml')) return parseDocx(buf, name)
  if (ext === 'pptx' || mime?.includes('presentationml')) return parsePptx(buf, name)
  if (['txt', 'md', 'markdown', 'csv', 'json'].includes(ext) || mime?.startsWith('text/')) return { title: name, text: cleanText(buf.toString('utf8')) }
  if (ext === 'doc' || ext === 'ppt') throw new Error(`不支持旧版 .${ext} 文件，请另存为 .${ext}x 或 PDF。`)
  throw new Error(`不支持的文件类型：.${ext}`)
}

/** Splits text into overlapping chunks that respect paragraph boundaries. */
export function chunkText(text: string, opts: { size?: number; overlap?: number } = {}): { content: string; section?: string }[] {
  const size = opts.size ?? 1200
  const overlap = opts.overlap ?? 150
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const chunks: { content: string; section?: string }[] = []
  let current = ''
  let section: string | undefined
  const push = () => {
    if (current.trim().length > 40) chunks.push({ content: current.trim(), section })
    current = current.slice(Math.max(0, current.length - overlap))
  }
  for (const p of paragraphs) {
    const heading = p.match(/^(?:#+\s*|\[Slide \d+\]\s*)?(.{3,80})$/)
    if (p.length < 80 && heading && !/[.。!?]$/.test(p)) section = heading[1].trim()
    if (p.length > size) {
      const sentences = p.split(/(?<=[.!?。！？])\s+/)
      for (const s of sentences) {
        if ((current + ' ' + s).length > size) push()
        current += (current ? ' ' : '') + s
      }
      continue
    }
    if ((current + '\n\n' + p).length > size) push()
    current += (current ? '\n\n' : '') + p
  }
  if (current.trim().length > 40) chunks.push({ content: current.trim(), section })
  return chunks
}
