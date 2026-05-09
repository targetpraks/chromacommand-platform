import { cn } from "../../lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "danger-ghost";
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
}

export function Button({ variant = "ghost", size = "sm", children, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        variant === "primary" && "cc-btn-primary",
        variant === "ghost" && "cc-btn-ghost",
        variant === "danger" && "cc-btn-primary !bg-error hover:!bg-red-600",
        variant === "danger-ghost" && "cc-btn-danger-ghost",
        size === "md" && variant === "primary" && "px-5 py-2.5 text-sm",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}