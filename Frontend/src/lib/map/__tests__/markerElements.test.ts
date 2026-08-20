import { describe, expect, it } from "vitest"

import {
  createNavigationPuck,
  createTeardropPin,
  createUserLocationMarker,
  shortestArcRotation,
} from "../markerElements"

// Every caller places these pins with MapLibre's anchor "bottom" and no offset,
// so the element's bottom edge has to be the tip of the teardrop. When the
// viewBox carried a spare unit below the point, the pin floated about a pixel
// above its coordinate and its outline was clipped square.
describe("createTeardropPin", () => {
  function parse(size: number) {
    const el = createTeardropPin({ fill: "#7A0019", iconColor: "#7A0019", size })
    const svg = el.querySelector("svg")
    if (!svg) throw new Error("pin has no svg")

    const [, , viewW, viewH] = (svg.getAttribute("viewBox") ?? "").split(" ").map(Number)
    const numbers = (svg.querySelector("path")?.getAttribute("d") ?? "")
      .match(/-?\d+(\.\d+)?/g)
      ?.map(Number) ?? []
    // Path commands here are all coordinate pairs, so every odd index is a y.
    const tipY = Math.max(...numbers.filter((_, i) => i % 2 === 1))

    return { el, svg, viewW, viewH, tipY }
  }

  it("ends the viewBox exactly at the tip of the path", () => {
    const { viewH, tipY } = parse(34)
    expect(tipY).toBe(viewH)
  })

  it("scales x and y identically so the silhouette is not squashed", () => {
    const { el, viewW, viewH } = parse(34)
    const width = Number.parseFloat(el.style.width)
    const height = Number.parseFloat(el.style.height)

    expect(width / viewW).toBeCloseTo(height / viewH, 6)
  })

  it("lets the stroke paint past the tip instead of clipping it square", () => {
    // The 2-unit stroke is centered on the path, so its mitred apex reaches
    // past the tip and the default SVG clip would cut the point off flat.
    expect(parse(34).svg.style.overflow).toBe("visible")
  })

  it("holds the tip invariant at every size the app uses", () => {
    for (const size of [26, 28, 34]) {
      const { viewH, tipY } = parse(size)
      expect(tipY).toBe(viewH)
    }
  })
})

// MapLibre translates the marker root from an origin of top:0 left:0 absolute,
// a rule its stylesheet supplies by class. An inline "position: relative" beats
// that rule and puts the root back in normal flow, where it inherits the
// stacked height of every marker appended before it as a fixed pixel offset.
// That offset reads as the marker sliding when the map zooms, jumping when pins
// come and go, and dropping off the bottom of the viewport entirely.
describe("marker roots stay out of normal flow", () => {
  it("positions the teardrop pin root absolutely", () => {
    const el = createTeardropPin({ fill: "#7A0019", iconColor: "#7A0019" })
    expect(el.style.position).toBe("absolute")
    expect(el.style.top).toBe("0px")
    expect(el.style.left).toBe("0px")
  })

  it("positions the user location marker root absolutely", () => {
    const el = createUserLocationMarker()
    expect(el.style.position).toBe("absolute")
    expect(el.style.top).toBe("0px")
    expect(el.style.left).toBe("0px")
  })

  it("positions the navigation puck root absolutely", () => {
    const el = createNavigationPuck()
    expect(el.style.position).toBe("absolute")
    expect(el.style.top).toBe("0px")
    expect(el.style.left).toBe("0px")
    // The root carries MapLibre's own translate. Anything we add here would
    // overwrite it and strand the puck at the top-left of the map.
    expect(el.style.transform).toBe("")
  })

  it("keeps the pulsing halo anchored to the marker root", () => {
    // The halo is absolutely positioned, so it needs the root to remain a
    // containing block after the switch away from position: relative.
    const halo = createUserLocationMarker().firstElementChild as HTMLElement
    expect(halo.style.position).toBe("absolute")
  })
})

// The puck replaces the idle dot for active guidance, so it has to satisfy the
// same MapLibre contract the dot does, and the caller has to be able to rotate
// it through the same [data-heading-transform] hook.
describe("createNavigationPuck", () => {
  it("rotates a child, and centers that rotation on the viewBox", () => {
    const svg = createNavigationPuck().querySelector(
      '[data-heading-transform="true"]',
    ) as SVGElement | null

    expect(svg).not.toBeNull()
    expect(svg!.style.transformBox).toBe("view-box")
    expect(svg!.style.transformOrigin).toBe("center center")
  })

  it("centers the disc in a square box so anchor center lands on the coordinate", () => {
    const el = createNavigationPuck()
    const svg = el.querySelector("svg")!
    const [, , viewW, viewH] = (svg.getAttribute("viewBox") ?? "").split(" ").map(Number)
    const disc = svg.querySelector("circle")!

    expect(viewW).toBe(viewH)
    expect(Number(disc.getAttribute("cx"))).toBe(viewW / 2)
    expect(Number(disc.getAttribute("cy"))).toBe(viewH / 2)
    expect(el.style.width).toBe(el.style.height)
  })

  it("gives every puck its own beam gradient id", () => {
    const idOf = (el: HTMLElement) => el.querySelector("radialGradient")?.getAttribute("id")

    expect(idOf(createNavigationPuck())).not.toBe(idOf(createNavigationPuck()))
  })

  it("drops the accuracy pulse, which only means 'still locating'", () => {
    expect(createNavigationPuck().innerHTML).not.toContain("userPulse")
  })
})

// A CSS rotate transition interpolates the raw numbers, so 350 -> 10 written
// literally spins the puck 340 degrees backwards every time the user drives
// through north. Unwrapping the target keeps each turn the short way round.
describe("shortestArcRotation", () => {
  it("turns forward through north instead of unwinding", () => {
    expect(shortestArcRotation(350, 10)).toBe(370)
  })

  it("turns backward through north instead of winding on", () => {
    expect(shortestArcRotation(10, 350)).toBe(-10)
  })

  it("leaves an unchanged heading alone", () => {
    expect(shortestArcRotation(123, 123)).toBe(123)
  })

  it("keeps accumulating from an already unwrapped angle", () => {
    expect(shortestArcRotation(370, 30)).toBe(390)
  })

  it("resolves the exact half turn deterministically", () => {
    expect(Math.abs(shortestArcRotation(0, 180))).toBe(180)
  })
})
