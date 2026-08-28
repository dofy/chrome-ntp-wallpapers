/**
 * Hand-rolled icon set. Round caps and a chunky stroke read friendlier than a
 * geometric icon library, and inlining keeps the app dependency-free.
 */
interface IconProps {
  className?: string
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.1,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const Search = ({ className = 'size-4' }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
)

export const Close = ({ className = 'size-4' }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const Sparkle = ({ className = 'size-4' }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 3.5c.6 3.4 1.6 4.4 5 5-3.4.6-4.4 1.6-5 5-.6-3.4-1.6-4.4-5-5 3.4-.6 4.4-1.6 5-5Z" />
    <path d="M18.5 15c.25 1.4.7 1.85 2.1 2.1-1.4.25-1.85.7-2.1 2.1-.25-1.4-.7-1.85-2.1-2.1 1.4-.25 1.85-.7 2.1-2.1Z" />
  </svg>
)

export const Shuffle = ({ className = 'size-4' }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M3 7h3.5c1.3 0 2 .7 3 2l5 6c1 1.3 1.7 2 3 2H21" />
    <path d="M18 3.5 21 7l-3 3.5" />
    <path d="M3 17h3.5c1.3 0 2-.7 3-2l1-1.2" />
    <path d="M18 13.5 21 17l-3 3.5" />
  </svg>
)

export const Download = ({ className = 'size-4' }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 4v10" />
    <path d="m8 10.5 4 4 4-4" />
    <path d="M5 18.5h14" />
  </svg>
)

export const Copy = ({ className = 'size-4' }: IconProps) => (
  <svg {...base} className={className}>
    <rect x="9" y="9" width="11" height="11" rx="3" />
    <path d="M15 5.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 5.5 15" />
  </svg>
)

export const Check = ({ className = 'size-4' }: IconProps) => (
  <svg {...base} className={className}>
    <path d="m5 13 4.5 4.5L19 7" />
  </svg>
)

export const ChevronLeft = ({ className = 'size-5' }: IconProps) => (
  <svg {...base} className={className}>
    <path d="m14.5 6-6 6 6 6" />
  </svg>
)

export const ChevronRight = ({ className = 'size-5' }: IconProps) => (
  <svg {...base} className={className}>
    <path d="m9.5 6 6 6-6 6" />
  </svg>
)

export const Folder = ({ className = 'size-4' }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M3.5 8.5c0-1.7 0-2.5.6-3 .5-.5 1.2-.5 2.6-.5h1.1c.7 0 1 0 1.3.2.3.1.5.4.9.9l.5.7h5c1.7 0 2.5 0 3 .6.5.5.5 1.3.5 2.9v4.2c0 1.7 0 2.5-.6 3-.5.5-1.3.5-3 .5H7c-1.7 0-2.5 0-3-.6-.5-.5-.5-1.3-.5-2.9V8.5Z" />
  </svg>
)

export const Brush = ({ className = 'size-4' }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M18.5 3.8a2.2 2.2 0 0 1 1.7 3.7l-6.4 7.2-3.5-3.1 6.1-7.1a2.2 2.2 0 0 1 2.1-.7Z" />
    <path d="M10.3 11.6c-1.9 1.1-2.3 3-2.6 4.3-.2 1-.9 1.6-2.2 1.9 1.4 1.7 4 2.5 5.9 1.2 1.6-1.1 1.9-3 1.3-4.5" />
  </svg>
)

export const SortIcon = ({ className = 'size-4' }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 7h11M4 12h8M4 17h5" />
    <path d="M17.5 10.5 20 8l2.5 2.5" transform="translate(-2 3)" />
  </svg>
)

export const External = ({ className = 'size-4' }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M13 5h6v6" />
    <path d="M19 5l-8 8" />
    <path d="M18 14.5v2.8c0 1.2-1 2.2-2.2 2.2H6.7c-1.2 0-2.2-1-2.2-2.2V8.2C4.5 7 5.5 6 6.7 6h2.8" />
  </svg>
)

export const Broom = ({ className = 'size-4' }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M15.5 4 20 8.5" />
    <path d="m9 14.5 5.5-5.5 3 3L12 17.5" />
    <path d="M9 14.5c-1.6 1-2.6 2.4-3 4 1.9.9 4.2.5 6-1.2" />
  </svg>
)

export const Heart = ({ className = 'size-4' }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M12 19.5c-1-.8-6.5-4.3-6.5-8.6A3.9 3.9 0 0 1 12 8.3a3.9 3.9 0 0 1 6.5 2.6c0 4.3-5.5 7.8-6.5 8.6Z" />
  </svg>
)

export const ChevronDown = ({ className = 'size-4' }: IconProps) => (
  <svg {...base} className={className}>
    <path d="m6 9.5 6 6 6-6" />
  </svg>
)
