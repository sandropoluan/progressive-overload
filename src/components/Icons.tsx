import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base: P = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const Plus = (p: P) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
)
export const Minus = (p: P) => (
  <svg {...base} {...p}><path d="M5 12h14" /></svg>
)
export const ChevronLeft = (p: P) => (
  <svg {...base} {...p}><path d="m15 18-6-6 6-6" /></svg>
)
export const ChevronRight = (p: P) => (
  <svg {...base} {...p}><path d="m9 18 6-6-6-6" /></svg>
)
export const Search = (p: P) => (
  <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
export const Settings = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
)
export const Trash = (p: P) => (
  <svg {...base} {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg>
)
export const Edit = (p: P) => (
  <svg {...base} {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
)
export const TrendUp = (p: P) => (
  <svg {...base} {...p}><path d="m22 7-8.5 8.5-5-5L2 17M16 7h6v6" /></svg>
)
export const ArrowUp = (p: P) => (
  <svg {...base} {...p}><path d="M12 19V5m-7 7 7-7 7 7" /></svg>
)
export const ArrowDown = (p: P) => (
  <svg {...base} {...p}><path d="M12 5v14m7-7-7 7-7-7" /></svg>
)
export const Dash = (p: P) => (
  <svg {...base} {...p}><path d="M5 12h14" /></svg>
)
export const Trophy = (p: P) => (
  <svg {...base} {...p}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0ZM7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5" /></svg>
)
export const Sparkle = (p: P) => (
  <svg {...base} {...p}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /><circle cx="12" cy="12" r="3" /></svg>
)
export const Download = (p: P) => (
  <svg {...base} {...p}><path d="M12 3v12m-5-5 5 5 5-5M4 21h16" /></svg>
)
export const Upload = (p: P) => (
  <svg {...base} {...p}><path d="M12 15V3m-5 5 5-5 5 5M4 21h16" /></svg>
)
export const Check = (p: P) => (
  <svg {...base} {...p}><path d="m5 12 5 5L20 7" /></svg>
)
export const Calendar = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
)
export const Dumbbell = (p: P) => (
  <svg {...base} {...p}><path d="M6 5v14M18 5v14M3 8v8M21 8v8M6 12h12" /></svg>
)
export const Target = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
)
