import type { HTMLAttributes } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  // No extra props needed — className override handles everything

}

export default function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "bg-white border border-border rounded shadow-sm overflow-hidden",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
