import { useState } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useAuthStore } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import { useNavStore } from "../../store/navStore";
import Header from "./Header";
import MobileNav from "./MobileNav";
import Sidebar from "./Sidebar";

interface ResponsiveContainerProps {
  spotResults: React.ReactNode;
  mapContent: React.ReactNode;
}

export default function ResponsiveContainer({
  spotResults,
  mapContent,
}: ResponsiveContainerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const setSuggestSpotOpen = useUIStore((s) => s.setSuggestSpotOpen);
  const showToast = useUIStore((s) => s.showToast);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isNavigating = useNavStore((s) => s.isNavigating);
  const isGuest = useAuthStore((s) => s.isGuest);

  const handleSuggestSpotClick = () => {
    if (isGuest) {
      showToast("Sign in to suggest a parking spot.", "error");
      return;
    }
    setSuggestSpotOpen(true);
  };

  if (isDesktop) {
    return (
      // Desktop: flex row — sidebar on left, map fills the rest
      <div className="flex h-screen w-screen overflow-hidden">
        {/* Hide sidebar during navigation */}
        {!isNavigating && (
          <Sidebar
            onSettingsClick={() => setSettingsOpen(true)}
            onSuggestSpotClick={handleSuggestSpotClick}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          >
            {spotResults}
          </Sidebar>
        )}

        {/* Map area fills remaining space — flex-1 auto-expands when sidebar collapses or during navigation */}
        <div className="flex-1 relative">{mapContent}</div>
      </div>
    );
  }

  // Mobile: map fills full screen, header + bottom sheet float on top (hidden during navigation)
  return (
    <div className="flex-1 relative w-screen h-screen overflow-hidden">
      {/* Map fills the whole background */}
      {mapContent}

      {/* Header floats above the map — hide during navigation */}
      {!isNavigating && <Header onSettingsClick={() => setSettingsOpen(true)} />}

      {/* Bottom sheet floats above the map — hide during navigation */}
      {!isNavigating && (
        <MobileNav
          onSuggestSpotClick={handleSuggestSpotClick}
        >
          {spotResults}
        </MobileNav>
      )}
    </div>
  );
}
