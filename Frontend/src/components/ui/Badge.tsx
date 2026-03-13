import clsx from "clsx"

type BadgeVariant = "default" | "maroon" | "gold" | "green" | "blue" | "red"

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantMap: Record<BadgeVariant, string> = {
  default: "bg-bg2 text-text2 border-border",
  maroon:  "bg-maroon-light text-maroon border-maroon/20",
  gold:    "bg-gold-light text-gold-dark border-gold/30",
  green:   "bg-green/10 text-green border-green/20",
  blue:    "bg-blue/10 text-blue border-blue/20",
  red:     "bg-red/10 text-red border-red/20",
}

export default function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span className={clsx(
      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
      variantMap[variant],
      className
    )}>
      {children}
    </span>
  )
}
