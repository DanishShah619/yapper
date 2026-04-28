"use client";

import React from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
  loading
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl border border-[#D6E8F5]">
        <h3 className="text-base font-bold text-[#0A0A0A] mb-1">{title}</h3>
        <p className="text-sm font-medium text-[#6B7A99] mb-5">{description}</p>

        <div className="flex gap-3 justify-end">
          <button
            className="bg-[#E1F0FF] hover:bg-[#BAD9F5] text-[#1A3A6B] font-semibold rounded-lg px-4 py-2 text-sm transition-colors duration-150 disabled:opacity-50"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className={`${confirmVariant === 'danger'
                ? 'bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626]'
                : 'bg-[#1ABC9C] hover:bg-[#17a589] text-white'
              } font-semibold rounded-lg px-4 py-2 text-sm transition-colors duration-150 disabled:opacity-50 min-w-[80px]`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
