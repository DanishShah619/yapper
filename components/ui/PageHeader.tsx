import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  backHref?: string;
}

export function PageHeader({ title, subtitle, action, backHref }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between pb-5 border-b border-[#D6E8F5] mb-6">
      <div className="flex min-w-0 items-start gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="mt-0.5 rounded-lg p-2 text-[#6B7A99] transition-colors duration-150 hover:bg-[#E1F0FF] hover:text-[#0A0A0A]"
            aria-label="Go back"
            title="Back"
          >
            <ArrowLeft size={18} />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#0A0A0A]">{title}</h1>
          {subtitle && (
            <p className="text-sm font-medium text-[#6B7A99] mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
