import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateProfile } from "../services/profileApi"
import { useAuthStore } from "../../../store/authStore"
import { useUIStore } from "../../../store/uiStore"
import Input from "../../../components/ui/Input"
import Button from "../../../components/ui/Button"

// Validation schema -- all fields optional since user may only update one thing
const profileSchema = z.object({
    prefered_name: z.string().min(1).max(50).optional().or(z.literal("")),
    major: z.string().max(100).optional().or(z.literal("")),
    grade_level: z.enum(["Freshman", "Sophomore", "Junior", "Senior", "Graduate", "Other"]).optional(),
    graduation_year: z.number().min(2024).max(2035).optional(),
    housing_type: z.enum(["On Campus", "Off Campus", "Commuter"]).optional(),
})

type ProfileFormData = z.infer<typeof profileSchema>

export default function UserProfile() {
    const user = useAuthStore((s) => s.user)
    const showToast = useUIStore((s) => s.showToast)
    const queryClient = useQueryClient()

    const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
        // Pre-fill with current user data from authStore
        defaultValues: {
            prefered_name: user?.prefered_name ?? "",
            major: user?.major ?? "",
            grade_level: (user?.grade_level ?? undefined) as ProfileFormData["grade_level"],
            graduation_year: user?.graduation_year ?? undefined,
            housing_type: (user?.housing_type ?? undefined) as ProfileFormData["housing_type"],
        }
    })

    const mutation = useMutation({
        mutationFn: updateProfile,
        onSuccess: () => {
            showToast("Profile updated", "success")
            queryClient.invalidateQueries({ queryKey: ["me"] })
        },
        onError: () => showToast("Failed to update profile", "error"),
    })

    const onSubmit = (data: ProfileFormData) => {
        // Strip empty strings before sending — don't send "" to the backend
        const cleaned = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== "" && v !== undefined)
        )
        mutation.mutate(cleaned)
    }

    return (
        <div className="px-5 pt-3 pb-4">

            {/* Section label — matches .set-sec-lbl */}
            <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-text3 mb-3">
                Account
            </div>

            {/* Read-only email row — matches .set-row */}
            <div className="flex items-center gap-3 py-2.5 border-b border-black/5">
                <div className="w-[30px] h-[30px] rounded-[8px] bg-maroon-light flex items-center justify-center flex-shrink-0">
                    <i className="bi bi-envelope-fill text-maroon text-sm" />
                </div>
                <div className="flex-1">
                    <div className="text-[13px] font-medium text-text1">Email</div>
                    <div className="text-[11px] text-text2 mt-0.5">{user?.email ?? "—"}</div>
                </div>
            </div>

            {/* Editable fields */}
            {/* No HTML form tags — use div wrapper, call handleSubmit via button onClick */}
            <div className="mt-3 space-y-3">

                <Input
                    label="Preferred name"
                    placeholder="What should we call you?"
                    {...register("prefered_name")}
                    error={errors.prefered_name?.message}
                />

                <Input
                    label="Major"
                    placeholder="e.g. Computer Science"
                    {...register("major")}
                    error={errors.major?.message}
                />

                {/* Grade level — select dropdown, not a text input */}
                <div>
                    <label className="block text-[11px] font-semibold text-text2 mb-1">
                        Grade Level
                    </label>
                    <select
                        {...register("grade_level")}
                        className="w-full text-sm border border-black/9 rounded-[10px] px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon"
                    >
                        <option value="">Select grade level</option>
                        {["Freshman", "Sophomore", "Junior", "Senior", "Graduate", "Other"].map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                </div>

                {/* Housing type */}
                <div>
                    <label className="block text-[11px] font-semibold text-text2 mb-1">
                        Housing Type
                    </label>
                    <select
                        {...register("housing_type")}
                        className="w-full text-sm border border-black/9 rounded-[10px] px-3 py-2.5 bg-white outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon"
                    >
                        <option value="">Select Housing Type</option>
                        {["On Campus", "Off Campus", "Commuter"].map(g => (
                            <option key={g} value={g}>{g}</option>
                        ))}
                    </select>
                </div>

                <Button
                    onClick={handleSubmit(onSubmit)}
                    isLoading={mutation.isPending}
                    disabled={!isDirty}
                    className="w-full mt-1"
                >
                    Save Changes
                </Button>

            </div>
        </div>
    )
}
