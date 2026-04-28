"use client";

import React, { useState, useCallback, useEffect } from 'react';

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

let globalToasts: Toast[] = [];
let listeners: Array<(toasts: Toast[]) => void> = [];

const notifyListeners = () => {
  listeners.forEach(listener => listener(globalToasts));
};

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(globalToasts);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      listeners = listeners.filter(l => l !== setToasts);
    };
  }, []);

  const dismissToast = useCallback((id: string) => {
    globalToasts = globalToasts.filter((t) => t.id !== id);
    notifyListeners();
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    globalToasts = [...globalToasts, { id, message, type }];
    notifyListeners();

    setTimeout(() => {
      dismissToast(id);
    }, 3500);
  }, [dismissToast]);

  return { toasts, showToast, dismissToast };
}

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[], onDismiss?: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        let typeClasses = "";
        switch (toast.type) {
          case "success":
            typeClasses = "bg-[#D0F5EE] text-[#0A7A65] border-[#1ABC9C]";
            break;
          case "error":
            typeClasses = "bg-[#FEF2F2] text-[#DC2626] border-[#FCA5A5]";
            break;
          case "info":
          default:
            typeClasses = "bg-[#E1F0FF] text-[#1A3A6B] border-[#BAD9F5]";
            break;
        }

        return (
          <div 
            key={toast.id}
            className={`px-4 py-3 rounded-xl border text-sm font-semibold shadow-sm min-w-[220px] max-w-xs pointer-events-auto flex justify-between items-start gap-3 ${typeClasses}`}
          >
            <span>{toast.message}</span>
            {onDismiss && (
              <button 
                onClick={() => onDismiss(toast.id)}
                className="opacity-70 hover:opacity-100 shrink-0 p-0.5 -m-0.5"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
