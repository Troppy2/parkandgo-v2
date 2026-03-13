import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import ToastContainer from "../components/ui/Toast"
import RouteDisplay from "@/features/navigation/components/RouteDisplay"
import ETAIndicator from "@/features/navigation/components/ETAIndicator"
import TurnByTurn from "@/features/navigation/components/TurnByTurn"
import SettingsModal from "../features/profile/components/SettingsModal"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
})

interface ProvidersProps {
  children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastContainer />
      <TurnByTurn />
      <RouteDisplay />
      <ETAIndicator />
      <SettingsModal /> 
    </QueryClientProvider>
  )
}
