/* eslint-disable @next/next/no-img-element */
import NotionPage from '@/components/NotionPage'
import { segments } from './notion'

/** 富文本 */
export function Rich({ title }) {
  return (
    <>
      {segments(title).map((s, i) => {
        let el = s.text
        if (s.bold) el = <b>{el}</b>
        if (s.italic) el = <i>{el}</i>
        if (s.href)
          el = (
            <a href={s.href} target='_blank' rel='noopener noreferrer'>
              {el}
            </a>
          )
        return <span key={i}>{el}</span>
      })}
    </>
  )
}

function Icon({ icon, className = '' }) {
  if (!icon) return null
  if (icon.type === 'image')
    return <img className={`fm-icon-img ${className}`} src={icon.src} alt='' />
  return (
    <span className={`fm-icon ${className}`} aria-hidden='true'>
      {icon.text}
    </span>
  )
}

function Intro({ data }) {
  if (!data.intro.length) return null
  return (
    <div className='fm-card fm-intro'>
      {data.intro.map((t, i) => (
        <p key={i}>
          <Rich title={t} />
        </p>
      ))}
    </div>
  )
}

function Desc({ card }) {
  return card.desc.map((t, i) => (
    <span key={i} className='fm-desc'>
      <Rich title={t} />
    </span>
  ))
}

/** 板块标题 */
export function SectionHead({ post, index }) {
  return (
    <div className='fm-sh'>
      <div className='fm-n'>{index}</div>
      <h2>{post.title}</h2>
      {post.summary && <div className='fm-en'>{post.summary}</div>}
    </div>
  )
}

/* ---------- 各样式 ---------- */

export function Hero({ post, data, logo, heroBg }) {
  const bg = data.images[0] || post.pageCover || heroBg
  return (
    <header className='fm-hero' style={{ backgroundImage: `url("${bg}")` }}>
      <div className='fm-hero-in'>
        {logo && <img className='fm-logo' src={logo} alt={post.title} />}
        <h1 className='fm-title' aria-label={post.title}>
          <span className='o' aria-hidden='true'>{post.title}</span>
          <span className='m' aria-hidden='true'>{post.title}</span>
          <span className='f' aria-hidden='true'>{post.title}</span>
        </h1>
        {post.summary && (
          <div>
            <span className='fm-tagline'>{post.summary}</span>
          </div>
        )}
        {data.intro.map((t, i) => (
          <p key={i} className='fm-hero-sub'>
            <Rich title={t} />
          </p>
        ))}
      </div>
    </header>
  )
}

export function Stats({ data }) {
  return (
    <>
      <Intro data={data} />
      <div className='fm-k4'>
        {data.cards.map(c => (
          <div key={c.id} className='fm-k'>
            {c.image ? <img src={c.image} alt='' className='fm-k-img' /> : <Icon icon={c.icon} className='fm-k-ic' />}
            <b>{c.head}</b>
            <Desc card={c} />
          </div>
        ))}
      </div>
    </>
  )
}

export function Steps({ data }) {
  return (
    <>
      <Intro data={data} />
      <ol className='fm-steps'>
        {data.cards.map((c, i) => (
          <li key={c.id} className='fm-st'>
            <div className='fm-no'>{i + 1}</div>
            <div className='fm-st-ic'>
              {c.image ? <img src={c.image} alt='' /> : <Icon icon={c.icon} />}
            </div>
            <div className='fm-min'>
              <h3>{c.head}</h3>
              <Desc card={c} />
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}

export function Highlights({ data }) {
  return (
    <>
      <Intro data={data} />
      <div className='fm-g3'>
        {data.cards.map(c => (
          <div key={c.id} className={`fm-hl t-${c.tone}`}>
            <Icon icon={c.icon} />
            <b>{c.head}</b>
            <Desc card={c} />
          </div>
        ))}
      </div>
    </>
  )
}

export function BigNumbers({ data }) {
  return (
    <>
      <Intro data={data} />
      <div className='fm-big'>
        {data.cards.map(c => (
          <div key={c.id} className={`fm-bg t-${c.tone}`}>
            <b className={c.head.length > 4 ? 'long' : ''}>{c.head}</b>
            <Desc card={c} />
          </div>
        ))}
      </div>
    </>
  )
}

const PIE = ['var(--fm-primary)', 'var(--fm-accent)', '#FF7A59', '#5BB8E8', '#B98AE0', '#8A5A2B']

export function Donut({ post, data }) {
  const rows = (data.tables[0] || [])
    .map(r => ({ label: r[0], value: parseFloat(String(r[1]).replace('%', '')) || 0, raw: r[1] }))
    .filter(r => r.label)
  const total = rows.reduce((s, r) => s + r.value, 0) || 1
  let acc = 0
  const stops = rows
    .map((r, i) => {
      const from = (acc / total) * 100
      acc += r.value
      const to = (acc / total) * 100
      return `${PIE[i % PIE.length]} ${from}% ${to}%`
    })
    .join(',')
  return (
    <>
      <Intro data={data} />
      <div className='fm-card fm-alloc'>
        <div className='fm-donut' style={{ background: `conic-gradient(${stops})` }} role='img'
          aria-label={rows.map(r => `${r.label} ${r.raw}`).join('，')}>
          <span>{post.summary || ''}</span>
        </div>
        <div className='fm-legend'>
          {rows.map((r, i) => (
            <div key={i} className='fm-lg'>
              <i style={{ background: PIE[i % PIE.length] }} />
              <b>{/%$/.test(String(r.raw)) ? r.raw : `${r.raw}%`}</b>
              <span>{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export function InfoList({ data }) {
  return (
    <>
      <Intro data={data} />
      <div className='fm-rows'>
        {data.cards.map(c => (
          <div key={c.id} className='fm-row'>
            <div className={`fm-ri t-${c.tone}`}>
              {c.image ? <img src={c.image} alt='' /> : <Icon icon={c.icon} />}
            </div>
            <div className='fm-min'>
              <strong>{c.head}</strong>
              <Desc card={c} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export function Files({ data }) {
  return (
    <>
      <Intro data={data} />
      <div className='fm-mats'>
        {data.cards.map(c => {
          const f = c.files[0]
          const href = f?.url || c.link
          return (
            <article key={c.id} className='fm-mat'>
              <div className={`fm-ph t-${c.tone}`}>
                {c.image ? <img src={c.image} alt={c.head} /> : <Icon icon={c.icon} className='fm-ph-ic' />}
              </div>
              <div className='fm-mb'>
                <h3>{c.head}</h3>
                <p>
                  <Desc card={c} />
                </p>
                {href && (
                  <a className={`fm-btn ${f ? '' : 'g'}`} href={href} target='_blank' rel='noopener noreferrer'>
                    {f ? `下载${f.size ? ' · ' + f.size : ''}` : '打开'}
                  </a>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}

export function Links({ data }) {
  return (
    <>
      <Intro data={data} />
      <div className='fm-links'>
        {data.cards.map(c => {
          const Tag = c.link ? 'a' : 'div'
          return (
            <Tag key={c.id} className={`fm-ln ${c.link ? '' : 'off'}`}
              {...(c.link ? { href: c.link, target: '_blank', rel: 'noopener noreferrer' } : {})}>
              <Icon icon={c.icon} />
              <b>{c.head}</b>
              <span>{c.link ? '打开 ›' : c.desc.length ? segments(c.desc[0]).map(s => s.text).join('') : '即将公布'}</span>
            </Tag>
          )
        })}
      </div>
    </>
  )
}

export function Free({ post }) {
  return (
    <div className='fm-card fm-free'>
      <NotionPage post={post} />
    </div>
  )
}
