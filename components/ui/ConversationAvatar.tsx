import React from "react";

interface ConversationAvatarProps {
  src: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
}

export function ConversationAvatar({ src, name, size = "md", online }: ConversationAvatarProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  };
  
  const textClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const currentSize = sizeClasses[size];
  const currentTextSize = textClasses[size];

  const content = src ? (
    <img src={src} alt={name} className={`rounded-full object-cover ${currentSize}`} />
  ) : (
    <div className={`rounded-full bg-[#E1F0FF] flex items-center justify-center ${currentSize}`}>
      <span className={`font-bold text-[#1A3A6B] ${currentTextSize}`}>
        {name ? name[0].toUpperCase() : "?"}
      </span>
    </div>
  );

  if (online !== undefined) {
    return (
      <div className="relative inline-block">
        {content}
        <span className={`absolute bottom-0 right-0 ${online ? "w-2.5 h-2.5 rounded-full bg-[#1ABC9C] ring-2 ring-white" : "w-2.5 h-2.5 rounded-full bg-[#D1D5DB] ring-2 ring-white"}`} />
      </div>
    );
  }

  return content;
}
