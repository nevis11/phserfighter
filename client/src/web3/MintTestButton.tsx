import { useState } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { mintDungeonItem, ItemMetadata } from './mintDungeonItem';

export default function MintTestButton() {
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [isMinting, setIsMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMint = async () => {
    if (!connected || !account || !signAndSubmitTransaction) {
      setError('Please connect your wallet first');
      return;
    }

    setIsMinting(true);
    setError(null);
    setTxHash(null);

    try {
      // Test item metadata
      const testItem: ItemMetadata = {
        name: "Flaming Sword",
        description: "A legendary sword that burns enemies",
        uri: "https://example.com/flaming-sword.png",
        attack: 50,
        defense: 10,
        rarity: "Epic",
        itemType: "Sword"
      };

      const hash = await mintDungeonItem(
        signAndSubmitTransaction,
        account.address.toString(),
        testItem
      );

      setTxHash(hash);
    } catch (err: any) {
      console.error('Minting failed:', err);
      setError(err.message || 'Failed to mint NFT');
    } finally {
      setIsMinting(false);
    }
  };

  if (!connected) {
    return null;
  }

  return (
    <div style={{ 
      position: 'absolute', 
      top: '20px', 
      right: '20px', 
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      <button
        onClick={handleMint}
        disabled={isMinting}
        style={{
          padding: '10px 20px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          cursor: isMinting ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
          opacity: isMinting ? 0.7 : 1,
        }}
      >
        {isMinting ? 'Minting...' : 'Test Mint Loot'}
      </button>

      {txHash && (
        <div style={{ 
          background: 'rgba(0,0,0,0.7)', 
          color: 'white', 
          padding: '10px', 
          borderRadius: '5px',
          fontSize: '12px'
        }}>
          Success! Tx: {txHash.substring(0, 10)}...
        </div>
      )}

      {error && (
        <div style={{ 
          background: 'rgba(255,0,0,0.7)', 
          color: 'white', 
          padding: '10px', 
          borderRadius: '5px',
          fontSize: '12px'
        }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}