import { useState } from "react";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useUIStore } from "../../store/uiStore";
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (isDesktop) {
    return (
      // Desktop: flex row — sidebar on left, map fills the rest
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar
          onSettingsClick={() => setSettingsOpen(true)}
          onSuggestSpotClick={() => setSuggestSpotOpen(true)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        >
          {spotResults}
        </Sidebar>

        {/* Map area fills remaining space — flex-1 auto-expands when sidebar collapses */}
        <div className="flex-1 relative">{mapContent}</div>
      </div>
    );
  }

  // Mobile: map fills full screen, header + bottom sheet float on top
  return (
    <div className="flex-1 relative w-screen h-screen overflow-hidden">
      {/* Map fills the whole background */}
      {mapContent}

      {/* Header floats above the map */}
      <Header onSettingsClick={() => setSettingsOpen(true)} />

      {/* Bottom sheet floats above the map */}
      <MobileNav
        onSuggestSpotClick={() => setSuggestSpotOpen(true)}
      >
        {spotResults}
      </MobileNav>
    </div>
  );
}
