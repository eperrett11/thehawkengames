import React from 'react';

interface BirdIconProps {
  size?: number;
  className?: string;
}

const BirdIcon: React.FC<BirdIconProps> = ({ size = 24, className = '' }) => {
  return (
    <img
      src="/logos/hawk-logo-small.svg?v=20260308b"
      alt="Hawken bird icon"
      title="The Hawken Games"
      className={`inline-block ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

export default BirdIcon;





