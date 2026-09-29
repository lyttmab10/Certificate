/**
 * global.d.ts
 * ───────────
 * เพิ่ม type ให้ window.ethereum (MetaMask injected provider)
 * เพื่อให้ TypeScript ไม่ error เวลาใช้ window.ethereum
 */

interface EthereumProvider {
  isMetaMask?: boolean;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  removeListener(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};
