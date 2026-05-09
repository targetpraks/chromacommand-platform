import { cn } from "../../lib/utils";

interface StatusDotProps {
  status: "online" | "offline" | "unknown";
  className?: string;
}

export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "cc-status-dot",
        status === "online" && "cc-status-online",
        status === "offline" && "cc-status-offline",
        status === "unknown" && "bg-zinc-500",
        className
      )}
    />
  );
}