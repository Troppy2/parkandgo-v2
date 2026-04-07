import type { ErrorInfo, ReactNode } from "react"
import { Component } from "react"

type AdminErrorBoundaryProps = {
  children: ReactNode
}

type AdminErrorBoundaryState = {
  hasError: boolean
  errorMessage: string | null
}

export default class AdminErrorBoundary extends Component<
  AdminErrorBoundaryProps,
  AdminErrorBoundaryState
> {
  state: AdminErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  }

  static getDerivedStateFromError(error: unknown): AdminErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    }
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("Admin route crashed:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f5f5f7] text-text1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-black/[0.12] rounded-2xl shadow-sm p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <i className="bi bi-exclamation-triangle-fill" />
              <h2 className="text-sm font-semibold">Admin page failed to load</h2>
            </div>
            <p className="text-xs text-text1">
              A runtime error occurred while rendering the admin dashboard.
            </p>
            {this.state.errorMessage && (
              <pre className="text-xs bg-black/[0.03] border border-black/[0.08] rounded-lg p-2 overflow-auto whitespace-pre-wrap break-words">
                {this.state.errorMessage}
              </pre>
            )}
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-maroon text-white text-xs font-semibold hover:bg-maroon-hover transition-colors"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
