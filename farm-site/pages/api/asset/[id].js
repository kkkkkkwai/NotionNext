import { getBlock } from '@/lib/notion'

/**
 * /api/asset/<块ID>        → 跳转到这个图片 / 文件块的最新下载链接
 * /api/asset/page-cover-<页面ID> → 跳转到页面封面
 * Notion 上传文件的链接 1 小时就过期，所以每次访问时现取
 */
export default async function handler(req, res) {
  const raw = String(req.query.id || '')
  if (!/^(page-cover-)?[0-9a-f]{32}$/.test(raw)) return res.status(400).end()
  try {
    let url
    if (raw.startsWith('page-cover-')) {
      const page = await fetchPage(raw.slice(11))
      url = page.cover?.file?.url || page.cover?.external?.url
    } else {
      const b = await getBlock(raw)
      const f = b[b.type]
      url = f?.file?.url || f?.external?.url
    }
    if (!url) return res.status(404).end()
    // 浏览器可缓存 50 分钟（Notion 链接 60 分钟过期）
    res.setHeader('Cache-Control', 'public, max-age=3000, s-maxage=3000')
    res.redirect(302, url)
  } catch (e) {
    res.status(502).send(e.message)
  }
}

async function fetchPage(id) {
  const r = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    headers: {
      Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28'
    }
  })
  if (!r.ok) throw new Error(`Notion ${r.status}`)
  return r.json()
}
