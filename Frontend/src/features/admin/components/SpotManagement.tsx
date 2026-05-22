import { useState } from "react"
import { Skeleton } from "@/components/ui"
import { useUIStore } from "@/store/uiStore"
import type { ParkingSpot } from "@/types/parking.types"
import { formatParkingCost } from "../../../lib/parking/formatters"
import {
  useAllSpots,
  useUnverifiedSpots,
  useVerifySpot,
  useDeleteSpot,
  useCreateAdminSpot,
  useUpdateAdminSpot,
  useAdminDeleteSpot,
} from "../hooks/useAdmin"
import SpotForm, { type SpotFormValues } from "./SpotForm"

type Tab = "all" | "pending"

export default function SpotManagement() {
  const [activeTab, setActiveTab] = useState<Tab>("all")
  const [isAdding, setIsAdding] = useState(false)
  const [editingSpot, setEditingSpot] = useState<ParkingSpot | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const { data: allSpots, isLoading: allLoading, error: allError } = useAllSpots()
  const { data: pendingSpots, isLoading: pendingLoading } = useUnverifiedSpots()

  const verify = useVerifySpot()
  const reject = useDeleteSpot()          // pending-review flow: "Spot rejected"
  const adminDelete = useAdminDeleteSpot() // general delete: "Spot deleted"
  const create = useCreateAdminSpot()
  const update = useUpdateAdminSpot()

  const spots = activeTab === "all" ? allSpots : pendingSpots
  const isLoading = activeTab === "all" ? allLoading : pendingLoading

  function handleCreateSubmit(values: SpotFormValues) {
    create.mutate(values, { onSuccess: () => setIsAdding(false) })
  }

  function handleEditSubmit(values: SpotFormValues) {
    if (!editingSpot) return
    update.mutate(
      { spotId: editingSpot.spot_id, body: values },
      { onSuccess: () => setEditingSpot(null) }
    )
  }

  function handleDelete(spotId: number) {
    // Use reject for pending-tab (preserves "Spot rejected" toast), adminDelete for all-tab
    const mutate = activeTab === "pending" ? reject.mutate : adminDelete.mutate
    mutate(spotId, { onSuccess: () => setConfirmDeleteId(null) })
  }

  const showToast = useUIStore((s) => s.showToast)

  const isPendingOp =
    verify.isPending || reject.isPending || adminDelete.isPending ||
    create.isPending || update.isPending

  // ── Form views ──────────────────────────────────────────
  if (isAdding) {
    return (
      <div className="bg-white rounded-2xl border border-black/[0.12] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
          <i className="bi bi-plus-circle-fill text-maroon" />
          <span className="font-semibold text-sm text-text1">Add New Spot</span>
        </div>
        <SpotForm
          onSubmit={handleCreateSubmit}
          onCancel={() => setIsAdding(false)}
          isPending={create.isPending}
          onGeoError={(msg) => showToast(msg, "error")}
        />
      </div>
    )
  }

  if (editingSpot) {
    return (
      <div className="bg-white rounded-2xl border border-black/[0.12] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
          <i className="bi bi-pencil-fill text-maroon" />
          <span className="font-semibold text-sm text-text1">Edit Spot</span>
        </div>
        <SpotForm
          initialValues={editingSpot}
          onSubmit={handleEditSubmit}
          onCancel={() => setEditingSpot(null)}
          isPending={update.isPending}
          onGeoError={(msg) => showToast(msg, "error")}
        />
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-black/[0.12] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2">
        <i className="bi bi-p-circle-fill text-maroon" />
        <span className="font-semibold text-sm text-text1">Spot Management</span>
        <button
          onClick={() => setIsAdding(true)}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-maroon text-white hover:bg-maroon/90 transition-colors min-h-[36px]"
        >
          <i className="bi bi-plus-lg" />
          Add Spot
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-black/5">
        <TabButton
          active={activeTab === "all"}
          onClick={() => setActiveTab("all")}
          label="All Spots"
          count={allSpots?.length}
        />
        <TabButton
          active={activeTab === "pending"}
          onClick={() => setActiveTab("pending")}
          label="Pending Review"
          count={pendingSpots?.length}
          highlight={!!pendingSpots?.length}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <Skeleton className="h-40 m-3" />
      ) : allError ? (
        <div className="px-4 py-6 text-center text-sm text-red-500">Failed to load spots</div>
      ) : !spots || spots.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-text1">
          {activeTab === "pending" ? "No spots pending review" : "No spots found"}
        </div>
      ) : (
        <div className="divide-y divide-black/5">
          {spots.map((spot) => (
            <SpotRow
              key={spot.spot_id}
              spot={spot}
              tab={activeTab}
              isPendingOp={isPendingOp}
              confirmDeleteId={confirmDeleteId}
              onEdit={() => setEditingSpot(spot)}
              onVerify={() => verify.mutate(spot.spot_id)}
              onDeleteRequest={() => setConfirmDeleteId(spot.spot_id)}
              onDeleteConfirm={() => handleDelete(spot.spot_id)}
              onDeleteCancel={() => setConfirmDeleteId(null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
  count,
  highlight = false,
}: {
  active: boolean
  onClick: () => void
  label: string
  count?: number
  highlight?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-2 text-xs font-semibold transition-colors ${
        active
          ? "text-maroon border-b-2 border-maroon"
          : "text-text1 hover:text-maroon"
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
            highlight && count > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function SpotRow({
  spot,
  tab,
  isPendingOp,
  confirmDeleteId,
  onEdit,
  onVerify,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  spot: ParkingSpot
  tab: Tab
  isPendingOp: boolean
  confirmDeleteId: number | null
  onEdit: () => void
  onVerify: () => void
  onDeleteRequest: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}) {
  const isConfirming = confirmDeleteId === spot.spot_id

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm text-text1 truncate">{spot.spot_name}</span>
          {!spot.is_verified && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              Pending
            </span>
          )}
        </div>
        <div className="text-xs text-text1 truncate">
          {[
            spot.campus_location,
            spot.parking_type,
            (() => {
              const formattedCost = formatParkingCost(spot.cost)
              return formattedCost === "N/A" ? null : `${formattedCost}/hr`
            })(),
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>

      {isConfirming ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-text1">Delete?</span>
          <button
            onClick={onDeleteConfirm}
            disabled={isPendingOp}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors min-h-[36px] disabled:opacity-50"
          >
            Yes
          </button>
          <button
            onClick={onDeleteCancel}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-text1 hover:bg-gray-200 transition-colors min-h-[36px]"
          >
            No
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          {tab === "pending" && !spot.is_verified && (
            <button
              onClick={onVerify}
              disabled={isPendingOp}
              title="Mark as verified"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors min-h-[36px] disabled:opacity-50"
            >
              <i className="bi bi-check-lg mr-1" />
              Verify
            </button>
          )}
          <button
            onClick={onEdit}
            disabled={isPendingOp}
            title="Edit spot details"
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-text1 border border-black/10 hover:bg-gray-100 transition-colors min-h-[36px] disabled:opacity-50"
          >
            <i className="bi bi-pencil mr-1" />
            Edit
          </button>
          <button
            onClick={onDeleteRequest}
            disabled={isPendingOp}
            title={tab === "pending" ? "Reject this pending spot" : "Delete spot permanently"}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors min-h-[36px] disabled:opacity-50"
          >
            <i className="bi bi-trash mr-1" />
            {tab === "pending" ? "Reject" : "Delete"}
          </button>
        </div>
      )}
    </div>
  )
}
