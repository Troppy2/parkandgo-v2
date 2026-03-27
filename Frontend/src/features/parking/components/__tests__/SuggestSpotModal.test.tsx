import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import SuggestSpotModal from "../SuggestSpotModal"
import { useAuthStore } from "../../../../store/authStore"
import { useUIStore } from "../../../../store/uiStore"

function Wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe("SuggestSpotModal guest access", () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState())
    useAuthStore.getState().clearAuth()
  })

  it("closes immediately and shows a toast for guests", async () => {
    const showToast = vi.fn()

    useAuthStore.getState().setGuest()
    useUIStore.setState({
      ...useUIStore.getState(),
      suggestSpotOpen: true,
      showToast,
    })

    render(<SuggestSpotModal />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Sign in to suggest a parking spot.", "error")
    })

    expect(useUIStore.getState().suggestSpotOpen).toBe(false)
    expect(screen.queryByText("Suggest a Spot")).not.toBeInTheDocument()
  })
})
