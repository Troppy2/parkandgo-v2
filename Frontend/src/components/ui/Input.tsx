import { forwardRef, type InputHTMLAttributes } from "react"
import clsx from "clsx"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-sm font-medium text-text1">{label}</label>
        )}
        <input
          ref={ref}
          className={clsx(
            "w-full border rounded-sm px-3 py-2 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-maroon focus:border-maroon",
            error ? "border-red" : "border-border",
            className
          )}
          {...props}
        />
        {error && <p className="text-red text-xs">{error}</p>}
      </div>
    )
  }
)

Input.displayName = "Input"
export default Input
