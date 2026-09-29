/**
 * pinata.ts
 * =========
 * ทุกอย่างที่เกี่ยวกับการอัพโหลดไฟล์และ JSON metadata ไปยัง Pinata (IPFS)
 *
 * Flow การทำงาน:
 *  1. Admin มีรูปใบประกาศที่เว้นชื่อไว้ (template) อยู่ใน Pinata แล้ว
 *  2. ตอนออกใบประกาศ → สร้าง metadata JSON ที่ระบุ:
 *       - image: IPFS URI ของรูป template
 *       - name, studentName, courseName, issuedAt
 *  3. อัพโหลด JSON นั้นไป Pinata → ได้ metadataURI
 *  4. เอา metadataURI ไป mint SBT บน blockchain
 */

import axios from "axios";
import FormData from "form-data";

const PINATA_API_KEY    = process.env.PINATA_API_KEY!;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_API_KEY!;
const PINATA_GATEWAY    = process.env.PINATA_GATEWAY ?? "https://gateway.pinata.cloud";

const pinataAxios = axios.create({
  baseURL: "https://api.pinata.cloud",
  headers: {
    pinata_api_key:        PINATA_API_KEY,
    pinata_secret_api_key: PINATA_SECRET_KEY,
  },
});

// ─────────────────────────────────────────────────────────────
//  1. อัพโหลดไฟล์รูป (template ใบประกาศ) ไปยัง Pinata
// ─────────────────────────────────────────────────────────────

export interface UploadImageResult {
  ipfsHash: string;   // CID ของรูป
  ipfsUri:  string;   // ipfs://CID
  gatewayUrl: string; // https://gateway.pinata.cloud/ipfs/CID
}

/**
 * อัพโหลดรูปภาพ (File object จาก <input type="file">)
 * ใช้ฝั่ง client ผ่าน API route ของ Next.js (/api/upload-image)
 * เพราะ Pinata Secret Key ต้องอยู่ฝั่ง server เท่านั้น
 */
export async function uploadImageToIPFS(file: File): Promise<UploadImageResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append(
    "pinataMetadata",
    JSON.stringify({ name: `certificate-template-${Date.now()}` })
  );
  formData.append(
    "pinataOptions",
    JSON.stringify({ cidVersion: 1 })
  );

  // เรียก API Route ของ Next.js (server-side) เพื่อซ่อน secret key
  const res = await fetch("/api/upload-image", {
    method: "POST",
    body: formData as unknown as BodyInit,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "Upload image failed");
  }

  return res.json();
}

// ─────────────────────────────────────────────────────────────
//  2. อัพโหลด JSON Metadata ไปยัง Pinata (server-side)
// ─────────────────────────────────────────────────────────────

export interface CertificateMetadata {
  name:        string;  // "Certificate of Completion – Web3 Bootcamp"
  description: string;
  image:       string;  // ipfs://CID ของรูป template
  attributes: {
    trait_type: string;
    value:      string | number;
  }[];
  studentName: string;
  courseName:  string;
  courseId:    string;
  issuedAt:    string;  // ISO date string
}

/**
 * เรียกใช้จาก server-side (API Route) เท่านั้น
 * รับ metadata object → pin JSON → คืน IPFS URI
 */
export async function pinMetadataJSON(
  metadata: CertificateMetadata
): Promise<{ ipfsHash: string; metadataUri: string }> {
  const body = {
    pinataMetadata: { name: `cert-metadata-${metadata.courseId}-${Date.now()}` },
    pinataOptions:  { cidVersion: 1 },
    pinataContent:  metadata,
  };

  const res = await pinataAxios.post<{ IpfsHash: string }>(
    "/pinning/pinJSONToIPFS",
    body
  );

  const ipfsHash   = res.data.IpfsHash;
  const metadataUri = `ipfs://${ipfsHash}`;
  return { ipfsHash, metadataUri };
}

// ─────────────────────────────────────────────────────────────
//  3. แปลง IPFS URI → URL ที่เปิดในเบราว์เซอร์ได้
// ─────────────────────────────────────────────────────────────

export function ipfsToHttp(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    const cid = uri.replace("ipfs://", "");
    return `${PINATA_GATEWAY}/ipfs/${cid}`;
  }
  return uri; // ถ้าเป็น http แล้วคืนค่าตรงๆ
}

// ─────────────────────────────────────────────────────────────
//  4. ดึง metadata JSON จาก IPFS (ใช้ใน client เวลา display)
// ─────────────────────────────────────────────────────────────

export async function fetchMetadata(
  metadataUri: string
): Promise<CertificateMetadata> {
  const url = ipfsToHttp(metadataUri);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Cannot fetch metadata from IPFS");
  return res.json();
}
