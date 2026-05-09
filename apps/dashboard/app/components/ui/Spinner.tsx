import { cn } from "../../lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <div
      className={cn(
        "cc-spinner",
        size === "sm" && "w-4 h-4 border-2",
        size === "md" && "w-6 h-6 border-2",
        size === "lg" && "w-8 h-8 border-3",
        className
      )}
    />
  );
}