import { cn } from "@/lib/utils";
import React from "react";

export interface GlowingCardProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  dotColor?: string;
}

export const GlowingCard = ({ 
  title, 
  description, 
  icon, 
  badge, 
  dotColor = "#818cf8", 
  className, 
  ...props 
}: GlowingCardProps) => {
  return (
    <a className={cn("outer group cursor-pointer block", className)} {...props} style={{ textDecoration: 'none' }}>
      <div className="dot" style={{ backgroundColor: dotColor }}></div>
      <div className="card">
        <div className="ray"></div>
        
        <div 
          className="mb-4 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 shadow-sm" 
          style={{ backgroundColor: `${dotColor}20`, color: dotColor, boxShadow: `0 4px 20px ${dotColor}20` }}
        >
          {icon}
        </div>
        
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-lg font-bold text-white m-0 tracking-tight">{title}</h3>
          {badge && (
            <span 
              className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider" 
              style={{ backgroundColor: `${dotColor}25`, color: dotColor }}
            >
              {badge}
            </span>
          )}
        </div>
        
        <div className="text-[14px] font-medium text-[#9ca3af] m-0 leading-relaxed">
          {description}
        </div>
        
        <div className="line topl"></div>
        <div className="line leftl"></div>
        <div className="line bottoml"></div>
        <div className="line rightl"></div>
      </div>
    </a>
  );
};
