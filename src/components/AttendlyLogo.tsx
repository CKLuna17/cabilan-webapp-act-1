import React from 'react';

interface AttendlyLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showGlow?: boolean;
  className?: string;
}

export const AttendlyLogo: React.FC<AttendlyLogoProps> = ({
  size = 'lg',
  showGlow = false,
  className = '',
}) => {
  const dimensions =
    size === 'xs'
      ? 'w-8 h-8'
      : size === 'sm'
      ? 'w-11 h-11'
      : size === 'md'
      ? 'w-14 h-14'
      : 'w-20 h-20';

  return (
    <div
      className={`${dimensions} relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
    >
      {showGlow && (
        <div className="absolute inset-0 bg-[#6B5BF7]/30 rounded-full blur-xl pointer-events-none scale-110" />
      )}
      <img
        src="/assets/aistudio/Happy_A_Background_Removed_6bd6608a.png"
        alt="Attendly logo"
        className="relative z-10 w-full h-full object-contain scale-[1.38] select-none drop-shadow-[0_6px_16px_rgba(81,66,230,0.22)]"
      />
    </div>
  );
};
