import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"

import Skeleton from "../../../components/ui/Skeleton"
import { useAuthStore } from "../../../store/authStore"
import { useUIStore } from "../../../store/uiStore"
import { useNavStore } from "../../../store/navStore"
import type { PrivateSpot } from "../../../types/private_spot.types"
import { geocodeAddress } from "../../parking/services/geocodingService"
import { privateSpotToParkingSpot } from "../utils/privateSpotMappers"
import {
  createPrivateSpot,
  deletePrivateSpot,
  getPrivateSpots,
  updatePrivateSpot,
} from "../services/privateSpotsApi"

const privateSpotSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  notes: z.string().optional().or(z.literal("")),
  is_default: z.boolean().default(false),
})

type PrivateSpotFormInput = z.input<typeof privateSpotSchema>
type PrivateSpotFormData = z.output<typeof privateSpotSchema>

interface PrivateSpotsListProps {
  onFormOpenChange?: (isOpen: boolean) => void
}

export default function PrivateSpotsList({ onFormOpenChange }: PrivateSpotsListProps = {}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isReady = useAuthStore((state) => state.isReady)
  const showToast = useUIStore((state) => state.showToast)
  const startNavigation = useNavStore((state) => state.startNavigation)
  const queryClient = useQueryClient()
  const [editingSpot, setEditingSpot] = useState<PrivateSpot | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false)

  useEffect(() => {
    onFormOpenChange?.(isFormOpen)
  }, [isFormOpen, onFormOpenChange])

  const {
    data: privateSpots,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["private-spots"],
    queryFn: getPrivateSpots,
    enabled: isAuthenticated && isReady,
    retry: 1,
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    setValue,
    watch,
  } = useForm<PrivateSpotFormInput, unknown, PrivateSpotFormData>({
    resolver: zodResolver(privateSpotSchema),
    defaultValues: {
      name: "",
      address: "",
      latitude: 44.974,
      longitude: -93.2277,
      notes: "",
      is_default: false,
    },
  })

  useEffect(() => {
    if (!editingSpot) {
      reset({
        name: "",
        address: "",
        latitude: 44.974,
        longitude: -93.2277,
        notes: "",
        is_default: false,
      })
      return
    }

    reset({
      name: editingSpot.name,
      address: "",
      latitude: editingSpot.latitude,
      longitude: editingSpot.longitude,
      notes: editingSpot.notes ?? "",
      is_default: editingSpot.is_default,
    })
  }, [editingSpot, reset])

  const saveMutation = useMutation({
    mutationFn: (payload: Omit<PrivateSpotFormData, "address">) =>
      editingSpot
        ? updatePrivateSpot(editingSpot.private_spot_id, payload)
        : createPrivateSpot(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["private-spots"] })
      setIsFormOpen(false)
      setEditingSpot(null)
      showToast(editingSpot ? "Private spot updated" : "Private spot saved", "success")
    },
    onError: () => showToast("Failed to save private spot", "error"),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePrivateSpot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["private-spots"] })
      showToast("Private spot deleted", "success")
    },
    onError: () => showToast("Failed to delete private spot", "error"),
  })

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      showToast("Geolocation not available on this device", "error")
      return
    }

    setIsGettingLocation(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        })
      })

      setValue("latitude", position.coords.latitude, { shouldDirty: true })
      setValue("longitude", position.coords.longitude, { shouldDirty: true })
      showToast("Captured your current location", "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not get your location", "error")
    } finally {
      setIsGettingLocation(false)
    }
  }

  const addressValue = watch("address")

  async function handleAutofillFromAddress() {
    if (!addressValue?.trim()) {
      showToast("Enter an address first", "error")
      return
    }

    setIsGeocodingAddress(true)
    try {
      const result = await geocodeAddress(addressValue)
      setValue("latitude", result.lat, { shouldDirty: true, shouldValidate: true })
      setValue("longitude", result.lon, { shouldDirty: true, shouldValidate: true })
      showToast("Coordinates autofilled from address", "success")
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not geocode that address", "error")
    } finally {
      setIsGeocodingAddress(false)
    }
  }

  const openCreate = () => {
    setEditingSpot(null)
    reset({
      name: "",
      address: "",
      latitude: 44.974,
      longitude: -93.2277,
      notes: "",
      is_default: false,
    })
    setIsFormOpen(true)
  }

  const openEdit = (spot: PrivateSpot) => {
    setEditingSpot(spot)
    setIsFormOpen(true)
  }

  const onSubmit = (values: PrivateSpotFormData) => {
    const { address: _address, ...payload } = values
    saveMutation.mutate({
      ...payload,
      notes: payload.notes?.trim() || undefined,
    })
  }

  if (!isAuthenticated) {
    return (
      <div className="px-5 py-4 text-center text-[12px] text-text3">
        Sign in to save your own parking spots.
      </div>
    )
  }

  const sortedPrivateSpots = [...(privateSpots ?? [])].sort((a, b) => {
    if (a.is_default !== b.is_default) {
      return Number(b.is_default) - Number(a.is_default)
    }
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
    return timeB - timeA
  })

  return (
    <>
      {isFormOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/45 z-[130] flex items-end md:items-center md:justify-center backdrop-blur-[1px]"
          onClick={() => setIsFormOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={editingSpot ? "Edit Special Parking Spot" : "Add Special Parking Spot"}
            className="w-full md:max-w-[420px] max-h-[88vh] overflow-y-auto rounded-t-[20px] md:rounded-[18px] border border-black/10"
            style={{ background: "var(--color-modal-surface)", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/8">
              <div className="text-[14px] font-bold text-text1">
                {editingSpot ? "Edit Special Parking Spot" : "Add Special Parking Spot"}
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="w-7 h-7 bg-black/7 rounded-full flex items-center justify-center text-text2"
              >
                <i className="bi bi-x-lg text-[11px]" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-3 space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="private-spot-name" className="text-[11px] font-semibold text-text1">
                  Spot name
                </label>
                <input
                  id="private-spot-name"
                  {...register("name")}
                  placeholder="Home garage"
                  className="w-full text-[12px] rounded-[10px] border border-black/10 px-3 py-2 outline-none focus:border-maroon"
                />
                {errors.name && <p className="text-[10px] text-red">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="private-spot-address" className="text-[11px] font-semibold text-text1">
                  Address
                </label>
                <input
                  id="private-spot-address"
                  {...register("address")}
                  placeholder="500 Oak St SE, Minneapolis"
                  className="w-full text-[12px] rounded-[10px] border border-black/10 px-3 py-2 outline-none focus:border-maroon"
                />
                {errors.address && <p className="text-[10px] text-red">{errors.address.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label htmlFor="private-spot-lat" className="text-[11px] font-semibold text-text1">
                    Latitude
                  </label>
                  <input
                    id="private-spot-lat"
                    type="number"
                    step="any"
                    {...register("latitude")}
                    className="w-full text-[12px] rounded-[10px] border border-black/10 px-3 py-2 outline-none focus:border-maroon"
                  />
                  {errors.latitude && <p className="text-[10px] text-red">{errors.latitude.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="private-spot-lon" className="text-[11px] font-semibold text-text1">
                    Longitude
                  </label>
                  <input
                    id="private-spot-lon"
                    type="number"
                    step="any"
                    {...register("longitude")}
                    className="w-full text-[12px] rounded-[10px] border border-black/10 px-3 py-2 outline-none focus:border-maroon"
                  />
                  {errors.longitude && <p className="text-[10px] text-red">{errors.longitude.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <textarea
                  {...register("notes")}
                  placeholder="Notes for yourself"
                  className="w-full min-h-[72px] text-[12px] rounded-[10px] border border-black/10 px-3 py-2 outline-none focus:border-maroon"
                />
              </div>

              <label className="flex items-center gap-2 text-[12px] text-text1 font-medium">
                <input type="checkbox" {...register("is_default")} className="accent-maroon" />
                Make default spot
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleAutofillFromAddress}
                  disabled={isGeocodingAddress || !addressValue?.trim()}
                  className="rounded-[10px] border border-maroon/25 bg-maroon-light px-3 py-2 text-[11px] font-semibold text-maroon transition-colors disabled:opacity-50 min-h-[40px]"
                >
                  {isGeocodingAddress ? "Finding coordinates..." : "Autofill from address"}
                </button>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isGettingLocation}
                  className="rounded-[10px] border border-blue/20 bg-blue/5 px-3 py-2 text-[11px] font-semibold text-blue transition-colors disabled:opacity-50 min-h-[40px]"
                >
                  {isGettingLocation ? "Getting location..." : "Use current location"}
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 rounded-[10px] border border-black/10 px-3 py-2 text-[11px] font-semibold text-text1 min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending || (!isDirty && !editingSpot)}
                  className="flex-1 rounded-[10px] bg-maroon px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-maroon-hover disabled:opacity-50 min-h-[40px]"
                >
                  {saveMutation.isPending ? "Saving..." : editingSpot ? "Update spot" : "Add spot"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <div>
      <div className="px-5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-text2 mb-1">
            My Spots
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="mb-1 rounded-[10px] bg-maroon px-3 py-2 text-[10px] font-semibold text-white min-h-[36px] shadow-sm hover:bg-maroon-hover transition-colors"
          >
            Add Special Parking Spot
          </button>
        </div>
      </div>

      <div className="mx-5 mb-1 rounded-[14px] border border-black/10 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {isLoading && !privateSpots && (
          <div className="py-3">
            <div className="text-[11px] font-medium text-text2 mb-2" role="status" aria-live="polite">
              Loading your spots...
            </div>
            <div className="space-y-2">
              <Skeleton className="h-10 rounded-xl" />
              <Skeleton className="h-10 rounded-xl" />
            </div>
          </div>
        )}

        {isError && (
          <div className="mt-3 rounded-[10px] border border-amber/40 bg-amber/10 px-3 py-2.5 text-[11px] text-text1">
            <div className="font-semibold">My Spots are temporarily unavailable.</div>
            <div className="text-text2">You can keep using Settings and retry loading your spots.</div>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-2 rounded-[8px] border border-black/10 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-text1 disabled:opacity-50"
            >
              {isFetching ? "Retrying..." : "Retry"}
            </button>
          </div>
        )}

        {!isLoading && sortedPrivateSpots.length === 0 ? (
          <div className="rounded-[10px] bg-bg2/60 py-4 text-center text-[12px] text-text3">
            No special spots yet. Add one for quick navigation and one-tap directions.
          </div>
        ) : !isLoading ? (
          <div className="divide-y divide-black/5">
            {sortedPrivateSpots.map((spot) => (
              <div key={spot.private_spot_id} className="py-3.5 flex items-start gap-2.5">
                <div className="w-8 h-8 bg-maroon-light rounded-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className="bi bi-geo-alt-fill text-maroon text-[13px]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="text-[12px] font-semibold text-text1 truncate leading-tight">{spot.name}</div>
                    {spot.is_default && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/25 text-gold-dk font-semibold">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-text2 mt-0.5">
                    {spot.latitude.toFixed(4)}, {spot.longitude.toFixed(4)}
                  </div>
                  {spot.notes && <div className="text-[10px] text-text2 mt-0.5 line-clamp-2">{spot.notes}</div>}
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => startNavigation(privateSpotToParkingSpot(spot))}
                    className="px-2.5 py-1.5 text-[10px] font-semibold rounded-[8px] bg-maroon text-white min-h-[32px] hover:bg-maroon-hover transition-colors"
                  >
                    Navigate
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(spot)}
                    className="px-2.5 py-1.5 text-[10px] font-semibold rounded-[8px] bg-bg2 text-text1 min-h-[32px] hover:bg-black/5 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(spot.private_spot_id)}
                    className="px-2.5 py-1.5 text-[10px] font-semibold rounded-[8px] bg-red/10 text-red min-h-[32px] hover:bg-red/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
    </>
  )
}
