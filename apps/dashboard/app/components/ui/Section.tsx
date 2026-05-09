import { cn } from "../../lib/utils";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
}

export function Section({ children, className }: SectionProps) {
  return (
    <div className={cn("cc-section", className)}>
      {children}
    </div>
  );
}

interface SectionHeaderProps {
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ children, className, action }: SectionHeaderProps) {
  return (
    <div className={cn("cc-section-header", className)}>
      <span>{children}</span>
      {action}
    </div>
  );
}