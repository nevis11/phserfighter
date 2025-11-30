import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useEffect, useState } from 'react';

export default function ConnectWalletButton() {
  const { connected, account, connect, disconnect, wallets, isLoading } = useWallet();
  const [connecting, setConnecting] = useState(false);

  // Log wallet state for debugging
  useEffect(() => {
    console.log('Wallet state:', { connected, wallets: wallets.length, isLoading });
  }, [connected, wallets, isLoading]);

  const handleConnect = async () => {
    console.log('Attempting to connect wallet...');
    console.log('Available wallets:', wallets);
    
    if (isLoading) {
      console.log('Wallet adapter is still loading...');
      return;
    }
    
    if (wallets.length === 0) {
      console.log('No wallets available');
      return;
    }
    
    setConnecting(true);
    try {
      // Connect to the first available wallet
      console.log('Connecting to wallet:', wallets[0].name);
      await connect(wallets[0].name);
      console.log('Wallet connected successfully');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setConnecting(false);
    }
  };

  if (connected) {
    return (
      <button
        onClick={() => {
          console.log('Disconnecting wallet...');
          disconnect();
        }}
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

  // Show loading state
  if (isLoading) {
    return (
      <button
        disabled={true}
        style={{
          padding: '10px 20px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          cursor: 'not-allowed',
          fontWeight: 'bold',
          opacity: 0.7,
        }}
      >
        Loading Wallets...
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
