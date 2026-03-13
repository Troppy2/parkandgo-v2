import { useState, useEffect } from "react"

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // Set a timer to update debouncedValue after delayMs
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    // Cancel the timer if value changes before delayMs expires
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debouncedValue
}