// Shared builders for MapLibre custom marker DOM elements.
//
// All place markers share one teardrop silhouette so the map reads as a single
// brand system (UMN maroon + gold). MapLibre positions the marker ROOT element
// via inline translate3d(), so transforms (the teardrop rotation, the heading
// rotation, the location pulse) must live on CHILD elements only. The root may
// safely carry a filter, which is how each pin gets a grounded drop shadow.
//
// For the same reason the root must stay OUT of normal flow. MapLibre's own
// stylesheet gives it "position: absolute; top: 0; left: 0", and its translate
// assumes that origin. An inline "position: relative" beats that class rule and
// leaves the root in flow, so every marker picks up the stacked height of the
// markers appended before it as a fixed pixel offset: the puck reads as sliding
// whenever the map zooms, jumps as pins come and go, and eventually falls off
// the bottom of the viewport. Set the absolute positioning inline instead, so
// the invariant holds even if the MapLibre stylesheet is not loaded.

// Authored geometry of the teardrop path, in its own coordinate space.
//
// The silhouette is drawn 30 units wide with its point at y = 39 and the head
// centered at y = 15.2. The element box is cropped to exactly the tip, so the
// bottom edge of the marker IS the point: callers get a pixel-accurate marker
// from anchor "bottom" alone and must not pass a compensating offset.
const PIN_VIEW_W = 30
const PIN_TIP_Y = 39
const PIN_HEAD_CY = 15.2

// Active-guidance puck geometry. The box is square and the disc is centered in
// it, so MapLibre anchor "center" puts the disc exactly on the coordinate. The
// box is far wider than the disc on purpose: the beam needs room to fade out.
const PUCK_VIEW = 72
const PUCK_DISC_R = 17

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
  // The box is cropped to the tip rather than to the authored 40-unit canvas,
  // so the element's bottom edge lands exactly on the point. Heights stay
  // fractional on purpose: rounding them would scale y differently from x and
  // squash the silhouette by a fraction of a percent.
  const scale = size / PIN_VIEW_W
  const w = size
  const h = size * (PIN_TIP_Y / PIN_VIEW_W)

  const wrap = document.createElement("div")
  wrap.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
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
  svg.setAttribute("viewBox", `0 0 ${PIN_VIEW_W} ${PIN_TIP_Y}`)
  svg.setAttribute("width", String(w))
  svg.setAttribute("height", String(h))
  // overflow must stay visible: the 2-unit stroke is centered on the path, so
  // its mitred apex reaches ~1.6 units past the tip. The default SVG clip would
  // slice that apex off square and the pin would read as blunt.
  svg.style.cssText = "position:absolute; top:0; left:0; display:block; overflow:visible;"
  svg.innerHTML = `
    <path d="M15 1.2 C7.27 1.2 1 7.47 1 15.2 C1 23.4 8.4 30.6 15 39 C21.6 30.6 29 23.4 29 15.2 C29 7.47 22.73 1.2 15 1.2 Z"
      fill="${fill}" stroke="#ffffff" stroke-width="2"/>
    <circle cx="${PIN_VIEW_W / 2}" cy="${PIN_HEAD_CY}" r="${discRadius}" fill="#ffffff"/>
  `
  wrap.appendChild(svg)

  if (!hasGlyph) return wrap

  // Glyph layer, centered on the head. Driven off the head center rather than
  // half the width, which is only an approximation of it.
  const glyph = document.createElement("div")
  glyph.style.cssText = `
    position: absolute;
    top: ${(PIN_HEAD_CY * scale).toFixed(2)}px;
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
    position: absolute;
    top: 0;
    left: 0;
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

/**
 * Build the active-guidance puck: a maroon disc with a white ring, a gold
 * chevron pointing along the direction of travel, and a long gold beam fading
 * out ahead of it. This replaces the idle location dot once the user presses
 * Start, in the idiom every navigation app uses: the marker stops reporting
 * "here is where you are, roughly" and starts reporting "here is where you are
 * heading". The accuracy pulse is deliberately absent, since the app is no
 * longer locating.
 *
 * Same contract as createUserLocationMarker: the caller rotates the puck by
 * writing a transform on the [data-heading-transform] child, never on the root.
 */
export function createNavigationPuck(): HTMLDivElement {
  const wrap = document.createElement("div")
  wrap.setAttribute("data-navigation-puck", "true")
  // Explicit min-width/height stops a flex parent from squeezing the puck.
  wrap.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: ${PUCK_VIEW}px;
    height: ${PUCK_VIEW}px;
    min-width: ${PUCK_VIEW}px;
    min-height: ${PUCK_VIEW}px;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));
  `

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("viewBox", `0 0 ${PUCK_VIEW} ${PUCK_VIEW}`)
  svg.setAttribute("width", String(PUCK_VIEW))
  svg.setAttribute("height", String(PUCK_VIEW))
  svg.setAttribute("data-heading-transform", "true")
  // The disc sits at the viewBox center, so rotating about that center sweeps
  // the beam and the chevron while the disc itself stays put on the coordinate.
  svg.style.cssText = `
    position: relative;
    display: block;
    overflow: visible;
    transition: transform 140ms ease-out;
    transform-origin: center center;
    transform-box: view-box;
    animation: puckScaleIn 0.24s cubic-bezier(0.2, 0.9, 0.3, 1.2);
  `

  // Per-instance id: two pucks in one document must not share a gradient.
  const beamGradientId = `puckBeam-${Math.random().toString(36).slice(2, 9)}`
  const c = PUCK_VIEW / 2
  svg.innerHTML = `
    <defs>
      <radialGradient id="${beamGradientId}" cx="50%" cy="100%" r="100%">
        <stop offset="0%" stop-color="rgba(255,204,51,0.62)"/>
        <stop offset="60%" stop-color="rgba(255,204,51,0.18)"/>
        <stop offset="100%" stop-color="rgba(255,204,51,0)"/>
      </radialGradient>
    </defs>
    <path d="M${c} ${c} L15 6 Q${c} 0 57 6 Z" fill="url(#${beamGradientId})"/>
    <circle cx="${c}" cy="${c}" r="${PUCK_DISC_R}" fill="#7A0019" stroke="#ffffff" stroke-width="3.5"/>
    <path d="M${c} 27 L45 46.5 L${c} 40 L27 46.5 Z" fill="#FFCC33"/>
  `

  wrap.appendChild(svg)
  return wrap
}

/**
 * Unwrap a target heading so a CSS rotate transition always takes the short way
 * round. Rotating from 350deg to 10deg is a 20deg turn, but writing the raw
 * values makes the browser animate 340deg backwards and the puck spins on every
 * pass through north. Returning 370 instead keeps the angle continuous.
 */
export function shortestArcRotation(previousDeg: number, targetDeg: number): number {
  const delta = (((targetDeg - previousDeg) % 360) + 540) % 360 - 180
  return previousDeg + delta
}
