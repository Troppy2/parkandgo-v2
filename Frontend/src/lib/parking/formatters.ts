export function formatParkingCost(cost: unknown): string {
  if (cost === null || cost === undefined) {
    return "N/A"
  }

  if (typeof cost !== "number" || !Number.isFinite(cost)) {
    return "N/A"
  }

  if (cost === 0) {
    return "Free"
  }

  return `$${cost.toFixed(2)}`
}