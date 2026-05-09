import { cn } from "../../lib/utils";

interface BadgeProps {
  variant?: "gold" | "success" | "error" | "warning" | "info" | "new";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "gold", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "cc-badge",
        (variant === "gold" || variant === "new") && "cc-badge-gold",
        variant === "success" && "cc-badge-success",
        variant === "error" && "cc-badge-error",
        variant === "warning" && "cc-badge-warning",
        variant === "info" && "cc-badge-info",
        className
      )}
    >
      {children}
    </span>
  );
}