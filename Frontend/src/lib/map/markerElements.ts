// Shared builders for MapLibre custom marker DOM elements.
//
// All place markers share one teardrop silhouette so the map reads as a single
// brand system (UMN maroon + gold). MapLibre positions the marker ROOT element
// via inline translate3d(), so transforms (the teardrop rotation, the heading
// rotation, the location pulse) must live on CHILD elements only. The root may
// safely carry a filter, which is how each pin gets a grounded drop shadow.

interface TeardropPinOptions {
  /** Fill color of the pin body. */
  fill: string
  /** Color of the glyph (icon or letter) shown inside the white head. */
  iconColor: string
  /** Bootstrap-icon class to show inside the head, e.g. "bi-calendar-event-fill". */
  iconClass?: string
  /** Short label (1 char) shown instead of an icon, e.g. "P". */
  label?: string
  /** Width of the pin head in px. Defaults to 28. */
  size?: number
}

/**
 * Build a teardrop place marker as a smooth SVG balloon: a rounded head with a
 * white inner disc and a brand-colored glyph, tapering to a point that sits on
 * the coordinate when the marker uses anchor "bottom". The glyph is layered as
 * HTML over the head so we can reuse Bootstrap icons or a display-font letter.
 */
export function createTeardropPin({ fill, iconColor, iconClass, label, size = 28 }: TeardropPinOptions): HTMLDivElement {
  // Path is authored in a 30x40 viewBox and scaled to `size`; the head center
  // lands at (size/2, size/2) and the tip near the bottom edge.
  const w = Math.round(size)
  const h = Math.round(size * (40 / 30))

  const wrap = document.createElement("div")
  wrap.style.cssText = `
    position: relative;
    width: ${w}px;
    height: ${h}px;
    cursor: pointer;
    filter: drop-shadow(0 4px 5px rgba(0,0,0,0.3));
    animation: markerFade 0.22s ease-out;
  `

  // A large white disc holds an icon/letter; a bare pin gets a small center dot.
  const hasGlyph = Boolean(label || iconClass)
  const discRadius = hasGlyph ? 6.6 : 3.8

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", "0 0 30 40")
  svg.setAttribute("width", String(w))
  svg.setAttribute("height", String(h))
  svg.style.cssText = "position:absolute; top:0; left:0; display:block;"
  svg.innerHTML = `
    <path d="M15 1.2 C7.27 1.2 1 7.47 1 15.2 C1 23.4 8.4 30.6 15 39 C21.6 30.6 29 23.4 29 15.2 C29 7.47 22.73 1.2 15 1.2 Z"
      fill="${fill}" stroke="#ffffff" stroke-width="2"/>
    <circle cx="15" cy="15.2" r="${discRadius}" fill="#ffffff"/>
  `
  wrap.appendChild(svg)

  if (!hasGlyph) return wrap

  // Glyph layer, centered on the head.
  const glyph = document.createElement("div")
  glyph.style.cssText = `
    position: absolute;
    top: ${(w / 2).toFixed(1)}px;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${iconColor};
    line-height: 1;
    pointer-events: none;
  `
  if (label) {
    glyph.textContent = label
    glyph.style.fontWeight = "800"
    glyph.style.fontFamily = "'Bricolage Grotesque', Inter, sans-serif"
    glyph.style.fontSize = `${Math.round(w * 0.46)}px`
  } else if (iconClass) {
    const icon = document.createElement("i")
    icon.className = `bi ${iconClass}`
    icon.style.fontSize = `${Math.round(w * 0.4)}px`
    glyph.appendChild(icon)
  }
  wrap.appendChild(glyph)

  return wrap
}

/**
 * Build the live user-location marker in the Google/Apple Maps idiom: a solid
 * dot with a white ring, a soft pulsing accuracy halo, and a translucent
 * heading cone. The caller rotates the cone by updating the transform of the
 * [data-heading-transform] child.
 */
export function createUserLocationMarker(): HTMLDivElement {
  const wrap = document.createElement("div")
  wrap.setAttribute("data-user-location-marker", "true")
  // Explicit min-width/height stops a flex parent from squeezing the puck.
  wrap.style.cssText = `
    position: relative;
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  `

  // Pulsing accuracy halo (child, so its scale animation never touches the root).
  const halo = document.createElement("div")
  halo.style.cssText = `
    position: absolute;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(122,0,25,0.28);
    animation: userPulse 2.4s ease-out infinite;
  `

  // Heading cone rotates with the device heading; the dot stays put. Because the
  // dot sits at the center, rotating the whole SVG only visually moves the cone.
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", "0 0 44 44")
  svg.setAttribute("width", "44")
  svg.setAttribute("height", "44")
  svg.setAttribute("data-heading-transform", "true")
  // The dot sits at the viewBox center (22,22). Rotating around the viewBox
  // center keeps the dot fixed while only the heading cone sweeps.
  svg.style.cssText = `
    position: relative;
    display: block;
    transition: transform 60ms linear;
    transform-origin: center center;
    transform-box: view-box;
  `

  const coneGradientId = `userCone-${Math.random().toString(36).slice(2, 9)}`
  svg.innerHTML = `
    <defs>
      <radialGradient id="${coneGradientId}" cx="50%" cy="100%" r="100%">
        <stop offset="0%" stop-color="rgba(255,204,51,0.55)"/>
        <stop offset="100%" stop-color="rgba(255,204,51,0)"/>
      </radialGradient>
    </defs>
    <path d="M22 22 L10 5 Q22 1 34 5 Z" fill="url(#${coneGradientId})"/>
    <circle cx="22" cy="22" r="7" fill="#FFCC33" stroke="#ffffff" stroke-width="3"
      style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35));"/>
  `

  wrap.appendChild(halo)
  wrap.appendChild(svg)
  return wrap
}
