import type { ReactNode } from "react"

interface MapControlsProps {
  onZoomIn: () => void
  onZoomOut: () => void
  onLocate: () => void
}

interface ControlButtonProps {
  onClick: () => void
  title: string
  children: ReactNode
  border?: boolean
}

function ControlButton({ onClick, title, children, border }: ControlButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        w-11 h-11 flex items-center justify-center
        text-[#1a1a1a] hover:text-[#7A0019]
        hover:bg-[#7A0019]/8 active:bg-[#7A0019]/14
        transition-colors duration-150 cursor-pointer
        ${border ? "border-t border-black/8" : ""}
      `}
    >
      {children}
    </button>
  )
}

export default function MapControls({ onZoomIn, onZoomOut, onLocate }: MapControlsProps) {
  return (
    <div className="absolute right-3 bottom-24 flex flex-col z-10">
      {/* Zoom cluster */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.15)] border border-black/8 overflow-hidden mb-2">
        <ControlButton onClick={onZoomIn} title="Zoom in">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </ControlButton>
        <ControlButton onClick={onZoomOut} title="Zoom out" border>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3.5 9h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </ControlButton>
      </div>

      {/* Locate button */}
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.15)] border border-black/8 overflow-hidden">
        <ControlButton onClick={onLocate} title="My location">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M9 1.5V5M9 13v3.5M1.5 9H5M13 9h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </ControlButton>
      </div>
    </div>
  )
}