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
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'relative', zIndex: 1 }}
      >
        {/* Deep Vibrant Orange Brand Gradient */}
        <defs>
          <linearGradient id="brandGradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF5400" />
            <stop offset="1" stopColor="#FF8C00" />
          </linearGradient>
          
          {/* Metallic White Accent Gradient */}
          <linearGradient id="metallicWhite" x1="0" y1="0" x2="0" y2="64">
            <stop stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#F0F0F0" stopOpacity="0.8" />
          </linearGradient>

          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#FF5400" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Abstract Flame / Spoon Icon (Left Aligned) */}
        <g filter="url(#softShadow)">
          {/* Base Orange Flame Shape */}
          <path
            d="M32 12C20.9543 12 12 20.9543 12 32C12 43.0457 20.9543 52 32 52C43.0457 52 52 43.0457 52 32C52 24 46 16 32 12Z"
            fill="url(#brandGradient)"
          />
          {/* Glass-morphic Inner Cutout (The Spoon/Kota core) */}
          <path
            d="M32 18C25.3726 18 20 24.268 20 32C20 39.732 25.3726 46 32 46C38.6274 46 44 39.732 44 32C44 26 39 20 32 18ZM32 40C27.5817 40 24 36.4183 24 32C24 27.5817 27.5817 24 32 24C36.4183 24 40 27.5817 40 32C40 36.4183 36.4183 40 32 40Z"
            fill="url(#metallicWhite)"
          />
          {/* Stylized Accent Swoosh */}
          <path
            d="M32 24C34.2091 24 36 25.7909 36 28C36 30.2091 34.2091 32 32 32C29.7909 32 28 30.2091 28 28C28 25.7909 29.7909 24 32 24Z"
            fill="#FFFFFF"
          />
        </g>

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
          Local<tspan fill="url(#brandGradient)">Eats</tspan>
        </text>
      </svg>
    </div>
  );
};
