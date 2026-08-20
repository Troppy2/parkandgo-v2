import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import DeleteAccountModal from "../DeleteAccountModal"

const { deleteAccountMock } = vi.hoisted(() => ({ deleteAccountMock: vi.fn() }))

vi.mock("../../services/profileApi", () => ({
  deleteAccount: deleteAccountMock,
}))

describe("DeleteAccountModal", () => {
  beforeEach(() => {
    cleanup()
    deleteAccountMock.mockReset()
    deleteAccountMock.mockResolvedValue(undefined)
  })

  afterEach(() => cleanup())

  function setup() {
    const onClose = vi.fn()
    const onDeleted = vi.fn()
    render(<DeleteAccountModal onClose={onClose} onDeleted={onDeleted} />)
    const confirmButton = screen.getByRole("button", { name: "Delete forever" })
    const input = screen.getByLabelText(/type delete to confirm/i)
    return { onClose, onDeleted, confirmButton, input }
  }

  // The action is irreversible and there is no support path that can undo it,
  // so a stray tap must not be able to reach it.
  it("keeps the delete button disabled until the confirmation word is typed", () => {
    const { confirmButton, input } = setup()
    expect(confirmButton).toBeDisabled()

    fireEvent.change(input, { target: { value: "delete my stuff" } })
    expect(confirmButton).toBeDisabled()

    fireEvent.change(input, { target: { value: "DELETE" } })
    expect(confirmButton).not.toBeDisabled()
  })

  it("accepts the confirmation word case insensitively", () => {
    const { confirmButton, input } = setup()
    fireEvent.change(input, { target: { value: " delete " } })
    expect(confirmButton).not.toBeDisabled()
  })

  it("calls the API and reports success to the caller", async () => {
    const { onDeleted, confirmButton, input } = setup()
    fireEvent.change(input, { target: { value: "DELETE" } })
    fireEvent.click(confirmButton)

    await waitFor(() => expect(deleteAccountMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
  })

  // A failed delete must not sign the user out, or they would be locked out of
  // an account that still exists.
  it("shows an error and does not report success when the API fails", async () => {
    deleteAccountMock.mockRejectedValue(new Error("500"))
    const { onDeleted, confirmButton, input } = setup()

    fireEvent.change(input, { target: { value: "DELETE" } })
    fireEvent.click(confirmButton)

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())
    expect(onDeleted).not.toHaveBeenCalled()
    // Still usable, so the user can retry rather than being stuck.
    expect(screen.getByRole("button", { name: "Delete forever" })).not.toBeDisabled()
  })

  it("tells the user what survives deletion before they confirm", () => {
    setup()
    expect(screen.getByText(/parking spots you submitted/i)).toBeInTheDocument()
    expect(screen.getByText(/analytics events/i)).toBeInTheDocument()
  })

  it("closes on cancel without calling the API", () => {
    const { onClose, onDeleted } = setup()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onClose).toHaveBeenCalled()
    expect(deleteAccountMock).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
  })
})
