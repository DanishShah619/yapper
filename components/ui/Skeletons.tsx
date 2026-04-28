import React from 'react';

export function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12"
  };

  return (
    <div className={`bg-[#D6E8F5] animate-pulse rounded-full ${sizeClasses[size]}`} />
  );
}

export function SkeletonText({ width = "md" }: { width?: "sm" | "md" | "lg" | "full" }) {
  const widthClasses = {
    sm: "w-16",
    md: "w-32",
    lg: "w-48",
    full: "w-full"
  };

  return (
    <div className={`bg-[#D6E8F5] animate-pulse rounded h-3 ${widthClasses[width]}`} />
  );
}

export function SkeletonCard({ children }: { children?: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#D6E8F5] rounded-2xl p-4 shadow-sm shadow-blue-100/50 flex items-center gap-3">
      {children || (
        <>
          <SkeletonAvatar size="md" />
          <div className="flex-1 space-y-2">
            <SkeletonText width="md" />
            <SkeletonText width="sm" />
          </div>
        </>
      )}
    </div>
  );
}

export function SkeletonList() {
  return (
    <div className="space-y-3">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
