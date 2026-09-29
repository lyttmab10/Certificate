"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import { connectWallet, getConnectedAddress } from "@/utils/metamask";
import { issueCertificate, checkNetwork, switchToSepolia } from "@/utils/contract";
import { ipfsToHttp } from "@/utils/pinata";
import { drawNameOnCertificate } from "@/utils/canvasText";
import {
  Wallet, RefreshCw, CheckCircle, Loader2, Settings,
  GraduationCap, ExternalLink, AlertCircle, Upload, ImageIcon,
} from "lucide-react";

const PRESET_TEMPLATE_CID = process.env.NEXT_PUBLIC_CERTIFICATE_TEMPLATE_CID ?? "";

const FONT_OPTIONS = [
  { label: "Mitr",         sub: "กลม นุ่ม",        value: "Mitr, sans-serif" },
  { label: "Sarabun",      sub: "สบาย ทั่วไป",     value: "Sarabun, sans-serif" },
  { label: "Kanit",        sub: "ทันสมัย",          value: "Kanit, sans-serif" },
  { label: "Charm",        sub: "มีลูกเล่น",        value: "Charm, cursive" },
  { label: "Charmonman",   sub: "ลายมือสวย",        value: "Charmonman, cursive" },
  { label: "Noto Serif",   sub: "เป็นทางการ",       value: "'Noto Serif Thai', serif" },
];

const PRESET_COLORS = ["#1a1a2e", "#2c2c2c", "#7c4a1e", "#1a3a5c", "#4a1a5c", "#1a4a2e"];

type Step = "idle" | "generating-preview" | "uploading-image" | "pinning-metadata" | "minting" | "done" | "error";

interface FormData {
  studentName: string;
  courseId:    string;
  recipientAddress: string;
}

