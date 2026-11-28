import React from 'react';

interface LocalEatsLogoProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

export const LocalEatsLogo: React.FC<LocalEatsLogoProps> = ({ 
  width = 240, 
  height = 64, 
  className = '' 
}) => {
  const markClipId = React.useId();
  const gradientId = React.useId();
  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Glass-Morphic Container 
        Applies the 3D frosted glass effect natively in the browser 
      */}
      <div 
        className="absolute inset-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl shadow-[0_8px_32px_0_rgba(255,84,0,0.15)]"
        style={{ zIndex: 0 }}
      />
      
      <svg
        width={width}
        height={height}
        viewBox="0 0 240 64"
        fill="none"
        role="img"
        aria-label="LocalEats"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'relative', zIndex: 1 }}
      >
        {/* Deep Vibrant Orange Brand Gradient */}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF5400" />
            <stop offset="1" stopColor="#FF8C00" />
          </linearGradient>
          
        </defs>

        {/* Founder-selected Pin & Plate mark. Preserve the old 40-unit painted footprint. */}
        <svg x="7.385" y="7.385" width="49.23" height="49.23" viewBox="0 0 512 512" aria-hidden="true">
          <defs><clipPath id={markClipId}><circle cx="256" cy="256" r="208" /></clipPath></defs>
          <g fill="#C2410C" clipPath={`url(#${markClipId})`}>
            <path d="M0 0H512V286C462 267 414 254 370 249A114 114 0 0 0 142 269C94 284 45 309 0 340Z" />
            <path d="M0 357C139 270 304 250 457 282C301 275 153 332 53 424Z" />
            <path d="M464 286C309 305 199 404 130 512H214C242 412 338 315 464 286Z" />
            <path d="M469 290C361 322 308 409 304 512H512V276Z" />
            <path d="M256 170C237 170 222 185 222 204C222 223 241 242 256 260C271 242 290 223 290 204C290 185 275 170 256 170Z" />
          </g>
        </svg>

        {/* High-End Typography: LocalEats */}
        <text
          x="68"
          y="42"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="28"
          letterSpacing="-0.5"
          fill="#000000"
        >
          Local<tspan fill={`url(#${gradientId})`}>Eats</tspan>
        </text>
      </svg>
    </div>
  );
};
