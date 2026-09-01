import { useEffect, useState } from 'react'

const MOBILE_UA_RE = /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i
// iPadOS 13+ reports as "Macintosh" but exposes touch points — catch it too.
const IPADOS_RE = /Macintosh/i

function detectMobile() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isMobileUA = MOBILE_UA_RE.test(ua)
  const isIpadOS = IPADOS_RE.test(ua) && navigator.maxTouchPoints > 1
  const isNarrow = window.innerWidth < 900
  const isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches
  return isMobileUA || isIpadOS || (isNarrow && isCoarsePointer)
}

export default function DesktopOnlyGate({ children }) {
  const [isMobile, setIsMobile] = useState(detectMobile)

  useEffect(() => {
    const check = () => setIsMobile(detectMobile())
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (isMobile) {
    return (
      <div style={{
        height: '100vh', width: '100vw', background: '#0a0b0d', color: '#e8e8e8',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '32px', fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🖥️</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#c5a050', marginBottom: 8, letterSpacing: '.5px' }}>
          DESKTOP ONLY
        </div>
        <div style={{ fontSize: 13, color: '#9a9a9a', maxWidth: 340, lineHeight: 1.6 }}>
          Onyx Crypto is built for a desktop trading workflow and isn't supported on phones or small touch screens.
          Please open this link on a laptop or desktop computer.
        </div>
      </div>
    )
  }

  return children
}
