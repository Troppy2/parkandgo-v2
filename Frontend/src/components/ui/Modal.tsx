import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import clsx from "clsx"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null

  return createPortal(    
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-sm z-40"
      />

      {/* Panel — everything inside this one div */}
      <div className={clsx(
        "fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50",
        "pb-8"
      )}>

        {/* Handle bar */}
        <div className="w-9 h-1 bg-gray-300 mx-auto mt-3 rounded" />

        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/9">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          <button onClick={onClose} className="ml-auto">
            <i className="bi bi-x text-xl text-text2" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pt-4">
          {children}
        </div>

      </div>
    </>,
    document.body
  )
}