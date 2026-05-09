import { cn } from "../../lib/utils";

interface ProgressBarProps {
  value: number;
  variant?: "gold" | "info" | "success";
  className?: string;
}

export function ProgressBar({ value, variant = "gold", className }: ProgressBarProps) {
  return (
    <div className={cn("cc-progress-track", className)}>
      <div
        className={cn(
          variant === "gold" && "cc-progress-fill-gold",
          variant === "info" && "cc-progress-fill-info",
          variant === "success" && "h-full bg-success rounded-full transition-all"
        )}
        style={{ width: `${value * 100}%` }}
      />
    </div>
  );
}