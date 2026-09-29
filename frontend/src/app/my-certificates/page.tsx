"use client";

import { useState, useEffect, useCallback } from "react";
import { GraduationCap, Wallet, Loader2, AlertCircle, Inbox, RefreshCw } from "lucide-react";
import Navbar from "@/components/Navbar";
import CertificateCard from "@/components/CertificateCard";
import { connectWallet, getConnectedAddress } from "@/utils/metamask";
import { getCertificatesOfHolder, checkNetwork, switchToSepolia, type CertificateOnChain } from "@/utils/contract";
import { fetchMetadata, type CertificateMetadata } from "@/utils/pinata";

interface CertWithMeta {
  onChain: CertificateOnChain;
  meta:    CertificateMetadata | null;
}

export default function MyCertificatesPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [certs, setCerts]     = useState<CertWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const loadCertificates = useCallback(async (addr: string) => {
    setLoading(true);
    setError(null);
    setCerts([]);
    try {
      const onChainList = await getCertificatesOfHolder(addr);
      const withMeta: CertWithMeta[] = await Promise.all(
        onChainList.map(async (cert) => {
          try { return { onChain: cert, meta: await fetchMetadata(cert.metadataURI) }; }
          catch { return { onChain: cert, meta: null }; }
        })
      );
      setCerts(withMeta);
    } catch (e: unknown) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("Failed to fetch") || msg.includes("network") || msg.includes("could not detect")) {
        setError("ไม่สามารถเชื่อมต่อ Sepolia network ได้ — กรุณาตรวจสอบว่า MetaMask เชื่อมต่อ Sepolia อยู่");
      } else if (msg.includes("contract")) {
        setError("ไม่พบ Contract — ตรวจสอบ NEXT_PUBLIC_CONTRACT_ADDRESS ใน .env.local");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConnect = async () => {
    setError(null);
    try {
      const addr = await connectWallet();
      const ok = await checkNetwork();
      if (!ok) await switchToSepolia();
      setAddress(addr);
      await loadCertificates(addr);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    (async () => {
      const addr = await getConnectedAddress();
      if (addr) { setAddress(addr); await loadCertificates(addr); }
    })();
  }, [loadCertificates]);

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-7 h-7 text-gray-700" />
          <h1 className="text-3xl font-bold text-gray-900">ใบประกาศของฉัน</h1>
        </div>
        <p className="text-gray-500 mb-8 text-sm">
          ใบประกาศนียบัตรทั้งหมดที่ผูกกับ wallet ของคุณบน blockchain
        </p>

        {/* ยังไม่ได้เชื่อม */}
        {!address && (
          <div className="card max-w-md mx-auto text-center py-12">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-blue-500" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">เชื่อมต่อ MetaMask</h2>
            <p className="text-sm text-gray-500 mb-6">เชื่อมต่อ wallet เพื่อดูใบประกาศนียบัตรของคุณ</p>
            <button onClick={handleConnect} className="btn-primary px-8 flex items-center gap-2 mx-auto">
              <Wallet className="w-4 h-4" /> Connect MetaMask
            </button>
          </div>
        )}

        {/* Loading */}
        {address && loading && (
          <div className="text-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-blue-400 mx-auto mb-3" />
            <p className="font-medium text-gray-500">กำลังดึงข้อมูลจาก blockchain...</p>
            <p className="text-xs mt-1 text-gray-400">ใช้ MetaMask provider ที่เชื่อมอยู่</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded-lg text-sm mb-6">
            <p className="font-semibold mb-1 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> เกิดข้อผิดพลาด
            </p>
            <p className="mb-3">{error}</p>
            <div className="bg-white border border-red-100 rounded-lg p-3 space-y-1 text-xs text-red-600">
              <p className="font-semibold text-red-700 mb-1">ตรวจสอบ:</p>
              <p>• MetaMask เชื่อมต่ออยู่ที่ <strong>Sepolia Testnet</strong> หรือไม่</p>
              <p>• <code>NEXT_PUBLIC_CONTRACT_ADDRESS</code> ใน .env.local ถูกต้องไหม</p>
            </div>
            {address && (
              <button onClick={() => loadCertificates(address)}
                className="mt-3 btn-secondary text-xs py-1.5 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> ลองใหม่
              </button>
            )}
          </div>
        )}

        {/* ไม่มีใบประกาศ */}
        {address && !loading && certs.length === 0 && !error && (
          <div className="card max-w-md mx-auto text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-700 mb-1">ยังไม่มีใบประกาศ</h2>
            <p className="text-sm text-gray-500">wallet นี้ยังไม่ได้รับใบประกาศนียบัตรใดๆ</p>
            <p className="text-xs text-gray-400 mt-2 font-mono break-all">{address}</p>
          </div>
        )}

        {/* Certificate Cards */}
        {certs.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-6">
              พบ <strong>{certs.length}</strong> ใบประกาศ
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {certs.map(({ onChain, meta }) => (
                <CertificateCard key={onChain.tokenId.toString()} onChain={onChain} meta={meta} />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
