import { useEffect, useState } from 'react';

export default function ConnectWalletButton() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if ('customElements' in window && typeof window.customElements.whenDefined === 'function') {
      window.customElements.whenDefined('appkit-button').then(() => {
        if (!cancelled) setReady(true);
      });
    } else {
      // Fallback: assume available shortly
      const t = setTimeout(() => !cancelled && setReady(true), 500);
      return () => clearTimeout(t);
    }

    // Safety: if not resolved in 2s, show anyway
    const safety = setTimeout(() => !cancelled && setReady(true), 2000);
    return () => {
      cancelled = true;
      clearTimeout(safety);
    };
  }, []);

  if (!ready) {
    return (
      <div
        aria-busy
        aria-label="Loading wallet"
        style={{
          width: 160,
          height: 40,
          borderRadius: 9999,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.18), rgba(255,255,255,0.08))',
          backgroundSize: '200% 100%',
          animation: 'appkit-sheen 1.2s linear infinite',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.25)'
        }}
      >
        <style>{`@keyframes appkit-sheen { from { background-position: 0% 0 } to { background-position: -200% 0 } }`}</style>
      </div>
    );
  }

  return <appkit-button />;
}
