import { IconProps } from '@phosphor-icons/react';

// Icon for heating/water/electricity
export const UtilitiesIcon = ({ size = 20, weight = "regular", className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 256 256" className={className} fill="currentColor">
    {/* Simplified utility icon - droplet for water, lightning for electricity */}
    <path d="M174,47.75a254.19,254.19,0,0,0-41.45-38.3,8,8,0,0,0-9.18,0A254.19,254.19,0,0,0,82,47.75C54.51,79.32,40,112.6,40,144a88,88,0,0,0,176,0C216,112.6,201.49,79.32,174,47.75ZM128,216a72.08,72.08,0,0,1-72-72c0-57.23,55.47-105,72-118,16.53,13,72,60.75,72,118A72.08,72.08,0,0,1,128,216Zm55.89-62.66a57.6,57.6,0,0,1-46.56,46.55A8.75,8.75,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68Z" />
  </svg>
);

// Icon for water tanks/service
export const WaterTankIcon = ({ size = 20, weight = "regular", className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 256 256" className={className} fill="currentColor">
    {/* Water container/tank icon */}
    <path d="M200,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V40A16,16,0,0,0,200,24Zm0,192H56V40H200ZM128,56a48.05,48.05,0,0,0-48,48c0,24,48,88,48,88s48-64,48-88A48.05,48.05,0,0,0,128,56Zm0,80c-12.19-17.85-32-44.44-32-64a32,32,0,0,1,64,0C160,91.56,140.19,118.15,128,136Z" />
  </svg>
);

// Icon for checklist/return
export const ChecklistIcon = ({ size = 20, weight = "regular", className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 256 256" className={className} fill="currentColor">
    {/* Checklist icon */}
    <path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM40,64H216v32H40Zm176,128H40V112H216v80Zm-16-56a8,8,0,0,1-8,8H64a8,8,0,0,1,0-16H192A8,8,0,0,1,200,136Zm0,32a8,8,0,0,1-8,8H64a8,8,0,0,1,0-16H192A8,8,0,0,1,200,168Z" />
  </svg>
);

// Icon for breakdown/assistance
export const AssistanceIcon = ({ size = 20, weight = "regular", className = "" }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 256 256" className={className} fill="currentColor">
    {/* Wrench/tools icon */}
    <path d="M226.76,69a8,8,0,0,0-12.84-2.88l-40.3,37.19-17.23-3.7-3.7-17.23,37.19-40.3A8,8,0,0,0,187,29.24,72,72,0,0,0,88,96,72.34,72.34,0,0,0,94,124.94L33.79,177c-.15.12-.29.26-.43.39a32,32,0,0,0,45.26,45.26c.13-.13.27-.28.39-.42L131.06,162A72,72,0,0,0,232,96,71.56,71.56,0,0,0,226.76,69ZM160,152a56.14,56.14,0,0,1-27.07-7,8,8,0,0,0-9.92,1.77L67.11,211.51a16,16,0,0,1-22.62-22.62L109.18,133a8,8,0,0,0,1.77-9.93,56,56,0,0,1,58.36-82.31l-31.2,33.81a8,8,0,0,0-1.94,7.1L141.83,108a8,8,0,0,0,6.14,6.14l26.35,5.66a8,8,0,0,0,7.1-1.94l33.81-31.2A56.06,56.06,0,0,1,160,152Z" />
  </svg>
);
