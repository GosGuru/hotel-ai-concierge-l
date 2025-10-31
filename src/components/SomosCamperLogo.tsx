interface SomosCamperLogoProps {
  className?: string;
  size?: number;
}

export const SomosCamperLogo = ({ className = "", size = 40 }: SomosCamperLogoProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer circle - Dark blue */}
      <circle cx="100" cy="100" r="95" fill="#1a4d5c" stroke="#1a4d5c" strokeWidth="3" />
      
      {/* Middle circle - Turquoise */}
      <circle cx="100" cy="100" r="85" fill="#00d4d4" />
      
      {/* Inner circle - Dark blue */}
      <circle cx="100" cy="100" r="65" fill="#1a4d5c" />
      
      {/* Mountains - white */}
      <path
        d="M 50 85 L 70 55 L 85 75 L 75 85 Z"
        fill="white"
        opacity="0.9"
      />
      <path
        d="M 85 85 L 105 45 L 130 85 Z"
        fill="white"
      />
      
      {/* Van - white */}
      <g transform="translate(60, 90)">
        {/* Van body */}
        <rect x="0" y="10" width="80" height="30" rx="3" fill="white" />
        {/* Van front */}
        <path d="M 75 10 L 85 15 L 85 40 L 75 40 Z" fill="white" />
        {/* Windows */}
        <rect x="5" y="15" width="15" height="12" fill="#00d4d4" opacity="0.7" />
        <rect x="25" y="15" width="15" height="12" fill="#00d4d4" opacity="0.7" />
        <rect x="45" y="15" width="15" height="12" fill="#00d4d4" opacity="0.7" />
        <rect x="65" y="15" width="8" height="12" fill="#00d4d4" opacity="0.7" />
        {/* Wheels */}
        <circle cx="20" cy="40" r="5" fill="#1a4d5c" />
        <circle cx="20" cy="40" r="3" fill="white" />
        <circle cx="65" cy="40" r="5" fill="#1a4d5c" />
        <circle cx="65" cy="40" r="3" fill="white" />
        {/* Roof rack */}
        <rect x="10" y="7" width="50" height="2" fill="white" opacity="0.8" />
        <line x1="15" y1="7" x2="15" y2="10" stroke="white" strokeWidth="1" />
        <line x1="30" y1="7" x2="30" y2="10" stroke="white" strokeWidth="1" />
        <line x1="45" y1="7" x2="45" y2="10" stroke="white" strokeWidth="1" />
        <line x1="55" y1="7" x2="55" y2="10" stroke="white" strokeWidth="1" />
      </g>
      
      {/* Waves - white */}
      <path
        d="M 30 135 Q 40 130, 50 135 Q 60 140, 70 135 Q 80 130, 90 135 Q 100 140, 110 135 Q 120 130, 130 135 Q 140 140, 150 135 Q 160 130, 170 135"
        stroke="white"
        strokeWidth="3"
        fill="none"
        opacity="0.8"
      />
      
      {/* Text "SOMOS" - white, curved top */}
      <path
        id="topCurve"
        d="M 40 35 Q 100 20, 160 35"
        fill="none"
      />
      <text fontSize="24" fontWeight="bold" fill="white" letterSpacing="3">
        <textPath href="#topCurve" startOffset="50%" textAnchor="middle">
          SOMOS
        </textPath>
      </text>
      
      {/* Text "CAMPER" - white, curved bottom */}
      <path
        id="bottomCurve"
        d="M 35 170 Q 100 180, 165 170"
        fill="none"
      />
      <text fontSize="24" fontWeight="bold" fill="white" letterSpacing="3">
        <textPath href="#bottomCurve" startOffset="50%" textAnchor="middle">
          CAMPER
        </textPath>
      </text>
    </svg>
  );
};
