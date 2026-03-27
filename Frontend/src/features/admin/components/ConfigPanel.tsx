import { useState } from "react"
import { useAdminConfig, useUpdateConfig } from "../hooks/useAdmin"
import { Skeleton } from "@/components/ui"

export default function ConfigPanel() {
  const { data: config, isLoading, error } = useAdminConfig()
  const updateConfig = useUpdateConfig()
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")

  if (isLoading) return <Skeleton className="h-32" />
  if (error) return <div className="text-red-500 text-sm">Failed to load config</div>

  const startEdit = (key: string, currentValue: string) => {
    setEditing(key)
    setEditValue(currentValue)
  }

  const save = () => {
    if (!editing) return
    updateConfig.mutate({ key: editing, value: editValue })
    setEditing(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-black/[0.12] shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
        <i className="bi bi-gear-fill text-text2" />
        <span className="font-semibold text-sm text-text1">App Config</span>
      </div>

      {!config || config.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-text1">No config entries</div>
      ) : (
        <div className="divide-y divide-black/5">
          {config.map((entry) => (
            <div key={entry.key} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-text1 font-mono">{entry.key}</span>
                {editing === entry.key ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={save}
                      className="px-2.5 py-1 rounded-md bg-maroon text-white text-xs font-semibold transition-colors hover:bg-maroon-hover active:bg-[var(--color-maroon-dark)]"
                    >
                      Save
                    </button>
                    <button onClick={() => setEditing(null)} className="text-xs text-text1 hover:underline">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(entry.key, entry.value)}
                    className="text-xs text-maroon font-semibold hover:underline"
                  >
                    Edit
                  </button>
                )}
              </div>
              {editing === entry.key ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && save()}
                  className="w-full text-xs border border-black/15 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-maroon/20"
                  autoFocus
                />
              ) : (
                <div className="text-xs text-text1 font-mono">{entry.value}</div>
              )}
              {entry.description && (
                <div className="text-[10px] text-text1 mt-0.5">{entry.description}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
