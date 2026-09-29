"use client";

import Image from "next/image";
import { useState } from "react";
import { FileText, ExternalLink, GraduationCap, Ban } from "lucide-react";
import { type CertificateOnChain } from "@/utils/contract";
import { type CertificateMetadata, ipfsToHttp } from "@/utils/pinata";

interface Props {
  onChain: CertificateOnChain;
  meta:    CertificateMetadata | null;
}

export default function CertificateCard({ onChain, meta }: Props) {
  const [imgError, setImgError] = useState(false);

  const imageUrl = !imgError && meta?.image ? ipfsToHttp(meta.image) : null;

  const issuedDate = new Date(Number(onChain.issuedAt) * 1000).toLocaleDateString("th-TH", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className={`card overflow-hidden flex flex-col gap-0 p-0 ${onChain.revoked ? "opacity-60" : ""}`}>

      {/* รูปใบประกาศ */}
      <div className="relative w-full bg-gradient-to-br from-blue-50 to-indigo-100" style={{ aspectRatio: "1.414/1" }}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`Certificate — ${onChain.courseName}`}
            fill
            className="object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <GraduationCap className="w-12 h-12 text-blue-300" />
            <span className="text-xs text-gray-400">ไม่สามารถโหลดรูปได้</span>
          </div>
        )}

        {/* Revoked */}
        {onChain.revoked && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            <Ban className="w-3 h-3" /> ยกเลิกแล้ว
          </div>
        )}

        {/* Token ID */}
        <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full font-mono">
          #{onChain.tokenId.toString()}
        </div>
      </div>

      {/* ข้อมูล */}
      <div className="p-4 flex flex-col gap-3">
        <div>
          <h3 className="font-bold text-gray-900 text-base leading-tight">{onChain.courseName}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            มอบให้กับ <span className="font-semibold text-gray-700">{onChain.studentName}</span>
          </p>
        </div>

        <div className="space-y-1 text-sm text-gray-600">
          <Row label="รหัสคอร์ส" value={onChain.courseId} />
          <Row label="วันที่ออก"  value={issuedDate} />
          <Row label="Wallet"
            value={`${onChain.recipient.slice(0, 8)}...${onChain.recipient.slice(-6)}`}
            mono />
        </div>

        <div className="flex gap-4 flex-wrap pt-1">
          <a href={ipfsToHttp(onChain.metadataURI)} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
            <FileText className="w-3.5 h-3.5" /> ดู Metadata (IPFS)
          </a>
          {imageUrl && (
            <a href={imageUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> เปิดรูปเต็ม
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className={`text-right truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
