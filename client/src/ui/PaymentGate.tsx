import { useEffect, useMemo, useState } from 'react'
import { useAccount, useWaitForTransactionReceipt, useWriteContract, useSendTransaction } from 'wagmi'
import { parseEther, parseUnits } from 'viem'
import type Phaser from 'phaser'
import { SCENE_KEYS } from '../game/scenes/scene-keys'

const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
    stateMutability: 'nonpayable',
  },
] as const

function getEnv(name: string) {
  return (import.meta as any).env?.[name]
}

function getMasterAddress(): string | undefined {
  // Vite exposes only VITE_ vars; also read non-prefixed as a fallback if injected elsewhere
  return getEnv('VITE_MASTER_WALLET_ADDRESS') || getEnv('MASTER_WALLET_ADDRESS')
}

function getTokenAddress(): string | undefined {
  return getEnv('VITE_STT_TOKEN_ADDRESS') || getEnv('STT_TOKEN_ADDRESS')
}

function getTokenDecimals(): number {
  const v = getEnv('VITE_STT_DECIMALS') || getEnv('STT_DECIMALS')
  const n = v ? Number(v) : 18
  return Number.isFinite(n) && n > 0 ? n : 18
}

export default function PaymentGate() {
  const { address, isConnected } = useAccount()
  const [show, setShow] = useState(false)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [error, setError] = useState<string | null>(null)

  const master = import.meta.env?.VITE_MASTER_WALLET_ADDRESS as string | undefined
  const token = getTokenAddress()
  const decimals = getTokenDecimals()


  // Wagmi actions
  const sendNative = useSendTransaction()
  const writeErc20 = useWriteContract()
  const receipt = useWaitForTransactionReceipt({ hash: txHash })

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
    console.debug('[PaymentGate] isConnected=', isConnected, 'master=', master, 'token=', token)
    if (isConnected) {
      // Show even if master is missing, but surface an inline config error
      setShow(true)
      pauseGame()
    } else {
      setShow(false)
      resumeGame()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, master])

  useEffect(() => {
    if (receipt.data?.status === 'success') {
      setShow(false)
      setError(null)
      resumeGame()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.data?.status])

  const pay = async () => {
    if (!master) {
      setError('Master wallet address is not configured')
      return
    }
    setError(null)
    try {
      // Amount: 0.1 STT
      if (token) {
        const value = parseUnits('0.1', decimals)
        const hash = await writeErc20.writeContractAsync({
          abi: ERC20_ABI,
          address: token as `0x${string}`,
          functionName: 'transfer',
          args: [master as `0x${string}` , value],
        })
        setTxHash(hash)
      } else {
        const value = parseEther('0.1')
        const hash = await sendNative.sendTransactionAsync({
          to: master as `0x${string}`,
          value,
        })
        setTxHash(hash)
      }
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Payment failed')
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
            Send <strong>0.1 STT</strong> to unlock the game.
          </div>

          <div style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.8, marginBottom: 18 }}>
            Recipient: {master || 'N/A'}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={pay}
              disabled={sendNative.isPending || writeErc20.isPending}
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.25)',
                background: 'linear-gradient(180deg, rgba(30,41,59,0.95), rgba(15,23,42,0.95))',
                color: '#e5e7eb',
                fontFamily: 'Press Start 2P, monospace',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {sendNative.isPending || writeErc20.isPending ? 'Confirm in wallet...' : 'Pay 0.1 STT'}
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
