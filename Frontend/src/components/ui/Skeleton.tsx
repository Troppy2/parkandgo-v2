import clsx from "clsx"

interface SkeletonProps {
  className?: string  // caller controls width, height, border-radius
}

export default function Skeleton({ className }: SkeletonProps) {
  return(
    <div className={clsx("bg-bg2 animate-pulse rounded-sm", className)}></div>
  )
}