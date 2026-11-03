'use client'
/* eslint-disable @next/next/no-img-element */

/**
 * 欢乐农场主题（farm）
 * 首页完全由 Notion 数据库驱动：
 *  - category = 首页板块 的每一篇 Post 就是首页的一个板块，Notion 里的排序就是板块顺序
 *  - tags 决定板块样式：大标题 / 数字卡 / 步骤 / 亮点 / 大数字 / 饼图 / 信息列表 / 文件下载 / 链接 / 自由图文
 *  - 板块内容写在该行的页面里（提示框 = 卡片）
 *  - slug 是锚点；icon（文字）非空时会出现在顶部导航上
 *  - 颜色、Logo、页脚等在 Notion「站点设置」配置表里改（见 ./config.js）
 * 需要在配置表里开启 POST_LIST_PREVIEW=true，首页才能拿到各板块内容
 */
import NotionPage from '@/components/NotionPage'
import { siteConfig } from '@/lib/config'
import Link from 'next/link'
import { useMemo } from 'react'
import { parseSection } from './components/notion'
import {
  BigNumbers,
  Donut,
  Files,
  Free,
  Hero,
  Highlights,
  InfoList,
  Links,
  SectionHead,
  Stats,
  Steps
} from './components/Sections'
import CONFIG from './config'
import { Style } from './style'

const STYLE_MAP = {
  大标题: 'hero',
  数字卡: 'stats',
  步骤: 'steps',
  亮点: 'highlights',
  大数字: 'big',
  饼图: 'donut',
  信息列表: 'list',
  文件下载: 'files',
  链接: 'links',
  自由图文: 'free'
}

const RENDER = {
  stats: Stats,
  steps: Steps,
  highlights: Highlights,
  big: BigNumbers,
  donut: Donut,
  list: InfoList,
  files: Files,
  links: Links,
  free: Free
}

function styleOf(post) {
  const tag = (post?.tags || []).find(t => STYLE_MAP[t])
  return STYLE_MAP[tag] || 'free'
}

function useColors() {
  return {
    primary: siteConfig('FARM_COLOR_PRIMARY', null, CONFIG),
    accent: siteConfig('FARM_COLOR_ACCENT', null, CONFIG),
    number: siteConfig('FARM_COLOR_NUMBER', null, CONFIG),
    bg: siteConfig('FARM_COLOR_BG', null, CONFIG),
    ink: siteConfig('FARM_COLOR_INK', null, CONFIG)
  }
}

function Footer() {
  const logo = siteConfig('FARM_LOGO', null, CONFIG)
  return (
    <footer className='fm-footer'>
      {logo && <img src={logo} alt='' />}
      {siteConfig('FARM_FOOTER_TEXT', null, CONFIG)}
    </footer>
  )
}

/**
 * 基础布局
 */
const LayoutBase = props => {
  const { children } = props
  const colors = useColors()
  return (
    <div id='theme-farm'>
      <Style colors={colors} />
      {children}
      <Footer />
    </div>
  )
}

/**
 * 首页：按 Notion 板块渲染
 */
const LayoutIndex = props => {
  const { posts = [] } = props
  const category = siteConfig('FARM_SECTION_CATEGORY', null, CONFIG)
  const logo = siteConfig('FARM_LOGO', null, CONFIG)
  const heroBg = siteConfig('FARM_HERO_BG', null, CONFIG)
  const showNav = `${siteConfig('FARM_SHOW_NAV', true, CONFIG)}` !== 'false'

  const sections = useMemo(
    () =>
      posts
        .filter(p => !category || !p.category || p.category === category)
        .map(p => ({ post: p, kind: styleOf(p), data: parseSection(p) })),
    [posts, category]
  )

  const hero = sections.find(s => s.kind === 'hero')
  const body = sections.filter(s => s.kind !== 'hero')
  const navItems = body.filter(s => s.post.icon && s.post.slug)

  // 有 icon（导航名）的板块是「大板块」，带编号；没有的作为上一个板块的子板块
  let no = 0

  return (
    <>
      {hero && <Hero {...hero} logo={logo} heroBg={heroBg} />}
      {showNav && navItems.length > 0 && (
        <nav className='fm-nav' aria-label='页面导航'>
          <div className='fm-nav-in'>
            {navItems.map(s => (
              <a key={s.post.id} href={`#${s.post.slug}`}>
                {s.post.icon}
              </a>
            ))}
          </div>
        </nav>
      )}
      <main className='fm-main'>
        {body.map(({ post, kind, data }) => {
          const Comp = RENDER[kind] || Free
          const major = Boolean(post.icon)
          if (major) no += 1
          return (
            <section key={post.id} id={post.slug || post.id} className={`fm-sec ${major ? '' : 'fm-sub'}`}>
              {major ? (
                <SectionHead post={post} index={no} />
              ) : (
                <h3 className='fm-subh'>
                  {post.title}
                  {post.summary && kind !== 'donut' && <small>{post.summary}</small>}
                </h3>
              )}
              <Comp post={post} data={data} />
            </section>
          )
        })}
      </main>
    </>
  )
}

/**
 * 单页（直接打开某个板块或其它页面时）
 */
const LayoutSlug = props => {
  const { post } = props
  if (!post) return <div className='fm-article'>页面不存在</div>
  return (
    <div className='fm-article'>
      <Link className='fm-back' href='/'>
        ‹ 返回首页
      </Link>
      <h1 className='fm-sh' style={{ fontSize: 32, fontWeight: 900, marginBottom: 16 }}>
        {post.title}
      </h1>
      <div className='fm-card'>
        <NotionPage post={post} />
      </div>
    </div>
  )
}

const Simple = () => (
  <div className='fm-article'>
    <Link className='fm-back' href='/'>
      ‹ 返回首页
    </Link>
  </div>
)

const Layout404 = Simple
const LayoutSearch = Simple
const LayoutArchive = Simple
const LayoutCategoryIndex = Simple
const LayoutPostList = Simple
const LayoutTagIndex = Simple

export {
  Layout404,
  LayoutArchive,
  LayoutBase,
  LayoutCategoryIndex,
  LayoutIndex,
  LayoutPostList,
  LayoutSearch,
  LayoutSlug,
  LayoutTagIndex,
  CONFIG as THEME_CONFIG
}
