"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  GraduationCap, Wallet, ChevronDown, ChevronUp,
  Copy, LogOut, AlertTriangle, Settings,
} from "lucide-react";
import { connectWallet, getConnectedAddress, shortenAddress } from "@/utils/metamask";
import { checkNetwork, switchToSepolia } from "@/utils/contract";

const ADMIN_ADDRESS = (process.env.NEXT_PUBLIC_ADMIN_ADDRESS ?? "").toLowerCase();

export default function Navbar() {
  const [address, setAddress]           = useState<string | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = !!address && address.toLowerCase() === ADMIN_ADDRESS;

  // ── ตรวจสอบ wallet ที่เชื่อมอยู่แล้วตอน mount ─────────────
  useEffect(() => {
    (async () => {
      const addr = await getConnectedAddress();
      if (addr) {
        setAddress(addr);
        const ok = await checkNetwork();
        setWrongNetwork(!ok);
      }
    })();

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: unknown) => {
        const list = accounts as string[];
        setAddress(list[0] ?? null);
        setDropdownOpen(false);
      });
      window.ethereum.on("chainChanged", async () => {
        const ok = await checkNetwork();
        setWrongNetwork(!ok);
      });
    }
  }, []);

  // ── ปิด dropdown เมื่อคลิกข้างนอก ─────────────────────────
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const addr = await connectWallet();
      setAddress(addr);
      const ok = await checkNetwork();
      setWrongNetwork(!ok);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setAddress(null);
    setWrongNetwork(false);
    setDropdownOpen(false);
  };

  const handleSwitchNetwork = async () => {
    try { await switchToSepolia(); setDropdownOpen(false); }
    catch (e: unknown) { alert((e as Error).message); }
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-blue-700 text-lg">
          <GraduationCap className="w-6 h-6" />
          <span>CertSBT</span>
        </Link>

        {/* Wallet Section */}
        <div className="flex items-center gap-3">
          {wrongNetwork && (
            <button
              onClick={handleSwitchNetwork}
              className="flex items-center gap-1.5 text-xs bg-red-100 text-red-700 border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              เปลี่ยนเป็น Sepolia
            </button>
          )}

          {address ? (
            <div className="relative flex items-center gap-1" ref={dropdownRef}>
              {/* Copy icon ติดกับ address */}
              <button
                onClick={() => { navigator.clipboard.writeText(address); }}
                title="Copy address"
                className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>

              {/* Address + dropdown trigger */}
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-sm font-mono px-4 py-2 rounded-lg transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                {shortenAddress(address)}
                {dropdownOpen
                  ? <ChevronUp className="w-3.5 h-3.5 text-blue-400" />
                  : <ChevronDown className="w-3.5 h-3.5 text-blue-400" />}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50" style={{ top: "100%" }}>
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-xs text-gray-400 mb-0.5">Wallet ที่เชื่อมต่อ</p>
                    <p className="text-xs font-mono text-gray-700 break-all">{address}</p>
                    {isAdmin && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                        <Settings className="w-3 h-3" /> Admin
                      </span>
                    )}
                  </div>

                  {wrongNetwork && (
                    <button onClick={handleSwitchNetwork}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> เปลี่ยนเป็น Sepolia
                    </button>
                  )}

                  <Link href="/my-certificates" onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <GraduationCap className="w-4 h-4 text-gray-400" /> ใบประกาศของฉัน
                  </Link>

                  {isAdmin && (
                    <Link href="/admin" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Settings className="w-4 h-4 text-gray-400" /> Admin Panel
                    </Link>
                  )}

                  <div className="border-t border-gray-100 mt-1" />

                  <button onClick={handleDisconnect}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 rounded-b-xl">
                    <LogOut className="w-4 h-4" /> Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={handleConnect} disabled={loading} className="btn-primary text-sm flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              {loading ? "กำลังเชื่อมต่อ..." : "Connect MetaMask"}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
