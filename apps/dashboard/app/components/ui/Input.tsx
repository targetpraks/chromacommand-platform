import { cn } from "../../lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  className?: string;
}

export function Input({ label, className, ...props }: InputProps) {
  return (
    <label className="block">
      {label && <span className="cc-input-label">{label}</span>}
      <input className={cn("cc-input", label && "mt-1", className)} {...props} />
    </label>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  className?: string;
  options?: { value: string; label: string }[];
}

export function Select({ label, className, options, children, ...props }: SelectProps) {
  return (
    <label className="block">
      {label && <span className="cc-input-label">{label}</span>}
      <select className={cn("cc-input", label && "mt-1", className)} {...props}>
        {options ? options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : children}
      </select>
    </label>
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  className?: string;
}

export function TextArea({ label, className, ...props }: TextAreaProps) {
  return (
    <label className="block">
      {label && <span className="cc-input-label">{label}</span>}
      <textarea className={cn("cc-input", label && "mt-1", className)} {...props} />
    </label>
  );
}