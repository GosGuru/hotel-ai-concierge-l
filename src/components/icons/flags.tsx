import * as React from 'react'

type FlagProps = React.SVGProps<SVGSVGElement> & { title?: string }

const base = {
  width: 24,
  height: 16,
  viewBox: '0 0 24 16',
  role: 'img',
  focusable: 'false',
} as const

export const FlagUY: React.FC<FlagProps> = ({ title = 'Uruguay', ...props }) => (
  <svg {...base} {...props} aria-label={title}>
    <defs>
      <clipPath id="uy">
        <rect width="24" height="16" rx="2" ry="2" />
      </clipPath>
    </defs>
    <g clipPath="url(#uy)">
      <rect width="24" height="16" fill="#fff" />
      {[1,3,5,7].map((i) => (
        <rect key={i} y={i*2} width="24" height="2" fill="#3d8bfd" />
      ))}
      {/* Sun (simplified) */}
      <circle cx="5" cy="5" r="3.2" fill="#ffd43b" stroke="#e0a800" strokeWidth="0.5" />
    </g>
  </svg>
)

export const FlagUS: React.FC<FlagProps> = ({ title = 'United States', ...props }) => (
  <svg {...base} {...props} aria-label={title}>
    <defs>
      <clipPath id="us">
        <rect width="24" height="16" rx="2" ry="2" />
      </clipPath>
    </defs>
    <g clipPath="url(#us)">
      {[0,2,4,6,8,10,12,14].map((y) => (
        <rect key={y} y={y} width="24" height="1" fill="#bf0d3e" />
      ))}
      {[1,3,5,7,9,11,13].map((y) => (
        <rect key={y} y={y} width="24" height="1" fill="#fff" />
      ))}
      <rect width="10" height="7" fill="#002868" />
      {/* Simple stars grid */}
      {[...Array(3)].map((_, r) => (
        [...Array(4)].map((__, c) => (
          <circle key={`${r}-${c}`} cx={1.5 + c*2.2} cy={1.2 + r*2.3} r={0.2} fill="#fff" />
        ))
      ))}
    </g>
  </svg>
)

export const FlagFR: React.FC<FlagProps> = ({ title = 'France', ...props }) => (
  <svg {...base} {...props} aria-label={title}>
    <rect width="24" height="16" rx="2" ry="2" fill="#fff" />
    <rect width="8" height="16" fill="#002395" />
    <rect x="16" width="8" height="16" fill="#ed2939" />
  </svg>
)

export const FlagES: React.FC<FlagProps> = ({ title = 'Spain', ...props }) => (
  <svg {...base} {...props} aria-label={title}>
    <rect width="24" height="16" rx="2" ry="2" fill="#aa151b" />
    <rect y="4" width="24" height="8" fill="#f1bf00" />
    {/* Simplified coat area */}
    <rect x="5" y="6" width="3" height="4" fill="#aa151b" rx="0.5" />
  </svg>
)

export const FlagBR: React.FC<FlagProps> = ({ title = 'Brazil', ...props }) => (
  <svg {...base} {...props} aria-label={title}>
    <rect width="24" height="16" rx="2" ry="2" fill="#009b3a" />
    <polygon points="12,3 21,8 12,13 3,8" fill="#ffdf00" />
    <circle cx="12" cy="8" r="3.2" fill="#002776" />
    <path d="M9.2 8.2c1.6-.9 3-.9 5.6.1" stroke="#fff" strokeWidth="0.5" fill="none" />
  </svg>
)

export const FlagDE: React.FC<FlagProps> = ({ title = 'Germany', ...props }) => (
  <svg {...base} {...props} aria-label={title}>
    <rect width="24" height="16" rx="2" ry="2" fill="#000" />
    <rect y="5.33" width="24" height="5.33" fill="#dd0000" />
    <rect y="10.66" width="24" height="5.34" fill="#ffce00" />
  </svg>
)

export type FlagComponent = React.FC<FlagProps>