export default function AdminPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const hasPreset       = PRESET_TEMPLATE_CID !== "";
  const templateHttpUrl = hasPreset ? ipfsToHttp(`ipfs://${PRESET_TEMPLATE_CID}`) : null;

  const [customTemplateFile, setCustomTemplateFile] = useState<File | null>(null);
  const [customTemplateUrl,  setCustomTemplateUrl]  = useState<string | null>(null);
  const activeTemplateUrl = customTemplateUrl ?? templateHttpUrl;

  const [finalImageBlob,  setFinalImageBlob]  = useState<File | null>(null);
  const [finalPreviewUrl, setFinalPreviewUrl] = useState<string | null>(null);

  const [form, setForm] = useState<FormData>({
    studentName: "", courseId: "", recipientAddress: "",
  });

  const [nameTopPercent, setNameTopPercent] = useState(54);
  const [nameFontSize,   setNameFontSize]   = useState(32);
  const [nameFont,       setNameFont]       = useState(FONT_OPTIONS[0].value);
  const [nameColor,      setNameColor]      = useState("#1a1a2e");

  const [step,     setStep]     = useState<Step>("idle");
  const [txHash,   setTxHash]   = useState<string | null>(null);
  const [tokenId,  setTokenId]  = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Generate Preview ──────────────────────────────────────
  const generatePreview = useCallback(async (
    templateUrl: string, studentName: string,
    topPercent: number, fontSize: number, fontFamily: string, color: string,
  ) => {
    if (!templateUrl || !studentName.trim()) return;
    setStep("generating-preview");
    try {
      const file = await drawNameOnCertificate(templateUrl, studentName, {
        topPercent, fontSize, fontFamily, color, fontWeight: "bold",
      });
      setFinalImageBlob(file);
      setFinalPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setStep("idle");
    } catch (e: unknown) {
      setStep("error");
      setErrorMsg(`วาดชื่อบนรูปไม่ได้: ${(e as Error).message}`);
    }
  }, []);

  // debounce พิมพ์ชื่อ 300ms
  useEffect(() => {
    if (!activeTemplateUrl || !form.studentName.trim()) {
      setFinalPreviewUrl(null); setFinalImageBlob(null); return;
    }
    const t = setTimeout(() => {
      generatePreview(activeTemplateUrl, form.studentName, nameTopPercent, nameFontSize, nameFont, nameColor);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.studentName, activeTemplateUrl]);

  // slider/font/color → generate ทันที
  useEffect(() => {
    if (!activeTemplateUrl || !form.studentName.trim()) return;
    generatePreview(activeTemplateUrl, form.studentName, nameTopPercent, nameFontSize, nameFont, nameColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameTopPercent, nameFontSize, nameFont, nameColor]);

  // ── Auto-detect wallet on mount ──────────────────────────
  useEffect(() => {
    (async () => {
      const addr = await getConnectedAddress();
      if (addr) {
        setWalletAddress(addr);
        const ok = await checkNetwork();
        if (!ok) await switchToSepolia();
      }
    })();
    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: unknown) => {
        const list = accounts as string[];
        setWalletAddress(list[0] ?? null);
      });
    }
  }, []);

  const handleConnect = async () => {
    try {
      const addr = await connectWallet();
      setWalletAddress(addr);
      const ok = await checkNetwork();
      if (!ok) await switchToSepolia();
    } catch (e: unknown) {
      setErrorMsg((e as Error).message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomTemplateFile(file);
    setCustomTemplateUrl(URL.createObjectURL(file));
    setFinalImageBlob(null);
    setFinalPreviewUrl(null);
  };

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress)  { alert("กรุณาเชื่อมต่อ MetaMask ก่อน"); return; }
    if (!finalImageBlob) { alert("กรุณารอให้ระบบสร้างรูปที่มีชื่อก่อน"); return; }
    setErrorMsg(null);

    try {
      setStep("uploading-image");
      const fd = new FormData();
      fd.append("file", finalImageBlob);
      const uploadRes = await fetch("/api/upload-image", { method: "POST", body: fd });
      if (!uploadRes.ok) throw new Error((await uploadRes.json()).message);
      const { ipfsUri: imageIpfsUri } = await uploadRes.json();

      setStep("pinning-metadata");
      const pinRes = await fetch("/api/issue-certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: form.studentName,
          courseName:  form.courseId,   // ใช้ courseId แทน courseName ที่ลบออกไปแล้ว
          courseId:    form.courseId,
          imageIpfsUri,
          recipientAddress: form.recipientAddress,
        }),
      });
      if (!pinRes.ok) throw new Error((await pinRes.json()).message);
      const { metadataUri } = await pinRes.json();

      setStep("minting");
      const { txHash: hash, tokenId: tid } = await issueCertificate({
        recipient:   form.recipientAddress,
        studentName: form.studentName,
        courseName:  form.courseId,   // ใช้ courseId แทน
        courseId:    form.courseId,
        metadataURI: metadataUri,
      });
      setTxHash(hash);
      setTokenId(tid?.toString() ?? null);
      setStep("done");
    } catch (e: unknown) {
      setStep("error");
      const raw = (e as Error).message ?? "";
      // แปล error จาก contract ให้อ่านง่าย
      if (raw.includes("already issued for this course")) {
        setErrorMsg("wallet นี้ได้รับใบประกาศของ Course ID นี้ไปแล้ว — เปลี่ยน Course ID หรือใช้ wallet ผู้รับอื่น");
      } else if (raw.includes("caller is not owner")) {
        setErrorMsg("wallet ของคุณไม่ใช่ owner ของ contract — กรุณาใช้ wallet ที่ deploy contract");
      } else if (raw.includes("user rejected")) {
        setErrorMsg("ยกเลิกการทำรายการใน MetaMask");
      } else {
        setErrorMsg(raw.slice(0, 200));
      }
    }
  };

  const resetForm = () => {
    setStep("idle"); setTxHash(null); setTokenId(null); setErrorMsg(null);
    setFinalImageBlob(null); setFinalPreviewUrl(null);
    if (!hasPreset) { setCustomTemplateFile(null); setCustomTemplateUrl(null); }
    setForm({ studentName: "", courseId: "", recipientAddress: "" });
  };

  const isBusy = ["generating-preview","uploading-image","pinning-metadata","minting"].includes(step);

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-6 h-6 text-gray-600" />
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
        </div>
        <p className="text-gray-500 mb-8 text-sm">ออกใบประกาศนียบัตร Soulbound Token ให้ผู้เรียน</p>

        {/* Connect Wallet */}
        {!walletAddress ? (
          <div className="card mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-800">เชื่อมต่อ MetaMask</p>
              <p className="text-sm text-gray-500">ต้องใช้ wallet ที่เป็น owner ของ contract</p>
            </div>
            <button onClick={handleConnect} className="btn-primary whitespace-nowrap flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Connect
            </button>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="font-mono truncate">{walletAddress}</span>
          </div>
        )}

        {/* รูป Template */}
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-gray-500" /> รูป Template ใบประกาศ
          </h2>
          {hasPreset && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg mb-3">
              <CheckCircle className="w-3.5 h-3.5" />
              Template จาก Pinata — <span className="font-mono">{PRESET_TEMPLATE_CID.slice(0, 20)}...</span>
            </div>
          )}
          {activeTemplateUrl && !finalPreviewUrl && (
            <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 mb-3 bg-gray-50" style={{ aspectRatio: "1.414/1" }}>
              <Image src={activeTemplateUrl} alt="template" fill className="object-contain" />
            </div>
          )}
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-sm w-full flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" />
            {hasPreset ? "เปลี่ยนรูป Template" : "เลือกรูป Template"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="hidden" />
          {customTemplateFile && (
            <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
              <Upload className="w-3 h-3" /> {customTemplateFile.name}
            </p>
          )}
        </div>

        {/* ฟอร์ม */}
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-gray-500" /> ออกใบประกาศนียบัตร
          </h2>
          <p className="text-sm text-gray-500 mb-5">กรอกชื่อ → ปรับสไตล์ → กด "ออกใบประกาศ"</p>

          {step === "done" ? (
            /* ── Success State ── */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">ออกใบประกาศสำเร็จ</h3>
              <p className="text-sm text-gray-500 mb-4">Token ID: <strong>#{tokenId}</strong></p>
              {txHash && (
                <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-600 text-sm underline break-all mb-6">
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  ดู Transaction บน Etherscan
                </a>
              )}
              <div className="mt-4">
                <button onClick={resetForm} className="btn-secondary">ออกใบประกาศเพิ่มเติม</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleIssueCertificate} className="space-y-4">

              {/* ชื่อ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล ผู้รับ</label>
                <input className="input-field" placeholder="เช่น นายสมชาย ใจดี"
                  value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} required />
              </div>

              {/* Preview + style controls */}
              {form.studentName.trim() && activeTemplateUrl && (
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  {/* รูป */}
                  <div className="relative w-full bg-gray-50" style={{ aspectRatio: "1.414/1" }}>
                    {step === "generating-preview" ? (
                      <div className="absolute inset-0 flex items-center justify-center gap-2 text-gray-400 text-sm">
                        <Loader2 className="w-5 h-5 animate-spin" /> กำลังวาดชื่อ...
                      </div>
                    ) : finalPreviewUrl ? (
                      <Image src={finalPreviewUrl} alt="preview" fill className="object-contain" />
                    ) : null}
                  </div>

                  {finalPreviewUrl && (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-green-600 py-1.5 bg-green-50 border-t border-green-100">
                      <CheckCircle className="w-3.5 h-3.5" /> นี่คือรูปที่จะเก็บบน IPFS
                    </div>
                  )}

                  {/* Style Controls */}
                  <div className="bg-white border-t border-gray-100 px-4 py-4 space-y-4">

                    {/* ฟอนต์ */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">รูปแบบตัวอักษร</label>
                      <div className="grid grid-cols-3 gap-2">
                        {FONT_OPTIONS.map((f) => (
                          <button key={f.value} type="button" onClick={() => setNameFont(f.value)}
                            className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                              nameFont === f.value
                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                : "border-gray-200 hover:border-gray-300 text-gray-600"
                            }`}>
                            <span className="font-semibold block" style={{ fontFamily: f.value }}>{f.label}</span>
                            <span className="text-gray-400 text-[10px]">{f.sub}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ขนาด */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 flex justify-between mb-1.5">
                        <span>ขนาดตัวอักษร</span>
                        <span className="font-mono text-gray-700">{nameFontSize} px</span>
                      </label>
                      <input type="range" min="12" max="72" step="1" value={nameFontSize}
                        onInput={(e) => setNameFontSize(Number((e.target as HTMLInputElement).value))}
                        onChange={(e) => setNameFontSize(Number(e.target.value))}
                        className="w-full accent-blue-600 h-2 cursor-pointer" />
                      <div className="flex justify-between text-[10px] text-gray-300 mt-0.5"><span>เล็ก</span><span>ใหญ่</span></div>
                    </div>

                    {/* ตำแหน่ง */}
                    <div>
                      <label className="text-xs font-medium text-gray-500 flex justify-between mb-1.5">
                        <span>ตำแหน่งชื่อ (แนวตั้ง)</span>
                        <span className="font-mono text-gray-700">{nameTopPercent}%</span>
                      </label>
                      <input type="range" min="30" max="80" step="1" value={nameTopPercent}
                        onInput={(e) => setNameTopPercent(Number((e.target as HTMLInputElement).value))}
                        onChange={(e) => setNameTopPercent(Number(e.target.value))}
                        className="w-full accent-blue-600 h-2 cursor-pointer" />
                      <div className="flex justify-between text-[10px] text-gray-300 mt-0.5"><span>บน</span><span>ล่าง</span></div>
                    </div>

                    {/* สี */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">สีตัวอักษร</label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={nameColor} onChange={(e) => setNameColor(e.target.value)}
                          className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                        <div className="flex gap-2">
                          {PRESET_COLORS.map((c) => (
                            <button key={c} type="button" onClick={() => setNameColor(c)} title={c}
                              className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                                nameColor === c ? "border-blue-500 scale-110" : "border-white shadow-sm"
                              }`}
                              style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <span className="text-[11px] font-mono text-gray-400">{nameColor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* รหัสคอร์ส */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสคอร์ส (Course ID)</label>
                <input className="input-field" placeholder="เช่น WEB3-2024-001"
                  value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} required />
              </div>

              {/* Wallet */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Address ผู้รับ</label>
                <input className="input-field font-mono text-sm" placeholder="0x..."
                  value={form.recipientAddress} onChange={(e) => setForm({ ...form, recipientAddress: e.target.value })}
                  pattern="^0x[a-fA-F0-9]{40}$" title="กรุณากรอก Ethereum address ที่ถูกต้อง" required />
              </div>

              {/* Error */}
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  {errorMsg.includes("ได้รับใบประกาศ") && (
                    <div className="mt-2 text-xs bg-white border border-red-100 rounded-lg p-3 space-y-1">
                      <p className="font-semibold text-red-700">แก้ไขได้โดย:</p>
                      <p>• เปลี่ยน <strong>Course ID</strong> เป็นค่าใหม่ที่ยังไม่เคยออก</p>
                      <p>• หรือใช้ <strong>Wallet Address</strong> ของผู้รับคนอื่น</p>
                    </div>
                  )}
                </div>
              )}

              {/* Progress */}
              {isBusy && step !== "generating-preview" && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  {step === "uploading-image"  && "กำลังอัพโหลดรูปไป Pinata..."}
                  {step === "pinning-metadata" && "กำลัง Pin Metadata..."}
                  {step === "minting"          && "กำลัง Mint SBT — ยืนยันใน MetaMask..."}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={!finalImageBlob || isBusy}
                className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2">
                {isBusy
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> กำลังดำเนินการ...</>
                  : <><GraduationCap className="w-5 h-5" /> ออกใบประกาศนียบัตร</>
                }
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
