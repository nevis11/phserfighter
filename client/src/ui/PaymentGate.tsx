import { useEffect, useMemo, useState } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { Aptos, AptosConfig, Network, AccountAddress } from '@aptos-labs/ts-sdk'
import type Phaser from 'phaser'
import { SCENE_KEYS } from '../game/scenes/scene-keys'

// Initialize Aptos client
const aptosConfig = new AptosConfig({ network: Network.TESTNET })
const aptos = new Aptos(aptosConfig)

export default function PaymentGate() {
  const { connected, account, signAndSubmitTransaction } = useWallet()
  const [show, setShow] = useState(false)
  const [txHash, setTxHash] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const master = import.meta.env?.VITE_MASTER_WALLET_ADDRESS as string | undefined

  // Resume game on component mount to ensure it's not paused
  useEffect(() => {
    const game = (window as any).__phaserGame as Phaser.Game | undefined
    const scene = game?.scene?.getScene(SCENE_KEYS.GAME_SCENE as any)
    scene?.scene.resume()
  }, [])

  const pauseGame = useMemo(() => {
    return () => {
      const game = (window as any).__phaserGame as Phaser.Game | undefined
      const scene = game?.scene?.getScene(SCENE_KEYS.GAME_SCENE as any)
      scene?.scene.pause()
    }
  }, [])

  const resumeGame = useMemo(() => {
    return () => {
      const game = (window as any).__phaserGame as Phaser.Game | undefined
      const scene = game?.scene?.getScene(SCENE_KEYS.GAME_SCENE as any)
      scene?.scene.resume()
    }
  }, [])

  useEffect(() => {
    // Verbose logs to help diagnose why the gate may not be visible
    console.debug('[PaymentGate] connected=', connected, 'master=', master)
    
    // Only show payment gate if:
    // 1. Wallet is connected
    // 2. Master wallet address is configured
    // 3. Transaction hasn't been completed yet
    if (connected && master && !txHash) {
      setShow(true)
      pauseGame()
    } else {
      setShow(false)
      resumeGame()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, master, txHash])

  useEffect(() => {
    // Check transaction status periodically
    if (txHash) {
      const interval = setInterval(async () => {
        try {
          const tx = await aptos.getTransactionByHash({ transactionHash: txHash })
          if (tx.type === 'user_transaction' && tx.success) {
            setShow(false)
            setError(null)
            resumeGame()
            clearInterval(interval)
          }
        } catch (e) {
          console.error('Error checking transaction status:', e)
        }
      }, 2000)

      return () => clearInterval(interval)
    }
  }, [txHash])

  const pay = async () => {
    if (!master) {
      setError('Master wallet address is not configured')
      return
    }
    
    if (!account) {
      setError('No account connected')
      return
    }

    setError(null)
    setIsProcessing(true)
    
    try {
      // Amount: 0.0001 APT (in octas - smallest unit) for testing
      const amount = 10000 // 0.0001 APT in octas (1 APT = 100,000,000 octas)
      
      const response = await signAndSubmitTransaction({
        sender: account.address.toString(),
        data: {
          function: '0x1::aptos_account::transfer',
          typeArguments: [],
          functionArguments: [master, amount],
        },
      })
      setTxHash(response.hash)
      
      // Resume game after successful transaction
      setTimeout(() => {
        setShow(false)
        resumeGame()
      }, 1000)
    } catch (e: any) {
      console.error('Payment failed:', e)
      setError(e?.message || 'Payment failed')
    } finally {
      setIsProcessing(false)
    }
  }

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
        zIndex: 70,
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Pay to play"
        style={{
          width: 480,
          maxWidth: '100%',
          borderRadius: 14,
          padding: 2,
          background:
            'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(16,185,129,0.9), rgba(59,130,246,0.9))',
          boxShadow: '0 20px 60px rgba(0,0,0,0.55), inset 0 0 20px rgba(255,255,255,0.05)',
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
              💎
            </div>
            <div style={{ fontFamily: 'Press Start 2P, monospace', fontSize: 13, letterSpacing: 0.3 }}>
              Pay to Play
            </div>
          </div>

          <div style={{ fontFamily: 'Press Start 2P, monospace', fontSize: 11, opacity: 0.9, lineHeight: 1.7, marginBottom: 16 }}>
            Send <strong>0.0001 APT</strong> to unlock the game.
          </div>

          <div style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.8, marginBottom: 18 }}>
            Recipient: {master || 'N/A'}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={pay}
              disabled={isProcessing}
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.25)',
                background: 'linear-gradient(180deg, rgba(30,41,59,0.95), rgba(15,23,42,0.95))',
                color: '#e5e7eb',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: 11,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing ? 0.7 : 1,
              }}
            >
              {isProcessing ? 'Confirm in wallet...' : 'Pay 0.0001 APT'}
            </button>

            {txHash && (
              <div style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.85 }}>
                Tx: {txHash.slice(0, 10)}…
              </div>
            )}
          </div>

          {error && (
            <div style={{ marginTop: 10, color: '#fca5a5', fontFamily: 'monospace', fontSize: 12 }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  )
}
