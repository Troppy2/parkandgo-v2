import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { ParkingSpot } from "@/types/parking.types"
import { geocodeAddress } from "@/features/parking/services/geocodingService"

const schema = z.object({
  spot_name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  campus_location: z.enum(["East Bank", "West Bank", "St. Paul"]),
  parking_type: z.enum(["Parking Garage", "Surface Lot", "Street Parking"]),
  cost: z.coerce.number().min(0, "Cost must be ≥ 0"),
  walk_time: z.string().optional(),
  near_buildings: z.string().optional(),
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
})

export type SpotFormValues = z.infer<typeof schema>
type SpotFormInput = z.input<typeof schema>
type SpotFormData = z.output<typeof schema>

interface SpotFormProps {
  initialValues?: ParkingSpot
  onSubmit: (values: SpotFormValues) => void
  onCancel: () => void
  isPending: boolean
  onGeoError?: (message: string) => void
}

export default function SpotForm({ initialValues, onSubmit, onCancel, isPending, onGeoError }: SpotFormProps) {
  const isEdit = !!initialValues
  const [isGeocoding, setIsGeocoding] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<SpotFormInput, unknown, SpotFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      spot_name: initialValues?.spot_name ?? "",
      address: initialValues?.address ?? "",
      campus_location: (initialValues?.campus_location as SpotFormValues["campus_location"]) ?? "East Bank",
      parking_type: (initialValues?.parking_type as SpotFormValues["parking_type"]) ?? "Parking Garage",
      cost: initialValues?.cost ?? 0,
      walk_time: initialValues?.walk_time ?? "",
      near_buildings: initialValues?.near_buildings ?? "",
      latitude: initialValues?.latitude ?? 44.974,
      longitude: initialValues?.longitude ?? -93.2277,
    },
  })

  const addressValue = watch("address")

  async function handleAutoFill() {
    if (!addressValue?.trim()) return
    setIsGeocoding(true)
    try {
      const result = await geocodeAddress(addressValue)
      setValue("latitude", result.lat, { shouldValidate: true })
      setValue("longitude", result.lon, { shouldValidate: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not find that address"
      onGeoError?.(message)
    } finally {
      setIsGeocoding(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="px-4 py-4 space-y-3"
      data-testid="spot-form"
    >
      <h3 className="font-semibold text-sm text-text1">
        {isEdit ? `Edit: ${initialValues!.spot_name}` : "Add New Spot"}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Spot Name */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-text1 mb-1">Spot Name *</label>
          <input
            {...register("spot_name")}
            className="w-full text-sm px-3 py-2 rounded-lg border border-black/15 bg-white focus:outline-none focus:border-maroon"
            placeholder="e.g. Oak Street Ramp"
          />
          {errors.spot_name && <p className="text-xs text-red-500 mt-0.5">{errors.spot_name.message}</p>}
        </div>

        {/* Address */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-text1 mb-1">Address *</label>
          <input
            {...register("address")}
            className="w-full text-sm px-3 py-2 rounded-lg border border-black/15 bg-white focus:outline-none focus:border-maroon"
            placeholder="e.g. 500 Oak St SE, Minneapolis"
          />
          {errors.address && <p className="text-xs text-red-500 mt-0.5">{errors.address.message}</p>}
        </div>

        {/* Campus Location */}
        <div>
          <label className="block text-xs font-medium text-text1 mb-1">Campus *</label>
          <select
            {...register("campus_location")}
            className="w-full text-sm px-3 py-2 rounded-lg border border-black/15 bg-white focus:outline-none focus:border-maroon"
          >
            <option value="East Bank">East Bank</option>
            <option value="West Bank">West Bank</option>
            <option value="St. Paul">St. Paul</option>
          </select>
        </div>

        {/* Parking Type */}
        <div>
          <label className="block text-xs font-medium text-text1 mb-1">Type *</label>
          <select
            {...register("parking_type")}
            className="w-full text-sm px-3 py-2 rounded-lg border border-black/15 bg-white focus:outline-none focus:border-maroon"
          >
            <option value="Parking Garage">Parking Garage</option>
            <option value="Surface Lot">Surface Lot</option>
            <option value="Street Parking">Street Parking</option>
          </select>
        </div>

        {/* Cost */}
        <div>
          <label className="block text-xs font-medium text-text1 mb-1">Cost ($/hr) *</label>
          <input
            type="number"
            step="0.25"
            min="0"
            {...register("cost")}
            className="w-full text-sm px-3 py-2 rounded-lg border border-black/15 bg-white focus:outline-none focus:border-maroon"
          />
          {errors.cost && <p className="text-xs text-red-500 mt-0.5">{errors.cost.message}</p>}
        </div>

        {/* Walk Time */}
        <div>
          <label className="block text-xs font-medium text-text1 mb-1">Walk Time</label>
          <input
            {...register("walk_time")}
            className="w-full text-sm px-3 py-2 rounded-lg border border-black/15 bg-white focus:outline-none focus:border-maroon"
            placeholder="e.g. 5 min walk"
          />
        </div>

        {/* Near Buildings */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-text1 mb-1">Near Buildings</label>
          <input
            {...register("near_buildings")}
            className="w-full text-sm px-3 py-2 rounded-lg border border-black/15 bg-white focus:outline-none focus:border-maroon"
            placeholder="e.g. Keller Hall, Walter Library"
          />
        </div>

        {/* Coordinates */}
        <div>
          <label htmlFor="sf-latitude" className="block text-xs font-medium text-text1 mb-1">Latitude *</label>
          <input
            id="sf-latitude"
            type="number"
            step="any"
            {...register("latitude")}
            className="w-full text-sm px-3 py-2 rounded-lg border border-black/15 bg-white focus:outline-none focus:border-maroon"
          />
          {errors.latitude && <p className="text-xs text-red-500 mt-0.5">{errors.latitude.message}</p>}
        </div>
        <div>
          <label htmlFor="sf-longitude" className="block text-xs font-medium text-text1 mb-1">Longitude *</label>
          <input
            id="sf-longitude"
            type="number"
            step="any"
            {...register("longitude")}
            className="w-full text-sm px-3 py-2 rounded-lg border border-black/15 bg-white focus:outline-none focus:border-maroon"
          />
          {errors.longitude && <p className="text-xs text-red-500 mt-0.5">{errors.longitude.message}</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={handleAutoFill}
        disabled={!addressValue?.trim() || isGeocoding}
        className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 px-3 rounded-lg border border-maroon/30 text-maroon bg-maroon/5 hover:bg-maroon/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px]"
      >
        {isGeocoding ? (
          <>
            <i className="bi bi-arrow-repeat animate-spin" />
            Finding coordinates…
          </>
        ) : (
          <>
            <i className="bi bi-geo-fill" />
            Auto-fill coordinates from address
          </>
        )}
      </button>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-maroon text-white hover:bg-maroon/90 transition-colors disabled:opacity-50 min-h-[36px]"
        >
          {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Spot"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-100 text-text1 hover:bg-gray-200 transition-colors min-h-[36px]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
