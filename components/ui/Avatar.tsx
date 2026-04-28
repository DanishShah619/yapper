import React from 'react';

export interface AvatarProps {
  src: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
}

export function Avatar({ src, name, size = "md", online }: AvatarProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12"
  };

  const currentSizeClass = sizeClasses[size];

  const content = src ? (
    <img 
      src={src} 
      alt={name} 
      className={`rounded-full object-cover ${currentSizeClass}`} 
    />
  ) : (
    <div className={`rounded-full bg-[#E1F0FF] flex items-center justify-center ${currentSizeClass}`}>
      <span className="text-[#1A3A6B] font-bold">
        {name ? name.charAt(0).toUpperCase() : '?'}
      </span>
    </div>
  );

  if (online !== undefined) {
    return (
      <div className="relative inline-block">
        {content}
        <span 
          className={`absolute bottom-0 right-0 ${online ? 'w-2.5 h-2.5 rounded-full bg-[#1ABC9C] ring-2 ring-white' : 'w-2.5 h-2.5 rounded-full bg-[#D1D5DB] ring-2 ring-white'}`}
        />
      </div>
    );
  }

  return content;
}
