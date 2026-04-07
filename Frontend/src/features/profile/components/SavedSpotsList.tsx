import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import Skeleton from "../../../components/ui/Skeleton"
import { useAuthStore } from "../../../store/authStore"
import { useNavStore } from "../../../store/navStore"
import { useUIStore } from "../../../store/uiStore"
import type { SavedSpot } from "../../../types/saved_spot.types"
import { getSavedSpots, renameSpot, unsaveSpot } from "../services/profileApi"

export default function SavedSpotsList() {
  const showToast = useUIStore((s) => s.showToast)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const startNavigation = useNavStore((s) => s.startNavigation)
  const queryClient = useQueryClient()

  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const { data: savedSpots, isLoading, isError } = useQuery({
    queryKey: ["saved-spots"],
    queryFn: getSavedSpots,
    enabled: isAuthenticated,
  })

  const deleteMutation = useMutation({
    mutationFn: unsaveSpot,
    onMutate: async (spotId) => {
      await queryClient.cancelQueries({ queryKey: ["saved-spots"] })
      const previous = queryClient.getQueryData(["saved-spots"])
      queryClient.setQueryData(["saved-spots"], (old: SavedSpot[] | undefined) =>
        old?.filter((s) => s.spot_id !== spotId) ?? []
      )
      return { previous }
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["saved-spots"], context?.previous)
      showToast("Failed to remove spot", "error")
    },
  })

  const renameMutation = useMutation({
    mutationFn: ({ spotId, name }: { spotId: number; name: string }) => renameSpot(spotId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-spots"] })
      setRenamingId(null)
      showToast("Spot renamed", "success")
    },
    onError: () => showToast("Failed to rename spot", "error"),
  })

  const startRename = (spot: SavedSpot) => {
    setRenamingId(spot.spot_id)
    setRenameValue(spot.custom_name ?? spot.spot.spot_name)
  }

  const submitRename = (spotId: number) => {
    if (!renameValue.trim()) return
    renameMutation.mutate({ spotId, name: renameValue.trim() })
  }

  if (isLoading) {
    return (
      <div className="px-5 space-y-2 py-3">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="px-5 py-4 text-center text-[12px] text-red">
        Failed to load saved spots. Please try again.
      </div>
    )
  }

  return (
    <div>
      <div className="px-5 pt-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-text2 mb-1">Saved Spots</div>
      </div>

      <div className="px-5 pb-1 bg-white border-y border-black/8">
        {(!savedSpots || savedSpots.length === 0) && (
          <div className="py-4 text-center text-[12px] text-text3">
            No saved spots yet - tap the bookmark icon on any spot to save it
          </div>
        )}

        {savedSpots?.map((saved) => (
          <div key={saved.spot_id} className="flex items-center gap-2.5 py-[9px] border-b border-black/5 last:border-b-0">
            <div className="w-7 h-7 bg-maroon-light rounded-[8px] flex items-center justify-center flex-shrink-0">
              <i className="bi bi-p-square-fill text-maroon text-[13px]" />
            </div>

            <div className="flex-1 min-w-0">
              {renamingId === saved.spot_id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRename(saved.spot_id)
                    if (e.key === "Escape") setRenamingId(null)
                  }}
                  className="w-full text-[12px] font-semibold border border-maroon rounded-[6px] px-2 py-1 outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startNavigation(saved.spot)}
                  className="w-full text-left rounded-[8px] px-1 py-1 transition-colors hover:bg-bg2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon/40"
                >
                  <div className="text-[12px] font-semibold text-text1 truncate">
                    {saved.custom_name ?? saved.spot.spot_name}
                  </div>
                  <div className="text-[10px] text-text2 mt-0.5">
                    {saved.spot.campus_location} - {saved.spot.parking_type}
                  </div>
                </button>
              )}
            </div>

            {renamingId === saved.spot_id ? (
              <>
                <button
                  type="button"
                  onClick={() => submitRename(saved.spot_id)}
                  className="w-[26px] h-[26px] bg-green-100 rounded-[7px] flex items-center justify-center flex-shrink-0"
                >
                  <i className="bi bi-check-lg text-green-600 text-[12px]" />
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  className="w-[26px] h-[26px] bg-bg rounded-[7px] flex items-center justify-center flex-shrink-0"
                >
                  <i className="bi bi-x-lg text-text2 text-[12px]" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => startRename(saved)}
                  className="w-[26px] h-[26px] bg-bg rounded-[7px] flex items-center justify-center flex-shrink-0"
                >
                  <i className="bi bi-pencil text-text2 text-[12px]" />
                </button>

                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(saved.spot_id)}
                  className="w-[26px] h-[26px] bg-red/10 rounded-[7px] flex items-center justify-center flex-shrink-0"
                >
                  <i className="bi bi-trash3 text-red text-[12px]" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
