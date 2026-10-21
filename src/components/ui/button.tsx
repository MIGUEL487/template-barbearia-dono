import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-bold rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97] cursor-pointer";

    const variants = {
      primary: "bg-accent hover:bg-accent-hover text-accent-contrast shadow-glow",
      secondary: "bg-surface-2 hover:bg-surface-3 text-text shadow-sm",
      outline: "bg-accent-soft text-accent hover:bg-accent hover:text-accent-contrast",
      ghost: "text-text-muted hover:text-text hover:bg-surface-2",
      danger: "bg-danger/15 hover:bg-danger/25 text-danger",
    };

    const sizes = {
      sm: "h-10 px-4 text-xs gap-1.5",
      md: "h-12 px-6 text-sm gap-2",
      lg: "h-14 px-8 text-base gap-2.5",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
