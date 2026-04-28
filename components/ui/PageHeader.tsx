import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between pb-5 border-b border-[#D6E8F5] mb-6">
      <div>
        <h1 className="text-xl font-bold text-[#0A0A0A]">{title}</h1>
        {subtitle && (
          <p className="text-sm font-medium text-[#6B7A99] mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
