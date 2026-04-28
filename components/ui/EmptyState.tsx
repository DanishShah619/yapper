import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Icon size={48} className="text-[#BAD9F5] mb-4" />
      <h3 className="text-base font-bold text-[#0A0A0A] mb-1">{title}</h3>
      <p className="text-sm font-medium text-[#6B7A99] max-w-xs mx-auto">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
