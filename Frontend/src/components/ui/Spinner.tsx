interface SpinnerProps {
  size?: "sm" | "md" | "lg"
}

const sizeMap = {
  sm: "w-3 h-3 border-2",
  md: "w-5 h-5 border-2",
  lg: "w-7 h-7 border-[3px]",
}

export default function Spinner({ size = "md" }: SpinnerProps) {
  return (
    <div
      className={`
        ${sizeMap[size]}
        rounded-full
        border-maroon/30
        border-t-maroon
        animate-spin
      `}
    />
  )
}
