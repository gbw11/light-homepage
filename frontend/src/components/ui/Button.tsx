import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-[var(--color-yellow)] text-[var(--color-accent-fg)] hover:brightness-95",
  secondary:
    "bg-[var(--color-navy-100)] text-[var(--color-navy-900)] hover:brightness-95",
};

/** 디자인 토큰 기준 CTA 버튼 — 라운드 999px, 터치 타겟 44px 이상 (ARCHITECTURE.md §11) */
export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] px-6 text-base font-bold transition ${variantClass[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
