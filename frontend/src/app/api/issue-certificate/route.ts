/**
 * POST /api/issue-certificate
 * ────────────────────────────
 * รับข้อมูลใบประกาศ → สร้าง metadata JSON → pin ไป Pinata
 * คืน { metadataUri } ให้ frontend เอาไป mint SBT
 *
 * Body (JSON):
 * {
 *   studentName: string,
 *   courseName:  string,
 *   courseId:    string,
 *   imageIpfsUri: string,   // ipfs://CID ของรูป template
 *   recipientAddress: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentName, courseName: courseNameRaw, courseId, imageIpfsUri, recipientAddress } = body;
    // courseName เป็น optional — ถ้าไม่ส่งมาใช้ courseId แทน
    const courseName = courseNameRaw || courseId || "Certificate";

    // ─── Validate ─────────────────────────────────────────────
    if (!studentName || !courseId || !imageIpfsUri || !recipientAddress) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    const issuedAt = new Date().toISOString();

    // ─── สร้าง Metadata ตาม OpenSea / ERC-721 standard ──────
    const metadata = {
      name:        `${courseName} — Certificate`,
      description: `ใบประกาศนียบัตรยืนยันว่า ${studentName} ได้ผ่านหลักสูตร "${courseName}" เรียบร้อยแล้ว`,
      image:       imageIpfsUri,
      attributes: [
        { trait_type: "Student Name",  value: studentName },
        { trait_type: "Course Name",   value: courseName },
        { trait_type: "Course ID",     value: courseId },
        { trait_type: "Recipient",     value: recipientAddress },
        { trait_type: "Issued Date",   value: issuedAt },
        { trait_type: "Token Type",    value: "Soulbound Token" },
      ],
      studentName,
      courseName,
      courseId,
      recipientAddress,
      issuedAt,
    };

    // ─── Pin JSON ไป Pinata ──────────────────────────────────
    const pinataPayload = {
      pinataMetadata: {
        name: `cert-${courseId}-${recipientAddress.slice(0, 8)}-${Date.now()}`,
      },
      pinataOptions: { cidVersion: 1 },
      pinataContent: metadata,
    };

    const pinataRes = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          "Content-Type":          "application/json",
          pinata_api_key:          process.env.PINATA_API_KEY!,
          pinata_secret_api_key:   process.env.PINATA_SECRET_API_KEY!,
        },
        body: JSON.stringify(pinataPayload),
      }
    );

    if (!pinataRes.ok) {
      const errText = await pinataRes.text();
      console.error("Pinata JSON pin error:", errText);
      return NextResponse.json(
        { message: "Failed to pin metadata to Pinata", detail: errText },
        { status: 502 }
      );
    }

    const pinataData = await pinataRes.json();
    const ipfsHash   = pinataData.IpfsHash as string;
    const gateway    = process.env.PINATA_GATEWAY ?? "https://gateway.pinata.cloud";

    return NextResponse.json({
      ipfsHash,
      metadataUri:  `ipfs://${ipfsHash}`,
      gatewayUrl:   `${gateway}/ipfs/${ipfsHash}`,
    });
  } catch (error) {
    console.error("issue-certificate error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
