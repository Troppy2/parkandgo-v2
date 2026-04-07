import { useEffect, useRef } from "react"

interface NavigationTTSOptions {
  enabled: boolean
  text: string | null
  preferredVoiceName?: string | null
}

function pickBestVoice(
  voices: SpeechSynthesisVoice[],
  preferredVoiceName?: string | null
): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined

  if (preferredVoiceName) {
    const exactMatch = voices.find((voice) => voice.name === preferredVoiceName)
    if (exactMatch) return exactMatch
  }

  const preferredPatterns = [
    /google.*english/i,
    /microsoft.*(aria|jenny|guy|davis)/i,
    /samantha|siri|allison|ava/i,
  ]

  for (const pattern of preferredPatterns) {
    const match = voices.find(
      (voice) => pattern.test(voice.name) && voice.lang.toLowerCase().startsWith("en")
    )
    if (match) return match
  }

  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en-us")) ??
    voices.find((voice) => voice.default) ??
    voices[0]
  )
}

export function useNavigationTTS({ enabled, text, preferredVoiceName }: NavigationTTSOptions) {
  const lastSpokenRef = useRef<string>("")

  useEffect(() => {
    if (!enabled || !text) return
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    if (text === lastSpokenRef.current) return

    const utterance = new SpeechSynthesisUtterance(text)
    const voices = window.speechSynthesis.getVoices()
    const selectedVoice = pickBestVoice(voices, preferredVoiceName)

    if (selectedVoice) {
      utterance.voice = selectedVoice
      utterance.lang = selectedVoice.lang
    } else {
      utterance.lang = "en-US"
    }
    utterance.rate = 0.95
    utterance.pitch = 1

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    lastSpokenRef.current = text
  }, [enabled, preferredVoiceName, text])

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return
    return () => {
      window.speechSynthesis.cancel()
    }
  }, [enabled])
}
