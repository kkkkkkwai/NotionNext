'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, FolderKanban, Dna, BookOpen, Brain, Sparkles, Coins, Map, MessageSquare, Wand2, Rocket, Library, Megaphone, CalendarDays, ShieldCheck, ScanSearch, Palette, Languages, Cpu, Users, LogOut, ChevronDown, Plus, Menu, X, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/client'

export type NavProject = { id: string; name: string; logoUrl: string | null; tokenSymbol: string | null }

const projectNav = (id: string) => [
  { section: 'Project', items: [
    { href: `/projects/${id}`, label: 'Overview', icon: FolderKanban, exact: true },
    { href: `/projects/${id}/dna`, label: 'Project DNA', icon: Dna },
    { href: `/projects/${id}/knowledge`, label: 'Knowledge Base', icon: BookOpen },
    { href: `/projects/${id}/memory`, label: 'Memory', icon: Brain },
    { href: `/projects/${id}/narrative`, label: 'Narrative', icon: Sparkles },
    { href: `/projects/${id}/tokenomics`, label: 'Tokenomics', icon: Coins },
    { href: `/projects/${id}/roadmap`, label: 'Roadmap', icon: Map }
  ] },
  { section: 'AI', items: [{ href: `/projects/${id}/ask`, label: 'Ask Project AI', icon: MessageSquare }] },
  { section: 'Content', items: [
    { href: `/projects/${id}/generate`, label: 'Content Generator', icon: Wand2 },
    { href: `/projects/${id}/launch-kit`, label: 'Launch Kit', icon: Rocket },
    { href: `/projects/${id}/library`, label: 'Content Library', icon: Library }
  ] },
  { section: 'Campaign', items: [
    { href: `/projects/${id}/campaigns`, label: 'Campaigns', icon: Megaphone },
    { href: `/projects/${id}/calendar`, label: 'Content Calendar', icon: CalendarDays }
  ] },
  { section: 'Tools', items: [
    { href: `/projects/${id}/consistency`, label: 'Consistency Check', icon: ScanSearch },
    { href: `/projects/${id}/risk`, label: 'Risk Check', icon: ShieldCheck }
  ] }
]

const settingsNav = [
  { href: '/settings/brand', label: 'Brand', icon: Palette },
  { href: '/settings/languages', label: 'Languages', icon: Languages },
  { href: '/settings/ai-providers', label: 'AI Providers', icon: Cpu },
  { href: '/settings/usage', label: 'AI Usage', icon: BarChart3 },
  { href: '/settings/team', label: 'Team', icon: Users }
]

export function Sidebar({ projects, currentProjectId, user }: { projects: NavProject[]; currentProjectId?: string; user: { name: string; email: string } }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [switcher, setSwitcher] = useState(false)
  const current = projects.find((p) => p.id === currentProjectId)
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href))
  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }
  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-[11px] font-bold text-primary-text">W3</div>
          <div className="text-[13px] font-semibold leading-tight text-fg">Brand & Content OS</div>
        </Link>
        <button className="rounded-lg p-1 text-fg-muted hover:text-fg lg:hidden" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
      </div>
      <div className="px-3 pt-2">
        <div className="relative">
          <button onClick={() => setSwitcher((s) => !s)} className="flex w-full items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-2.5 py-2 text-left hover:border-line-strong">
            <ProjectAvatar project={current} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-fg">{current?.name ?? 'Select project'}</div>
              <div className="truncate text-[11px] text-fg-dim">{current ? current.tokenSymbol ? `$${current.tokenSymbol.replace(/^\$/, '')}` : 'Project AI Brain' : `${projects.length} projects`}</div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-fg-dim" />
          </button>
          {switcher ? (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-bg-soft p-1 shadow-soft">
              {projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} onClick={() => { setSwitcher(false); setOpen(false) }} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-white/[0.05]', p.id === currentProjectId ? 'text-fg' : 'text-fg-muted')}>
                  <ProjectAvatar project={p} size="sm" /><span className="truncate">{p.name}</span>
                </Link>
              ))}
              <Link href="/projects/new" onClick={() => { setSwitcher(false); setOpen(false) }} className="mt-1 flex items-center gap-2 rounded-lg border-t border-line px-2 py-2 text-[13px] text-primary hover:bg-white/[0.05]"><Plus className="h-3.5 w-3.5" /> New Project</Link>
            </div>
          ) : null}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="nav-section">Home</div>
        <Link href="/dashboard" onClick={() => setOpen(false)} className={cn('nav-item', isActive('/dashboard') && 'active')}><LayoutDashboard className="h-4 w-4" /> Dashboard</Link>
        {current ? projectNav(current.id).map((g) => (
          <div key={g.section}>
            <div className="nav-section">{g.section}</div>
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className={cn('nav-item', isActive(it.href, it.exact) && 'active')}><it.icon className="h-4 w-4" /> {it.label}</Link>
            ))}
          </div>
        )) : (
          <div className="mt-4 rounded-xl border border-dashed border-line p-3 text-[12px] text-fg-dim">Create or select a project to unlock its AI brain, memory and content tools.</div>
        )}
        <div className="nav-section">Settings</div>
        {settingsNav.map((it) => (
          <Link key={it.href} href={it.href} onClick={() => setOpen(false)} className={cn('nav-item', isActive(it.href) && 'active')}><it.icon className="h-4 w-4" /> {it.label}</Link>
        ))}
      </nav>
      <div className="border-t border-line px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-semibold uppercase text-fg-muted">{(user.name || user.email).slice(0, 1)}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] text-fg">{user.name || user.email}</div>
            <div className="truncate text-[11px] text-fg-dim">{user.email}</div>
          </div>
          <button onClick={logout} title="Sign out" className="rounded-lg p-1.5 text-fg-dim hover:bg-white/[0.05] hover:text-fg"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  )
  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed left-3 top-3 z-40 rounded-lg border border-line bg-bg-soft p-2 text-fg-muted lg:hidden" aria-label="Open menu"><Menu className="h-4 w-4" /></button>
      <aside className="hidden w-[248px] shrink-0 border-r border-line bg-bg-soft/60 lg:block">{content}</aside>
      {open ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-[270px] bg-bg-soft">{content}</div>
          <div className="flex-1 bg-black/60" onClick={() => setOpen(false)} />
        </div>
      ) : null}
    </>
  )
}

export function ProjectAvatar({ project, size = 'md' }: { project?: { name: string; logoUrl: string | null } | null; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'h-5 w-5 text-[9px]' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-7 w-7 text-[11px]'
  if (project?.logoUrl) return <img src={project.logoUrl} alt="" className={cn('shrink-0 rounded-lg object-cover', s)} />
  return <div className={cn('flex shrink-0 items-center justify-center rounded-lg bg-primary/15 font-semibold uppercase text-primary', s)}>{project?.name?.slice(0, 2) ?? '—'}</div>
}
