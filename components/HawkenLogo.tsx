import React from 'react';

interface HawkenLogoProps {
  className?: string;
}

const HawkenLogo: React.FC<HawkenLogoProps> = ({ className = '' }) => {
  return (
    <div className={`w-full max-w-[220px] mx-auto ${className}`} aria-label="The Hawken Games logo">
      <img
        src="/logos/hawken-logo-big-white-v2.png?v=20260415b"
        alt="The Hawken Games"
        className="w-full h-auto"
      />
    </div>
  );
};

export default HawkenLogo;






