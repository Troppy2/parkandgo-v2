import type { ButtonHTMLAttributes } from "react"
import clsx from "clsx"
import Spinner from "./Spinner"



interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost"
  size?: "sm" | "md" | "lg"
  isLoading?: boolean
  
}



const variantMap = {
  primary:   "bg-maroon text-white hover:bg-maroon-hover active:scale-95",
  secondary: "bg-white border border-maroon text-maroon hover:bg-maroon-light active:scale-95",
  ghost:     "bg-transparent text-maroon hover:bg-maroon-light active:scale-95",
}

const sizeMap = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
}

export default function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={clsx(
        // Base styles always applied
        "inline-flex items-center justify-center gap-2",
        "font-semibold rounded-full min-h-[44px]",
        "transition-all duration-150",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantMap[variant],
        sizeMap[size],
        className  // allow caller to override
      )}
      {...props}
    >
      {/*if isLoading, show Spinner instead of children */}
      {isLoading ? <Spinner size={size} /> : children}
    </button>
  )
}
