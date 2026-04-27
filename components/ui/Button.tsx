import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}

export function Button({ children, variant = "primary", className = "", ...props }: ButtonProps) {
  const base =
    variant === "primary"
      ? "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      : "px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300";
  return (
    <button className={`${base} ${className}`} {...props}>
      {children}
    </button>
  );
}
