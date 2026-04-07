const REMINDER_STORAGE_KEY = "parkandgo-parking-reminder"
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

interface StoredParkingReminder {
  spotName: string
  triggerAtMs: number
}

let activeReminderTimer: number | null = null

function clearReminderTimer() {
  if (activeReminderTimer != null) {
    window.clearTimeout(activeReminderTimer)
    activeReminderTimer = null
  }
}

function readReminder(): StoredParkingReminder | null {
  try {
    const raw = localStorage.getItem(REMINDER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredParkingReminder
    if (!parsed.spotName || !parsed.triggerAtMs) return null
    return parsed
  } catch {
    return null
  }
}

function writeReminder(reminder: StoredParkingReminder) {
  localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminder))
}

function clearReminderStorage() {
  localStorage.removeItem(REMINDER_STORAGE_KEY)
}

function showParkingReminderNotification(spotName: string) {
  new Notification("Parking Reminder", {
    body: `You parked at ${spotName} about 2 hours ago.`,
    icon: "/icons/icon-192x192.png",
    tag: "parking-reminder",
    badge: "/icons/icon-96x96.png",
  })
}

async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied"
  if (Notification.permission === "default") {
    return Notification.requestPermission()
  }
  return Notification.permission
}

function queueReminder(reminder: StoredParkingReminder) {
  clearReminderTimer()

  const delayMs = Math.max(0, reminder.triggerAtMs - Date.now())
  activeReminderTimer = window.setTimeout(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      showParkingReminderNotification(reminder.spotName)
    }
    clearReminderStorage()
    clearReminderTimer()
  }, delayMs)
}

export async function scheduleParkingReminder(
  spotName: string,
  delayMs: number = TWO_HOURS_MS
): Promise<"scheduled" | "unsupported" | "denied"> {
  if (typeof Notification === "undefined") return "unsupported"

  const permission = await ensureNotificationPermission()
  if (permission !== "granted") return "denied"

  const reminder: StoredParkingReminder = {
    spotName,
    triggerAtMs: Date.now() + delayMs,
  }

  writeReminder(reminder)
  queueReminder(reminder)
  return "scheduled"
}

export async function initializeParkingReminderScheduler() {
  const reminder = readReminder()
  if (!reminder) return

  if (typeof Notification === "undefined") return

  const permission = await ensureNotificationPermission()
  if (permission !== "granted") return

  if (reminder.triggerAtMs <= Date.now()) {
    showParkingReminderNotification(reminder.spotName)
    clearReminderStorage()
    clearReminderTimer()
    return
  }

  queueReminder(reminder)
}
