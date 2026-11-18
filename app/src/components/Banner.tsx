import { useEffect, useState } from 'react'
import { BannerMessage, subscribeToBanners } from '../banner'
import './Banner.css'

export const BANNER_AUTO_DISMISS_MS = 6000

/** Shows the latest banner; dismissible and auto-dismissed after a few seconds. */
function Banner() {
  const [message, setMessage] = useState<BannerMessage | null>(null)

  useEffect(() => subscribeToBanners(setMessage), [])

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setMessage(null), BANNER_AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [message])

  if (!message) return null

  return (
    <div className="banner" role="status" aria-live="polite">
      <span className="banner__text">{message.text}</span>
      <button
        type="button"
        className="banner__dismiss"
        aria-label="Dismiss"
        onClick={() => setMessage(null)}
      >
        ×
      </button>
    </div>
  )
}

export default Banner
