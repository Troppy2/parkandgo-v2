import { useEventSync, useAdminConfig, useUpdateConfig } from "../hooks/useAdmin"
import { Skeleton } from "@/components/ui"

export default function EventSyncPanel() {
  const sync = useEventSync()
  const { data: config, isLoading } = useAdminConfig()
  const updateConfig = useUpdateConfig()

  if (isLoading) return <Skeleton className="h-32" />

  const enabled = config?.find((c) => c.key === "event_sync_enabled")?.value === "true"
  const lastRun = config?.find((c) => c.key === "event_sync_last_run")?.value

  const toggleSync = () => {
    updateConfig.mutate({ key: "event_sync_enabled", value: enabled ? "false" : "true" })
  }

  return (
    <div className="bg-white rounded-2xl border border-black/[0.12] shadow-sm p-4">
      <div className="flex items-center gap-2 mb-4">
        <i className="bi bi-arrow-repeat text-purple-600" />
        <span className="font-semibold text-sm text-text1">Event Sync</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text1">Auto-sync</span>
          <button
            onClick={toggleSync}
            className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? "bg-maroon" : "bg-[var(--color-toggle-off)]"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>

        {lastRun && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-text1">Last run</span>
            <span className="text-xs font-medium text-text1">
              {new Date(lastRun).toLocaleString()}
            </span>
          </div>
        )}

        <button
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="w-full py-2.5 text-xs font-semibold rounded-xl bg-maroon text-white hover:bg-maroon-hover active:bg-[var(--color-maroon-dark)] transition-colors min-h-[44px] flex items-center justify-center gap-2 disabled:bg-[var(--color-button-disabled-bg)] disabled:text-[var(--color-button-disabled-text)]"
        >
          {sync.isPending ? (
            <>
              <i className="bi bi-arrow-repeat animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <i className="bi bi-arrow-repeat" />
              Sync Now
            </>
          )}
        </button>
      </div>
    </div>
  )
}
