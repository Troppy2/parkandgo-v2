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
    graduation_year: z.coerce.number().min(2024).max(2035).optional().or(z.literal("")),
    housing_type: z.enum(["On Campus", "Off Campus", "Commuter"]).optional(),
})

type ProfileFormData = z.infer<typeof profileSchema>

export default function UserProfile() {
    const user = useAuthStore((s) => s.user)
    const showToast = useUIStore((s) => s.showToast)
    const queryClient = useQueryClient()

    const initials = user
        ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
        : "?"

    const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ProfileFormData>({
        resolver: zodResolver(profileSchema),
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
        const cleaned = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== "" && v !== undefined)
        )
        mutation.mutate(cleaned)
    }

    // Guest state — show placeholder account row only
    if (!user) {
        return (
            <div className="px-5 pt-4 pb-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-text3 mb-3">Account</div>
                <div className="flex items-center gap-3 py-3 border-b border-black/8 mb-3">
                    <div className="w-10 h-10 rounded-full bg-bg2 flex items-center justify-center flex-shrink-0">
                        <i className="bi bi-person text-text2 text-xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-semibold text-text1">Guest</div>
                        <div className="text-[11px] text-text2">Guest</div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="px-5 pt-4 pb-4">

            {/* Section label */}
            <div className="text-[10px] font-bold uppercase tracking-[0.9px] text-text3 mb-3">
                Account
            </div>

            {/* User avatar + name + email header row — matches design */}
            <div className="flex items-center gap-3 py-3 border-b border-black/8 mb-3">
                <div className="w-10 h-10 rounded-full bg-maroon flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                    {user?.profile_pic
                        ? <img src={user.profile_pic} className="w-full h-full object-cover" alt="" />
                        : initials
                    }
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-text1 truncate">
                        {user?.prefered_name || `${user?.first_name} ${user?.last_name}`}
                    </div>
                    <div className="text-[11px] text-text2 truncate">{user?.email ?? "—"}</div>
                </div>
                {/* Google connected badge */}
                <div className="flex items-center gap-1 bg-bg2 rounded-full px-2 py-1 flex-shrink-0">
                    <i className="bi bi-google text-[11px] text-text2" />
                    <span className="text-[10px] text-text2 font-medium">Google</span>
                </div>
            </div>

            {/* Editable fields */}
            <div className="space-y-3">

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

                {/* Grade level */}
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

                {/* Graduation year */}
                <Input
                    label="Graduation Year"
                    placeholder="e.g. 2027"
                    type="number"
                    {...register("graduation_year")}
                    error={errors.graduation_year?.message}
                />

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
                    className="w-full mt-1 min-h-[44px]"
                >
                    Save Changes
                </Button>

            </div>
        </div>
    )
}
