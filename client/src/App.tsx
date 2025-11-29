import { useEffect } from "react";
import { useRef } from "react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import ConnectWalletButton from "./ui/ConnectWalletButton";
import WalletGuard from "./ui/WalletGuard";
import PaymentGate from "./ui/PaymentGate";
import MintTestButton from "./web3/MintTestButton";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { setupPhaserMinting, cleanupPhaserMinting } from "./web3/phaserIntegration";

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);
    const { connected, account, signAndSubmitTransaction } = useWallet();

    // Set up Phaser minting integration when wallet is connected
    useEffect(() => {
        if (connected && account && signAndSubmitTransaction) {
            setupPhaserMinting(signAndSubmitTransaction, account.address.toString());
        } else {
            cleanupPhaserMinting();
        }

        // Clean up on unmount
        return () => {
            cleanupPhaserMinting();
        };
    }, [connected, account, signAndSubmitTransaction]);

    return (
        <div className="flex flex-col">
            <header className="flex items-center justify-between p-5">
                <div className="text-lg font-semibold tracking-wider">
                    SpearHead
                </div>
                <ConnectWalletButton />
            </header>

            <div className=" flex-2">
                <PhaserGame ref={phaserRef} />
                <MintTestButton />
            </div>

            <WalletGuard />
            <PaymentGate />
        </div>
    );
}

export default App;
