import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useEffect, useState } from 'react';

export default function ConnectWalletButton() {
  const { connected, account, connect, disconnect, wallets } = useWallet();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (wallets.length > 0) {
      setConnecting(true);
      try {
        // Connect to the first available wallet
        await connect(wallets[0].name);
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      } finally {
        setConnecting(false);
      }
    }
  };

  if (connected) {
    return (
      <button
        onClick={() => disconnect()}
        style={{
          padding: '10px 20px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        Disconnect {account?.ansName || account?.address.toString().substring(0, 6) + "..."}
      </button>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting || wallets.length === 0}
      style={{
        padding: '10px 20px',
        borderRadius: '8px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        cursor: connecting || wallets.length === 0 ? 'not-allowed' : 'pointer',
        fontWeight: 'bold',
        opacity: connecting || wallets.length === 0 ? 0.7 : 1,
      }}
    >
      {connecting ? 'Connecting...' : wallets.length === 0 ? 'No Wallets Found' : 'Connect Wallet'}
    </button>
  );
}
