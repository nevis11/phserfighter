import { useRef } from "react";
import { IRefPhaserGame, PhaserGame } from "./PhaserGame";
import ConnectWalletButton from "./ui/ConnectWalletButton";
import WalletGuard from "./ui/WalletGuard";
import PaymentGate from "./ui/PaymentGate";

function App() {
    const phaserRef = useRef<IRefPhaserGame | null>(null);

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
            </div>

            <WalletGuard />
            <PaymentGate />
        </div>
    );
}

export default App;
