import { useAuthStore } from "../../store/authStore"
import SearchBar from "../../features/search/components/SearchBar"

interface HeaderProps {
  onSettingsClick: () => void
}

export default function Header({ onSettingsClick }: HeaderProps) {
  const user = useAuthStore((s) => s.user)

  const initials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : "?"

  return (
    <div className="absolute top-10 left-3 right-3 z-20 flex items-center gap-2">
      {/* Search bar with integrated gear button */}
      <div className="flex-1">
        <SearchBar onSettingsClick={onSettingsClick} />
      </div>

      {/* User avatar — shows Google profile pic if available, else initials */}
      <div className="w-10 h-10 rounded-full bg-maroon text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden">
        {user?.profile_pic
          ? <img src={user.profile_pic} className="w-full h-full object-cover" alt="" />
          : initials
        }
      </div>
    </div>
  )
}
