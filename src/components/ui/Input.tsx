import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  help?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, help, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <span className="flex items-center gap-1">
            <label
              htmlFor={inputId}
              className="text-sm font-medium text-[#4A3728]"
            >
              {label}
              {props.required && <span className="text-[#C0392B] ml-1">*</span>}
            </label>
            {help}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 w-full rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm",
            "text-[#2C1810] placeholder:text-[#B88D6A]",
            "focus:outline-none focus:ring-2 focus:ring-[#A05035] focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-[#C0392B] focus:ring-[#C0392B]",
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-[#C0392B]">{error}</p>}
        {helper && !error && <p className="text-xs text-[#7C6352]">{helper}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  help?: React.ReactNode;
  children: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, help, className, id, children, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <span className="flex items-center gap-1">
            <label
              htmlFor={inputId}
              className="text-sm font-medium text-[#4A3728]"
            >
              {label}
              {props.required && <span className="text-[#C0392B] ml-1">*</span>}
            </label>
            {help}
          </span>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 w-full rounded-lg border border-[#D9CCAF] bg-[#FBF8F2] px-3 text-sm",
            "text-[#2C1810] focus:outline-none focus:ring-2 focus:ring-[#A05035] focus:border-transparent",
            "disabled:opacity-50 cursor-pointer",
            error && "border-[#C0392B]",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-[#C0392B]">{error}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";
