/**
 * metamask.ts
 * ===========
 * Helper สำหรับจัดการ MetaMask connection state
 */

import { BrowserProvider } from "ethers";

export interface WalletState {
  address:   string | null;
  chainId:   number | null;
  connected: boolean;
}

/**
 * เชื่อมต่อ MetaMask → คืน address
 */
export async function connectWallet(): Promise<string> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask ไม่ได้ติดตั้ง กรุณาติดตั้ง MetaMask ก่อน");
  }
  const provider = new BrowserProvider(window.ethereum);
  const accounts: string[] = await provider.send("eth_requestAccounts", []);
  if (accounts.length === 0) throw new Error("ไม่ได้รับอนุญาตจาก MetaMask");
  return accounts[0];
}

/**
 * ดึง address ที่เชื่อมต่ออยู่ (ไม่ popup)
 */
export async function getConnectedAddress(): Promise<string | null> {
  if (typeof window === "undefined" || !window.ethereum) return null;
  const provider = new BrowserProvider(window.ethereum);
  const accounts: string[] = await provider.send("eth_accounts", []);
  return accounts[0] ?? null;
}

/**
 * ตัด address ให้สั้น: 0x1234...abcd
 */
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * ฟังก์ติดตาม account change / chain change
 * เรียกครั้งเดียวตอน mount component
 */
export function listenWalletEvents(callbacks: {
  onAccountChange?: (accounts: string[]) => void;
  onChainChange?:   (chainId: string) => void;
}) {
  if (typeof window === "undefined" || !window.ethereum) return () => {};

  const handleAccounts = (accounts: unknown) => {
    callbacks.onAccountChange?.(accounts as string[]);
  };
  const handleChain = (chainId: unknown) => {
    callbacks.onChainChange?.(chainId as string);
  };

  window.ethereum.on("accountsChanged", handleAccounts);
  window.ethereum.on("chainChanged", handleChain);

  // คืน cleanup function
  return () => {
    window.ethereum?.removeListener("accountsChanged", handleAccounts);
    window.ethereum?.removeListener("chainChanged", handleChain);
  };
}
