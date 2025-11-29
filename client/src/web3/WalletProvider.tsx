import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { Network } from '@aptos-labs/ts-sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// 0. Setup queryClient
const queryClient = new QueryClient();

// 1. Define the networks
const networks = {
  devnet: Network.DEVNET,
  testnet: Network.TESTNET,
  mainnet: Network.MAINNET,
};

// 2. Create wallet adapter provider
export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{ network: Network.TESTNET }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </AptosWalletAdapterProvider>
  );
}