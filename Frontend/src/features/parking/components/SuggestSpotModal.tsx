import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../../store/authStore";
import { useUIStore } from "../../../store/uiStore";
import apiClient from "../../../lib/api/client";
import { ENDPOINTS } from "../../../lib/api/endpoints";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";

const suggestSchema = z.object({
  spot_name: z.string().min(2, "Spot name must be at least 2 characters"),
  campus_location: z.enum(["East Bank", "West Bank", "St. Paul"], {
    message: "Please select a campus location",
  }),
  parking_type: z.enum(["Parking Garage", "Surface Lot", "Street Parking"], {
    message: "Please select a parking type",
  }),
  cost: z.coerce.number().min(0, "Cost must be 0 or more"),
  address: z.string().min(3, "Address is required"),
  latitude: z.coerce.number().min(-90, "Must be between -90 and 90").max(90, "Must be between -90 and 90"),
  longitude: z.coerce.number().min(-180, "Must be between -180 and 180").max(180, "Must be between -180 and 180"),
});

type SuggestFormInput = z.input<typeof suggestSchema>;
type SuggestFormData = z.output<typeof suggestSchema>;

export default function SuggestSpotModal() {
  const { suggestSpotOpen, setSuggestSpotOpen, showToast } = useUIStore();
  const isGuest = useAuthStore((s) => s.isGuest);
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<
    SuggestFormInput,
    unknown,
    SuggestFormData
  >({
    resolver: zodResolver(suggestSchema),
    defaultValues: { cost: 0 },
  });

  useEffect(() => {
    if (!suggestSpotOpen) return;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [suggestSpotOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!suggestSpotOpen || !isGuest) return;

    reset();
    setSuggestSpotOpen(false);
    showToast("Sign in to suggest a parking spot.", "error");
  }, [isGuest, reset, setSuggestSpotOpen, showToast, suggestSpotOpen]);

  const mutation = useMutation({
    mutationFn: (data: SuggestFormData) =>
      apiClient.post(ENDPOINTS.PARKING.BASE, data).then((r) => r.data),
    onSuccess: () => {
      showToast("Spot submitted! It will appear after verification.", "success");
      queryClient.invalidateQueries({ queryKey: ["parking"] });
      reset();
      setTimeout(() => setSuggestSpotOpen(false), 1500);
    },
    onError: () => showToast("Failed to submit spot - please try again", "error"),
  });

  if (!suggestSpotOpen || isGuest) return null;

  const handleClose = () => {
    reset();
    setSuggestSpotOpen(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/45 z-[110] flex items-end md:items-center md:justify-center backdrop-blur-[1px]"
      onClick={handleClose}
    >
      <div
        className="w-full md:w-[400px] bg-white rounded-t-[24px] md:rounded-[18px] shadow-2xl pb-6 max-h-[90vh] overflow-y-auto scrollbar-none overscroll-contain"
        style={{ scrollbarWidth: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-9 h-1 bg-[#d1d1d6] rounded-full mx-auto mt-3 md:hidden" />

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/8">
          <span className="text-[17px] font-bold tracking-tight text-text1">
            <i className="bi bi-plus-circle-fill text-maroon mr-2" />
            Suggest a Spot
          </span>
          <button
            onClick={handleClose}
            className="w-7 h-7 bg-black/7 rounded-full flex items-center justify-center text-text2 text-[11px] hover:bg-maroon-light transition-colors"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <div className="px-5 pt-4 space-y-3 pb-2">
          <Input
            label="Spot Name"
            placeholder="e.g. Oak Street Ramp"
            {...register("spot_name")}
            error={errors.spot_name?.message}
          />

          <div>
            <label className="block text-[11px] font-semibold text-text2 mb-1">Campus *</label>
            <select
              {...register("campus_location")}
              className="w-full text-sm border border-black/9 rounded-[10px] px-3 py-2.5 bg-white text-text1 outline-none focus:ring-0 focus:border-maroon"
            >
              <option value="">Select campus</option>
              {["East Bank", "West Bank", "St. Paul"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.campus_location && (
              <p className="text-[11px] text-red-600 mt-0.5 flex items-center gap-1">
                <i className="bi bi-exclamation-circle" />
                {errors.campus_location.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-text2 mb-1">Parking Type *</label>
            <select
              {...register("parking_type")}
              className="w-full text-sm border border-black/9 rounded-[10px] px-3 py-2.5 bg-white text-text1 outline-none focus:ring-0 focus:border-maroon"
            >
              <option value="">Select type</option>
              {["Parking Garage", "Surface Lot", "Street Parking"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {errors.parking_type && (
              <p className="text-[11px] text-red-600 mt-0.5 flex items-center gap-1">
                <i className="bi bi-exclamation-circle" />
                {errors.parking_type.message}
              </p>
            )}
          </div>

          <Input
            label="Cost ($/hr) - enter 0 if free"
            placeholder="e.g. 1.50"
            type="number"
            {...register("cost")}
            error={errors.cost?.message}
          />

          <Input
            label="Address"
            placeholder="e.g. 500 Oak St SE, Minneapolis"
            {...register("address")}
            error={errors.address?.message}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Latitude *"
              placeholder="e.g. 44.9740"
              type="number"
              step="any"
              {...register("latitude")}
              error={errors.latitude?.message}
            />
            <Input
              label="Longitude *"
              placeholder="e.g. -93.2277"
              type="number"
              step="any"
              {...register("longitude")}
              error={errors.longitude?.message}
            />
          </div>

          <p className="text-[10px] text-text3">
            <i className="bi bi-geo-alt mr-1" />
            Tip: right-click on Google Maps to copy coordinates
          </p>

          <Button
            onClick={handleSubmit((data) => mutation.mutate(data))}
            isLoading={mutation.isPending}
            className="w-full mt-1 min-h-[44px] bg-maroon text-white hover:bg-maroon-hover active:bg-[var(--color-maroon-dark)]"
          >
            <i className="bi bi-send-fill mr-1" />
            Submit Spot
          </Button>
        </div>
      </div>
    </div>
  );
}
