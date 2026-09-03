/** Renders poster copy (HEADLINE / SUBHEAD / BULLETS / CTA / FOOTER blocks or free text) into a branded SVG poster. */
export interface PosterSpec { headline: string; subhead?: string; bullets: string[]; cta?: string; footer?: string; brand: string; symbol?: string }

export function parsePosterCopy(body: string, brand: string, symbol?: string | null): PosterSpec {
  const lines = body.split('\n').map((l) => l.replace(/^[#*\-•\s]+|[*]+$/g, '').trim()).filter(Boolean)
  const grab = (label: RegExp) => {
    const i = lines.findIndex((l) => label.test(l))
    if (i === -1) return undefined
    const inline = lines[i].replace(label, '').replace(/^[:：\-–\s]+/, '').trim()
    return inline || lines[i + 1]
  }
  const headline = grab(/^(headline|标题)/i) ?? lines[0] ?? brand
  const subhead = grab(/^(subhead(line)?|副标题|tagline)/i)
  const cta = grab(/^(cta|call to action|行动)/i)
  const footer = grab(/^(footer|页脚|links?)/i)
  const bulletsStart = lines.findIndex((l) => /^(bullets?|tiles?|steps?|pillars?|utility|key numbers|要点)/i.test(l))
  let bullets: string[] = []
  if (bulletsStart !== -1) {
    for (const l of lines.slice(bulletsStart + 1)) {
      if (/^(cta|footer|headline|subhead|call to action|页脚|行动)/i.test(l)) break
      bullets.push(l.replace(/^(step|tile|pillar)\s*\d+[:：.\s-]*/i, ''))
      if (bullets.length >= 6) break
    }
  }
  if (!bullets.length) bullets = lines.filter((l) => l !== headline && l !== subhead && l !== cta && l !== footer && !/^(headline|subhead|cta|footer)/i.test(l)).slice(0, 5)
  return { headline: headline.slice(0, 80), subhead: subhead?.slice(0, 120), bullets: bullets.map((b) => b.slice(0, 90)), cta: cta?.slice(0, 60), footer: footer?.slice(0, 100), brand, symbol: symbol ?? undefined }
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function wrap(text: string, max: number): string[] {
  const words = text.split(/(\s+)/).filter((w) => w.trim())
  const lines: string[] = []
  let cur = ''
  const width = (s: string) => Array.from(s).reduce((a, ch) => a + (/[一-鿿぀-ヿ가-힣]/.test(ch) ? 2 : 1), 0)
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w
    if (width(next) > max && cur) {
      lines.push(cur)
      cur = w
    } else cur = next
  }
  if (cur) lines.push(cur)
  // CJK without spaces
  return lines.flatMap((l) => (width(l) > max ? Array.from(l).reduce<string[]>((acc, ch) => { const last = acc[acc.length - 1]; if (last !== undefined && width(last) < max) acc[acc.length - 1] = last + ch; else acc.push(ch); return acc }, []) : [l]))
}

export function renderPosterSvg(spec: PosterSpec, opts: { width?: number; height?: number; accent?: string } = {}) {
  const W = opts.width ?? 1080
  const H = opts.height ?? 1350
  const accent = opts.accent ?? '#43FFB0'
  const headLines = wrap(spec.headline, 22)
  const headSize = headLines.length > 2 ? 64 : 76
  let y = 220
  const parts: string[] = []
  parts.push(`<rect width="${W}" height="${H}" fill="#080A09"/>`)
  parts.push(`<circle cx="${W - 120}" cy="140" r="260" fill="${accent}" opacity="0.06"/>`)
  parts.push(`<rect x="80" y="80" width="10" height="60" fill="${accent}"/>`)
  parts.push(`<text x="110" y="126" font-family="Inter, 'PingFang SC', 'Noto Sans SC', Arial, sans-serif" font-size="30" font-weight="600" fill="#9AA3A0">${esc(spec.brand)}${spec.symbol ? `  <tspan fill="${accent}">$${esc(spec.symbol.replace(/^\$/, ''))}</tspan>` : ''}</text>`)
  for (const l of headLines) {
    parts.push(`<text x="80" y="${y}" font-family="Inter, 'PingFang SC', 'Noto Sans SC', Arial, sans-serif" font-size="${headSize}" font-weight="700" fill="#F5F7F6">${esc(l)}</text>`)
    y += headSize * 1.15
  }
  if (spec.subhead) {
    y += 16
    for (const l of wrap(spec.subhead, 40)) {
      parts.push(`<text x="80" y="${y}" font-family="Inter, 'PingFang SC', 'Noto Sans SC', Arial, sans-serif" font-size="34" fill="#9AA3A0">${esc(l)}</text>`)
      y += 44
    }
  }
  y += 50
  for (const b of spec.bullets.slice(0, 6)) {
    const ls = wrap(b, 42)
    parts.push(`<rect x="80" y="${y - 22}" width="12" height="12" rx="2" fill="${accent}"/>`)
    for (const [i, l] of ls.entries()) {
      parts.push(`<text x="112" y="${y - 10 + i * 40}" font-family="Inter, 'PingFang SC', 'Noto Sans SC', Arial, sans-serif" font-size="30" fill="#E6EAE8">${esc(l)}</text>`)
    }
    y += 40 * ls.length + 22
  }
  if (spec.cta) {
    const cw = Math.min(W - 160, Math.max(260, spec.cta.length * 19 + 80))
    const cy = Math.max(y + 30, H - 260)
    parts.push(`<rect x="80" y="${cy}" width="${cw}" height="84" rx="18" fill="${accent}"/>`)
    parts.push(`<text x="${80 + cw / 2}" y="${cy + 54}" text-anchor="middle" font-family="Inter, 'PingFang SC', 'Noto Sans SC', Arial, sans-serif" font-size="32" font-weight="700" fill="#0A0F0D">${esc(spec.cta)}</text>`)
  }
  parts.push(`<line x1="80" y1="${H - 110}" x2="${W - 80}" y2="${H - 110}" stroke="rgba(255,255,255,0.12)"/>`)
  parts.push(`<text x="80" y="${H - 64}" font-family="Inter, Arial, sans-serif" font-size="24" fill="#6B7471">${esc(spec.footer ?? spec.brand)}</text>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`
}
