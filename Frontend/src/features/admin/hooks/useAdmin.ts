import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  getAdminStats,
  getAllSpots,
  getUnverifiedSpots,
  verifySpot,
  deleteSpot,
  createAdminSpot,
  updateAdminSpot,
  triggerEventSync,
  getAllConfig,
  updateConfig,
  type ParkingSpotUpdateBody,
} from "../services/adminApi"
import type { ParkingSpotCreate } from "@/types/parking.types"
import { useUIStore } from "@/store/uiStore"

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: getAdminStats,
    refetchInterval: 30_000,
  })
}

export function useAllSpots() {
  return useQuery({
    queryKey: ["admin", "all-spots"],
    queryFn: getAllSpots,
  })
}

export function useUnverifiedSpots() {
  return useQuery({
    queryKey: ["admin", "unverified"],
    queryFn: getUnverifiedSpots,
  })
}

export function useVerifySpot() {
  const qc = useQueryClient()
  const showToast = useUIStore((s) => s.showToast)
  return useMutation({
    mutationFn: verifySpot,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] })
      showToast("Spot verified", "success")
    },
    onError: () => showToast("Failed to verify spot", "error"),
  })
}

export function useDeleteSpot() {
  const qc = useQueryClient()
  const showToast = useUIStore((s) => s.showToast)
  return useMutation({
    mutationFn: deleteSpot,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] })
      showToast("Spot rejected", "success")
    },
    onError: () => showToast("Failed to delete spot", "error"),
  })
}

export function useCreateAdminSpot() {
  const qc = useQueryClient()
  const showToast = useUIStore((s) => s.showToast)
  return useMutation({
    mutationFn: (body: ParkingSpotCreate) => createAdminSpot(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] })
      showToast("Spot created", "success")
    },
    onError: () => showToast("Failed to create spot", "error"),
  })
}

export function useUpdateAdminSpot() {
  const qc = useQueryClient()
  const showToast = useUIStore((s) => s.showToast)
  return useMutation({
    mutationFn: ({ spotId, body }: { spotId: number; body: ParkingSpotUpdateBody }) =>
      updateAdminSpot(spotId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] })
      showToast("Spot updated", "success")
    },
    onError: () => showToast("Failed to update spot", "error"),
  })
}

export function useAdminDeleteSpot() {
  const qc = useQueryClient()
  const showToast = useUIStore((s) => s.showToast)
  return useMutation({
    mutationFn: deleteSpot,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] })
      showToast("Spot deleted", "success")
    },
    onError: () => showToast("Failed to delete spot", "error"),
  })
}

export function useEventSync() {
  const showToast = useUIStore((s) => s.showToast)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: triggerEventSync,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin"] })
      showToast(`Synced ${data.synced} events`, "success")
    },
    onError: () => showToast("Event sync failed", "error"),
  })
}

export function useAdminConfig() {
  return useQuery({
    queryKey: ["admin", "config"],
    queryFn: getAllConfig,
  })
}

export function useUpdateConfig() {
  const qc = useQueryClient()
  const showToast = useUIStore((s) => s.showToast)
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      updateConfig(key, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "config"] })
      showToast("Config updated", "success")
    },
    onError: () => showToast("Failed to update config", "error"),
  })
}
