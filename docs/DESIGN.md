# Lingua Nova Design Language

Apple-HIG-inspired design system for a dark, bilingual learning product.
Three principles: **Clarity**（信息层级清晰）, **Deference**（界面退后，内容优先）, **Depth**（材质与层级表达空间关系）.

This document is canonical: when component code disagrees with it, the component is wrong.

## Typography

- Font stack (tailwind `font-sans`): SF Pro on Apple platforms → PingFang SC for CJK → graceful fallbacks. Never leave CJK fallback to browser default.
- **Weights**: `font-semibold` is the maximum for all headings and display text. `font-extrabold`/`font-bold` are not used. Body emphasis uses color, not weight.
- **Title scale**:
  - Hero display: `text-5xl md:text-6xl font-semibold tracking-[-0.015em]`
  - Full-screen sheet title: `text-2xl font-semibold tracking-tight`
  - Dialog title: `text-xl font-semibold tracking-tight`
  - Section header (in-pane): `text-[17px] font-semibold tracking-tight text-zinc-100`
- **Reading surface** (transcript): EN is primary, zh is secondary — always exactly one hierarchy step apart:
  - EN: `text-base leading-relaxed tracking-normal`; active `text-zinc-50`, inactive `text-zinc-400`. State changes color only — **never weight** (no reflow).
  - zh: `text-[15px] leading-relaxed`; active `text-zinc-400`, inactive `text-zinc-500`.
- **Numbers/times**: `tabular-nums`, `text-[11px] font-medium`. No `font-mono`, no bracket decoration.
- **CJK rules**: no `italic` (PingFang has no italic face), no `uppercase`/`tracking-wider` on Chinese labels.

## Color

- Neutral ramp: zinc only. Text hierarchy: primary `zinc-50/100`, secondary `zinc-400`, tertiary `zinc-500`, disabled `zinc-600`.
- **One interactive accent**: blue (`blue-400/500`, brand token `#0A84FF` available as `brand`). Links, active timestamps, PiP, progress, focus.
- **Reserved hues** (semantic only):
  - violet/purple — AI vocabulary highlights only (class comes from stored data; do not repurpose)
  - emerald — success / processed / subscribed
  - amber — warning / dictation mode / favorites star
  - red — destructive
- **Hairlines**: `border-white/5` at rest, `border-white/10` emphasis/hover. No zinc-tinted borders (`border-zinc-700/50` etc. are forbidden).

## Materials

- Vibrancy glass via `.glass-panel` / `.glass-card` (blur + `saturate(180%)` + inset top catch-light). No fully opaque slabs adjacent to glass.
- Chrome bars (top bar, transcript toolbar, local-subtitle bar): `bg-zinc-950/60 backdrop-blur-xl border-b border-white/5`.
- Modal scrim (all modals): `bg-zinc-950/70 backdrop-blur-md`.
- Dialog surface: `bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl shadow-black/60`.
- Full-height sheet: `bg-zinc-900/80 backdrop-blur-2xl border-x border-white/10`.

## Geometry

Radius scale, tied to element size — same-size elements share curvature:

| Step | Use |
|---|---|
| `rounded-md` | segmented-control thumb, inline word highlight |
| `rounded-lg` | controls ≤36px tall, icon buttons, thumbnails, chips |
| `rounded-xl` | cards / list rows / buttons |
| `rounded-2xl` | floating surfaces: modals, popover, toasts, active transcript pill |
| `rounded-3xl` | page-level bento panels |
| `rounded-full` | pills (hero search bar, badges, close buttons) |

Logo tile: `rounded-[10px]` (Apple icon curvature at 40px). The arbitrary `rounded-[32px]` is retired.
Thumbnails: always `aspect-video rounded-lg`.

## Buttons

Four recipes (HIG: filled / gray / tinted / plain):

- **Primary**: `inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-zinc-100 text-zinc-900 text-sm font-semibold hover:bg-white active:scale-[0.98] transition-all duration-200` (hero submit keeps `rounded-full h-12 px-6` as the one sanctioned exception)
- **Secondary**: `inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-zinc-800/60 hover:bg-zinc-700/60 border border-white/5 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-colors` (compact variant `h-8 px-3 rounded-lg`)
- **Tinted**: `inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-{hue}-500/10 hover:bg-{hue}-500/15 border border-{hue}-500/20 text-{hue}-400 text-sm font-medium transition-colors`
- **Ghost text**: `h-10 px-5 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors`
- **Ghost icon**: `p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors`
- **Close (X)**: modal `p-2 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors` + `w-5 h-5`; popover/toast `p-1.5 rounded-full` + `w-4 h-4`

## Recipes

- **Segmented control** (one recipe everywhere — translation mode, vocab level, season tabs): container `inline-flex items-center rounded-lg bg-zinc-800/80 p-0.5 border border-white/5`; item `relative px-2.5 py-1 text-xs font-medium rounded-md transition-colors`; active label `text-zinc-900`, inactive `text-zinc-400 hover:text-zinc-200`; selection is a **sliding thumb**: `<motion.span layoutId="<unique>" className="absolute inset-0 bg-zinc-100 rounded-md shadow-sm" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />` with label in `relative z-10`.
- **List row** (history / updates / shows / model options): `p-3 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/60 border border-white/5 hover:border-white/10 transition-colors cursor-pointer`.
- **Badge**: `text-[11px] font-medium px-2 py-0.5 rounded-full` + tint (`bg-zinc-800 text-zinc-300` neutral, or hue-500/10 + hue-400).
- **Empty state**: wrapper `flex flex-col items-center justify-center py-16 text-center`; icon `w-10 h-10 text-zinc-700 mb-3`; title `text-sm font-medium text-zinc-400`; hint `text-xs text-zinc-600 mt-1`.
- **Modal anatomy**: header `px-6 py-5 border-b border-white/5` (title per scale above, subtitle `text-sm text-zinc-400 mt-0.5`); body `p-6`; footer `px-6 py-4 border-t border-white/5`.

## Motion

- Micro-interactions: `transition-colors duration-200` (or `ease-apple` = `cubic-bezier(0.25,1,0.5,1)` for transforms). Scope transitions — avoid `transition-all` unless several properties genuinely animate.
- Press feedback: `active:scale-[0.98]` (buttons), `whileTap={{ scale: 0.98 }}` (cards). **Hover never scales rows** — affordance comes from background/border change.
- Standard framer spring: `{ type: 'spring', stiffness: 380, damping: 32 }`; segmented thumbs `{ stiffness: 420, damping: 36 }`.
- Keyboard focus: global `:focus-visible` ring (blue), no per-component bespoke rings.
- Honor `prefers-reduced-motion` for decorative animation (aurora, particles).

## Iconography

lucide-react only — no hand-rolled inline SVGs. Optical sizes: `w-3.5` compact toolbar, `w-4` in-button/disclosure, `w-5` section header.
