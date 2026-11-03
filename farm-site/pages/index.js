/* eslint-disable @next/next/no-img-element */
/**
 * 欢乐农场官网首页：完全由 Notion「欢乐农场官网后台」数据库驱动
 *  - 每个 Published 的行 = 一个板块，按 order 从小到大排列
 *  - tags 决定板块样式；icon 填了就出现在顶部导航，并作为带编号的大板块
 *  - 颜色、Logo、页脚等在「站点设置」里的配置表修改
 */
import Head from 'next/head'
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
} from '@/components/Sections'
import { Style } from '@/components/style'
import DEFAULTS from '@/lib/defaults'
import { getSite } from '@/lib/notion'

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
const kindOf = s => STYLE_MAP[s.tags.find(t => STYLE_MAP[t])] || 'free'

export default function Home({ config, sections }) {
  const c = { ...DEFAULTS, ...config }
  const colors = {
    primary: c.FARM_COLOR_PRIMARY,
    accent: c.FARM_COLOR_ACCENT,
    number: c.FARM_COLOR_NUMBER,
    bg: c.FARM_COLOR_BG,
    ink: c.FARM_COLOR_INK
  }
  const list = sections
    .filter(s => !c.FARM_SECTION_CATEGORY || !s.category || s.category === c.FARM_SECTION_CATEGORY)
    .map(s => ({ ...s, kind: kindOf(s) }))
  const hero = list.find(s => s.kind === 'hero')
  const body = list.filter(s => s.kind !== 'hero')
  const nav = body.filter(s => s.nav)
  let no = 0

  return (
    <div id='theme-farm'>
      <Head>
        <title>{c.TITLE}</title>
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        {c.DESCRIPTION && <meta name='description' content={c.DESCRIPTION} />}
        <meta property='og:title' content={c.TITLE} />
      </Head>
      <Style colors={colors} />
      {hero && <Hero post={hero} data={hero.data} logo={c.FARM_LOGO} heroBg={c.FARM_HERO_BG} />}
      {c.FARM_SHOW_NAV !== 'false' && nav.length > 0 && (
        <nav className='fm-nav' aria-label='页面导航'>
          <div className='fm-nav-in'>
            {nav.map(s => (
              <a key={s.id} href={`#${s.slug}`}>
                {s.nav}
              </a>
            ))}
          </div>
        </nav>
      )}
      <main className='fm-main'>
        {body.map(s => {
          const Comp = RENDER[s.kind] || Free
          const major = Boolean(s.nav)
          if (major) no += 1
          return (
            <section key={s.id} id={s.slug} className={`fm-sec ${major ? '' : 'fm-sub'}`}>
              {major ? (
                <SectionHead post={s} index={no} />
              ) : (
                <h3 className='fm-subh'>
                  {s.title}
                  {s.summary && s.kind !== 'donut' && <small>{s.summary}</small>}
                </h3>
              )}
              <Comp post={s} data={s.data} />
            </section>
          )
        })}
      </main>
      <footer className='fm-footer'>
        {c.FARM_LOGO && <img src={c.FARM_LOGO} alt='' />}
        {c.FARM_FOOTER_TEXT}
      </footer>
    </div>
  )
}

export async function getStaticProps() {
  const site = await getSite()
  // 每 60 秒最多重新读取一次 Notion：在 Notion 改完内容，约 1 分钟后网站自动更新
  return { props: site, revalidate: 60 }
}
