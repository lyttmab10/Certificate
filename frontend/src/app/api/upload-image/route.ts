/**
 * POST /api/upload-image
 * ─────────────────────
 * รับ multipart/form-data ที่มี field "file" (รูป PNG/JPG)
 * แล้วส่งต่อไปยัง Pinata เพื่อ pin บน IPFS
 * คืน { ipfsHash, ipfsUri, gatewayUrl }
 *
 * ทำงานฝั่ง server เพื่อซ่อน PINATA_SECRET_API_KEY
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // ต้องการ FormData / Buffer

export async function POST(req: NextRequest) {
  try {
    // ─── รับไฟล์จาก request ───────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 });
    }

    // ตรวจสอบประเภทไฟล์
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { message: "Only PNG, JPG, WEBP images are allowed" },
        { status: 400 }
      );
    }

    // ตรวจสอบขนาดไฟล์ (≤ 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { message: "File too large (max 10MB)" },
        { status: 400 }
      );
    }

    // ─── ส่งไป Pinata ────────────────────────────────────────
    const pinataForm = new FormData();
    pinataForm.append("file", file, file.name);
    pinataForm.append(
      "pinataMetadata",
      JSON.stringify({ name: `cert-template-${Date.now()}` })
    );
    pinataForm.append(
      "pinataOptions",
      JSON.stringify({ cidVersion: 1 })
    );

    const pinataRes = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          pinata_api_key:        process.env.PINATA_API_KEY!,
          pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY!,
        },
        body: pinataForm,
      }
    );

    if (!pinataRes.ok) {
      const errText = await pinataRes.text();
      console.error("Pinata error:", errText);
      return NextResponse.json(
        { message: "Pinata upload failed", detail: errText },
        { status: 502 }
      );
    }

    const pinataData = await pinataRes.json();
    const ipfsHash   = pinataData.IpfsHash as string;
    const gateway    = process.env.PINATA_GATEWAY ?? "https://gateway.pinata.cloud";

    return NextResponse.json({
      ipfsHash,
      ipfsUri:    `ipfs://${ipfsHash}`,
      gatewayUrl: `${gateway}/ipfs/${ipfsHash}`,
    });
  } catch (error) {
    console.error("upload-image error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
