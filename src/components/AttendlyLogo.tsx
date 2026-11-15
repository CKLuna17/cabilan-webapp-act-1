import React, { useId } from 'react';

interface AttendlyLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showGlow?: boolean;
}

export const AttendlyLogo: React.FC<AttendlyLogoProps> = ({
  size = 'lg',
  showGlow = true,
}) => {
  const uid = useId().replace(/:/g, '');
  const dimensions =
    size === 'sm'
      ? 'w-10 h-11'
      : size === 'md'
      ? 'w-12 h-13'
      : 'w-16 h-18';

  return (
    <div className={`relative flex items-center justify-center ${size === 'lg' ? 'mb-3' : ''}`}>
      {showGlow && (
        <div className="absolute inset-0 bg-white/35 rounded-full blur-xl pointer-events-none scale-125" />
      )}
      <svg
        viewBox="0 0 72 80"
        className={`${dimensions} drop-shadow-[0_12px_22px_rgba(15,23,42,0.45)] transition-transform hover:scale-105 duration-300 relative z-10`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Attendly school tracking logo"
      >
        <defs>
          <linearGradient id={`${uid}-silverRim`} x1="6" y1="2" x2="66" y2="78" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="22%" stopColor="#E2E8F0" />
            <stop offset="50%" stopColor="#94A3B8" />
            <stop offset="76%" stopColor="#F8FAFC" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>

          <linearGradient id={`${uid}-silverBevel`} x1="12" y1="6" x2="60" y2="74" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="35%" stopColor="#CBD5E1" />
            <stop offset="72%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#E2E8F0" />
          </linearGradient>

          <linearGradient id={`${uid}-silverLeft`} x1="12" y1="10" x2="36" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#F1F5F9" />
            <stop offset="70%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>

          <linearGradient id={`${uid}-silverRight`} x1="60" y1="10" x2="36" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="35%" stopColor="#94A3B8" />
            <stop offset="75%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          <linearGradient id={`${uid}-emblemDark`} x1="36" y1="16" x2="36" y2="62" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
        </defs>

        {/* 3D Silver Outer Shield Border (No blue background) */}
        <path
          d="M36 3L65 13.5C65 41.5 52.5 64 36 77C19.5 64 7 41.5 7 13.5L36 3Z"
          fill={`url(#${uid}-silverRim)`}
          stroke="#FFFFFF"
          strokeWidth="1.6"
        />

        {/* 3D Silver Beveled Inset */}
        <path
          d="M36 7.5L60 16.2C60 40 49.5 60 36 71.2C22.5 60 12 40 12 16.2L36 7.5Z"
          fill={`url(#${uid}-silverBevel)`}
        />

        {/* Left 3D Facet */}
        <path
          d="M36 8.5L13.5 16.8C13.5 39 23 58 36 69V8.5Z"
          fill={`url(#${uid}-silverLeft)`}
        />

        {/* Right 3D Facet */}
        <path
          d="M36 8.5L58.5 16.8C58.5 39 49 58 36 69V8.5Z"
          fill={`url(#${uid}-silverRight)`}
        />

        {/* Center Specular Facet Ridge */}
        <line x1="36" y1="8.5" x2="36" y2="69" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.8" />

        {/* Top Rim Specular Glint */}
        <path
          d="M22 8.2L36 3.5L50 8.2"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeOpacity="0.95"
        />

        {/* School Tracking Emblem: Mortarboard Graduation Cap + Location Tracking Pin */}
        {/* Mortarboard Diamond Top */}
        <path
          d="M36 16.5L54.5 24.2L36 31.8L17.5 24.2L36 16.5Z"
          fill={`url(#${uid}-emblemDark)`}
          stroke="#F8FAFC"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        {/* Cap Skullband */}
        <path
          d="M25.5 27.8V33.6C25.5 35.8 30.2 37.6 36 37.6C41.8 37.6 46.5 35.8 46.5 33.6V27.8L36 32.1L25.5 27.8Z"
          fill={`url(#${uid}-emblemDark)`}
          stroke="#E2E8F0"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        {/* Mortarboard Tassel */}
        <path
          d="M52 25.4V33.2"
          stroke="#0F172A"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="52" cy="34.5" r="1.8" fill="#0F172A" stroke="#F8FAFC" strokeWidth="0.7" />

        {/* Campus Location-Tracking Pin Below Cap */}
        <path
          d="M36 36.2C29.4 36.2 24.2 41.3 24.2 47.7C24.2 55.4 36 66.2 36 66.2C36 66.2 47.8 55.4 47.8 47.7C47.8 41.3 42.6 36.2 36 36.2Z"
          fill={`url(#${uid}-emblemDark)`}
          stroke="#FFFFFF"
          strokeWidth="1.3"
        />

        {/* Tracking Checkmark / Time Cue Inside Pin */}
        <circle cx="36" cy="47.2" r="7.2" fill="#F8FAFC" fillOpacity="0.14" stroke="#E2E8F0" strokeWidth="0.9" />
        <path
          d="M32.4 47.3L35 49.9L40.2 44.5"
          stroke="#FFFFFF"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
