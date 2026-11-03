/* eslint-disable react/no-unknown-property */
/**
 * 欢乐农场主题样式（只对本主题生效）
 * 颜色来自 Notion「站点设置」，通过 CSS 变量注入
 */
const Style = ({ colors }) => {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=ZCOOL+QingKe+HuangYou&display=swap');

      #theme-farm {
        --fm-primary: ${colors.primary};
        --fm-accent: ${colors.accent};
        --fm-number: ${colors.number};
        --fm-bg: ${colors.bg};
        --fm-ink: ${colors.ink};
        --fm-text: #3a4a3e;
        --fm-muted: #6e7f72;
        --fm-cream: #fffbf1;
        --fm-line: #f0dfb8;
        --fm-mint: #ddf5ea;
        --fm-mint2: #b9ebd3;
        --fm-yolk-l: #fff3cc;
        --fm-coral-l: #ffe9e1;
        --fm-sky: #e3f2fc;
        --fm-display: 'ZCOOL QingKe HuangYou', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
        --fm-body: 'Noto Sans SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
        background: var(--fm-bg);
        color: var(--fm-text);
        font-family: var(--fm-body);
        font-size: 15px;
        line-height: 1.6;
        min-height: 100vh;
        -webkit-font-smoothing: antialiased;
      }
      html { scroll-behavior: smooth; }
      @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
      #theme-farm img { display: block; max-width: 100%; }
      #theme-farm a { color: inherit; }
      #theme-farm h1, #theme-farm h2, #theme-farm h3, #theme-farm p { margin: 0; }

      /* hero */
      .fm-hero { position: relative; overflow: hidden; background-color: #8fd3f4; background-size: cover; background-position: center 70%; padding: 28px 16px 92px; text-align: center; }
      .fm-hero::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 120px; background: linear-gradient(to bottom, transparent, var(--fm-bg)); }
      .fm-hero-in { position: relative; z-index: 1; max-width: 760px; margin: 0 auto; }
      .fm-logo { width: min(210px, 52vw); margin: 0 auto 6px; filter: drop-shadow(0 6px 10px rgba(40, 70, 30, 0.25)); }
      .fm-title { position: relative; display: inline-block; font-family: var(--fm-display); font-weight: 400; font-size: clamp(46px, 12vw, 78px); line-height: 1.1; letter-spacing: 3px; margin-top: 4px !important; }
      .fm-title span { display: block; }
      .fm-title .o { position: absolute; inset: 0; color: #fff; -webkit-text-stroke: 14px #fff; text-shadow: 0 6px 0 rgba(90, 64, 32, 0.18); }
      .fm-title .m { position: absolute; inset: 0; color: #8a4b00; -webkit-text-stroke: 7px #a85a00; }
      .fm-title .f { position: relative; background: linear-gradient(#fff07a 15%, #ffc21a 55%, #f08a00); -webkit-background-clip: text; background-clip: text; color: transparent; }
      .fm-tagline { display: inline-block; margin-top: 16px; padding: 9px 22px; border-radius: 999px; background: linear-gradient(#ffe07a, #ffb81c); color: #6b3e00; font-weight: 900; font-size: clamp(14px, 3.8vw, 18px); border: 3px solid #fff; box-shadow: 0 4px 0 #e2950a, 0 10px 20px rgba(120, 80, 0, 0.18); }
      .fm-hero-sub { margin: 14px auto 0 !important; max-width: 30em; color: #fff; font-weight: 700; font-size: clamp(13px, 3.5vw, 16px); text-shadow: 0 1px 0 #2e8b57, 0 0 10px rgba(30, 90, 50, 0.7); }

      /* nav */
      .fm-nav { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--fm-bg) 92%, transparent); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border-bottom: 1px solid var(--fm-mint2); }
      .fm-nav-in { max-width: 760px; margin: 0 auto; display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 10px 16px; }
      .fm-nav-in::-webkit-scrollbar { display: none; }
      .fm-nav a { flex: none; text-decoration: none; font-weight: 900; font-size: 14px; color: var(--fm-primary); background: #fff; border: 2px solid var(--fm-mint2); padding: 6px 14px; border-radius: 999px; }
      .fm-nav a:hover, .fm-nav a:focus-visible { background: var(--fm-yolk-l); border-color: var(--fm-accent); color: #6b3e00; outline: none; }

      /* layout */
      .fm-main { max-width: 760px; margin: 0 auto; padding: 8px 16px 40px; display: flex; flex-direction: column; gap: 44px; }
      .fm-sec { scroll-margin-top: 64px; display: flex; flex-direction: column; gap: 16px; }
      .fm-sec.fm-sub { margin-top: -28px; }
      .fm-sh { display: flex; align-items: center; gap: 12px; }
      .fm-n { flex: none; width: 46px; height: 46px; border-radius: 50%; background: linear-gradient(color-mix(in srgb, var(--fm-primary) 80%, #fff), var(--fm-primary)); color: #fff; font-weight: 900; font-size: 22px; display: grid; place-items: center; border: 3px solid #fff; box-shadow: 0 4px 0 color-mix(in srgb, var(--fm-primary) 70%, #000); }
      .fm-sh h2 { font-family: var(--fm-display); font-weight: 400; font-size: clamp(30px, 8vw, 40px); color: var(--fm-ink); letter-spacing: 1px; -webkit-text-stroke: 6px #fff; paint-order: stroke fill; line-height: 1.15; }
      .fm-en { margin-left: auto; font-size: 11px; font-weight: 900; letter-spacing: 0.18em; color: var(--fm-primary); opacity: 0.6; text-transform: uppercase; }
      .fm-subh { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 900; color: var(--fm-ink); }
      .fm-subh::before { content: ''; width: 8px; height: 22px; border-radius: 4px; background: var(--fm-accent); }
      .fm-subh small { margin-left: 4px; font-size: 12px; font-weight: 700; color: var(--fm-muted); }
      .fm-card { background: var(--fm-cream); border: 3px solid #fff; border-radius: 26px; padding: 20px 22px; box-shadow: 0 5px 0 var(--fm-line), 0 12px 26px rgba(60, 90, 60, 0.08); }
      .fm-intro p { font-size: 16px; line-height: 1.85; }
      .fm-intro p + p { margin-top: 8px; }
      .fm-intro b { color: var(--fm-primary); font-weight: 900; }
      .fm-min { min-width: 0; }
      .fm-desc { display: block; }
      .fm-icon { font-size: 28px; line-height: 1; }
      .fm-icon-img { width: 40px; height: 40px; object-fit: contain; }
      .t-y { background: var(--fm-yolk-l); } .t-m { background: var(--fm-mint); } .t-r { background: var(--fm-coral-l); } .t-s { background: var(--fm-sky); } .t-n { background: #fff; }

      /* stats */
      .fm-k4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .fm-k { min-width: 0; background: #fff; border: 2px solid var(--fm-line); border-radius: 20px; padding: 14px 6px 12px; text-align: center; }
      .fm-k .fm-icon { display: block; font-size: 36px; margin-bottom: 4px; }
      .fm-k-img { width: 46px; height: 46px; object-fit: contain; margin: 0 auto 4px; }
      .fm-k b { display: block; font-size: clamp(20px, 5.6vw, 28px); font-weight: 900; color: var(--fm-number); line-height: 1.15; font-variant-numeric: tabular-nums; }
      .fm-k .fm-desc { font-size: 12px; font-weight: 700; color: var(--fm-ink); }

      /* highlights */
      .fm-g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
      .fm-hl { min-width: 0; border-radius: 20px; padding: 16px 8px; text-align: center; }
      .fm-hl .fm-icon { font-size: 30px; }
      .fm-hl .fm-icon-img { margin: 0 auto; }
      .fm-hl b { display: block; font-size: 15px; font-weight: 900; color: var(--fm-ink); margin: 8px 0 2px; }
      .fm-hl .fm-desc { font-size: 12px; font-weight: 700; color: var(--fm-muted); }

      /* steps */
      .fm-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
      .fm-st { display: flex; align-items: center; gap: 14px; background: #fff; border: 2px solid var(--fm-line); border-radius: 22px; padding: 14px 16px; box-shadow: 0 3px 0 var(--fm-line); }
      .fm-no { flex: none; width: 26px; font-family: var(--fm-display); font-size: 34px; color: #fff; -webkit-text-stroke: 6px var(--fm-primary); paint-order: stroke fill; text-align: center; line-height: 1; }
      .fm-st-ic { flex: none; width: 62px; height: 62px; border-radius: 50%; background: var(--fm-yolk-l); display: grid; place-items: center; }
      .fm-st-ic img { width: 46px; height: 46px; object-fit: contain; }
      .fm-st-ic .fm-icon { font-size: 32px; }
      .fm-st h3 { font-size: 17px; font-weight: 900; color: var(--fm-ink); margin-bottom: 2px !important; }
      .fm-st .fm-desc { font-size: 14px; line-height: 1.6; }

      /* big numbers */
      .fm-big { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 10px; }
      .fm-bg { min-width: 0; border-radius: 22px; padding: 16px 6px; text-align: center; border: 3px solid #fff; box-shadow: 0 4px 0 rgba(0, 0, 0, 0.05); }
      .fm-bg b { display: block; font-size: clamp(28px, 8vw, 40px); font-weight: 900; line-height: 1.1; color: var(--fm-number); font-variant-numeric: tabular-nums; }
      .fm-bg b.long { font-size: clamp(20px, 5.6vw, 30px); }
      .fm-bg.t-m b { color: color-mix(in srgb, var(--fm-primary) 80%, #000); }
      .fm-bg.t-r b { color: #f0603e; }
      .fm-bg.t-s b { color: #3a9ad0; }
      .fm-bg .fm-desc { margin-top: 4px; font-size: 12px; font-weight: 700; color: var(--fm-ink); line-height: 1.5; }

      /* donut */
      .fm-alloc { display: flex; align-items: center; gap: 20px; }
      .fm-donut { flex: none; width: 150px; height: 150px; border-radius: 50%; position: relative; }
      .fm-donut::after { content: ''; position: absolute; inset: 32px; border-radius: 50%; background: var(--fm-cream); }
      .fm-donut span { position: absolute; inset: 40px; z-index: 1; display: grid; place-items: center; text-align: center; font-size: 13px; font-weight: 900; color: var(--fm-ink); line-height: 1.35; }
      .fm-legend { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
      .fm-lg { display: flex; align-items: center; gap: 10px; background: #fff; border: 2px solid var(--fm-line); border-radius: 14px; padding: 7px 12px; }
      .fm-lg i { flex: none; width: 12px; height: 12px; border-radius: 4px; }
      .fm-lg b { width: 50px; font-size: 18px; font-weight: 900; color: var(--fm-number); font-variant-numeric: tabular-nums; }
      .fm-lg span { font-size: 13px; font-weight: 700; color: var(--fm-ink); }

      /* info rows */
      .fm-rows { display: flex; flex-direction: column; gap: 10px; }
      .fm-row { display: flex; align-items: center; gap: 12px; background: #fff; border: 2px solid var(--fm-line); border-radius: 18px; padding: 12px 14px; }
      .fm-ri { flex: none; width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; }
      .fm-ri .fm-icon { font-size: 24px; }
      .fm-ri img { width: 34px; height: 34px; object-fit: contain; }
      .fm-row strong { display: block; font-size: 15px; font-weight: 900; color: var(--fm-ink); }
      .fm-row .fm-desc { font-size: 13px; color: var(--fm-muted); font-weight: 600; }

      /* files */
      .fm-mats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .fm-mat { min-width: 0; display: flex; flex-direction: column; background: #fff; border: 2px solid var(--fm-line); border-radius: 22px; overflow: hidden; box-shadow: 0 3px 0 var(--fm-line); }
      .fm-ph { aspect-ratio: 4 / 3; overflow: hidden; display: grid; place-items: center; }
      .fm-ph img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
      .fm-ph-ic { font-size: 48px; }
      .fm-mb { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 12px 12px 14px; }
      .fm-mb h3 { font-size: 15px; font-weight: 900; color: var(--fm-ink); line-height: 1.35; }
      .fm-mb p { flex: 1; font-size: 12px; color: var(--fm-muted); line-height: 1.5; }
      .fm-btn { align-self: flex-start; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; border: 3px solid #fff; border-radius: 999px; padding: 6px 14px; font-weight: 900; font-size: 13px; color: #6b3e00 !important; background: linear-gradient(#ffe07a, #ffbe2e); box-shadow: 0 3px 0 #e2a00a; }
      .fm-btn.g { color: #fff !important; background: linear-gradient(color-mix(in srgb, var(--fm-primary) 75%, #fff), var(--fm-primary)); box-shadow: 0 3px 0 color-mix(in srgb, var(--fm-primary) 70%, #000); }
      .fm-btn:active { transform: translateY(2px); }

      /* links */
      .fm-links { display: flex; flex-direction: column; gap: 8px; }
      .fm-ln { display: flex; align-items: center; gap: 12px; background: #fff; border: 2px solid var(--fm-line); border-radius: 18px; padding: 12px 16px; text-decoration: none; }
      a.fm-ln:hover { border-color: var(--fm-accent); background: var(--fm-yolk-l); }
      .fm-ln .fm-icon { font-size: 22px; }
      .fm-ln .fm-icon-img { width: 26px; height: 26px; }
      .fm-ln b { font-size: 15px; font-weight: 900; color: var(--fm-ink); }
      .fm-ln > span:last-child { margin-left: auto; font-size: 13px; font-weight: 700; color: var(--fm-primary); white-space: nowrap; }
      .fm-ln.off > span:last-child { color: var(--fm-muted); }

      .fm-free { display: grid; gap: 12px; }
      .fm-fh { font-size: 19px; font-weight: 900; color: var(--fm-ink); margin-top: 6px; }
      .fm-fh4 { font-size: 16px; font-weight: 700; color: var(--fm-ink); }
      .fm-fq { margin: 0; padding: 8px 14px; border-left: 4px solid var(--fm-accent); background: var(--fm-cream); border-radius: 8px; }
      .fm-fli { display: flex; gap: 8px; }
      .fm-fli > span { color: var(--fm-primary); font-weight: 900; }
      .fm-fc { display: flex; gap: 10px; padding: 12px 14px; border-radius: 14px; background: var(--fm-cream); }
      .fm-fc .fm-desc { display: block; color: var(--fm-muted); font-size: 14px; }
      .fm-fimg { width: 100%; border-radius: 14px; }
      .fm-flink { color: var(--fm-primary) !important; word-break: break-all; }
      .fm-ftable { display: grid; gap: 1px; background: var(--fm-line); border-radius: 12px; overflow: hidden; }
      .fm-ftr { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 1px; }
      .fm-ftr span { background: #fff; padding: 8px 10px; font-size: 14px; }
      .fm-fhr { border: 0; border-top: 1px dashed var(--fm-line); margin: 4px 0; }

      /* footer */
      .fm-footer { text-align: center; padding: 8px 16px 36px; font-size: 12px; color: var(--fm-muted); }
      .fm-footer img { width: 120px; margin: 0 auto 8px; opacity: 0.9; }

      /* article page */
      .fm-article { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; }
      .fm-back { display: inline-block; margin-bottom: 16px; font-weight: 900; color: var(--fm-primary) !important; text-decoration: none; }

      @media (max-width: 420px) {
        .fm-k4, .fm-g3 { grid-template-columns: repeat(2, 1fr); }
        .fm-alloc { flex-direction: column; }
        .fm-legend { width: 100%; }
        .fm-card { padding: 18px; }
      }
      @media (min-width: 640px) {
        .fm-mats { grid-template-columns: repeat(3, 1fr); }
      }
    `}</style>
  )
}

export { Style }
