import { useEffect, useMemo, useState } from 'react'
import type Phaser from 'phaser'
import { useAccount } from 'wagmi'

export default function WalletGuard() {
  const { isConnected, isConnecting } = useAccount()
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // mount animation flag
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    // show guard when not connected
    setShow(!isConnected)
  }, [isConnected])

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 60,
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Connect your wallet"
        style={{
          width: 460,
          maxWidth: '100%',
          borderRadius: 14,
          padding: 2,
          background:
            'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(16,185,129,0.9), rgba(59,130,246,0.9))',
          boxShadow: '0 20px 60px rgba(0,0,0,0.55), inset 0 0 20px rgba(255,255,255,0.05)',
          transform: mounted ? 'scale(1)' : 'scale(0.98)',
          opacity: mounted ? 1 : 0,
          transition: 'transform 180ms ease-out, opacity 200ms ease-out',
        }}
      >
        <div
          style={{
            borderRadius: 12,
            background: 'radial-gradient(120% 120% at 0% 0%, #0b1220 0%, #0b1220 40%, #0a1120 100%)',
            border: '1px solid rgba(148,163,184,0.25)',
            color: '#e5e7eb',
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div
              aria-hidden
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #22c55e, #06b6d4)',
                boxShadow: '0 4px 16px rgba(6,182,212,0.35)',
                display: 'grid',
                placeItems: 'center',
                color: '#0b1220',
                fontWeight: 800,
              }}
            >
              ⚡
            </div>
            <div style={{ fontFamily: 'Press Start 2P, monospace', fontSize: 13, letterSpacing: 0.3 }}>
              Connect your wallet to continue
            </div>
          </div>

          <div style={{ fontFamily: 'Press Start 2P, monospace', fontSize: 11, opacity: 0.85, marginBottom: 18, lineHeight: 1.6 }}>
            You need to connect to Somnia Testnet to start playing.
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            {/* Show a skeleton while web component loads */}
            <div style={{ minWidth: 180, minHeight: 44, display: 'grid', placeItems: 'center' }}>
              <appkit-button></appkit-button>
            </div>
          </div>

          {isConnecting && (
            <div style={{ textAlign: 'center', marginTop: 12, fontFamily: 'Press Start 2P, monospace', fontSize: 10, opacity: 0.75 }}>
              Waiting for wallet...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
