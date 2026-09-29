/**
 * contract.ts
 * ===========
 * Helper สำหรับติดต่อ Smart Contract CertificateSBT ผ่าน ethers.js v6
 */

import { ethers, BrowserProvider, Contract } from "ethers";

// ─────────────────────────────────────────────────────────────
//  ABI (ตัดเฉพาะฟังก์ชันที่ใช้จริง)
// ─────────────────────────────────────────────────────────────

export const CONTRACT_ABI = [
  // Issue
  "function issueCertificate(address recipient, string studentName, string courseName, string courseId, string metadataURI) external returns (uint256)",
  // Revoke
  "function revokeCertificate(uint256 tokenId) external",
  // Read
  "function getCertificate(uint256 tokenId) external view returns (tuple(uint256 tokenId, address recipient, string studentName, string courseName, string courseId, string metadataURI, uint256 issuedAt, bool revoked))",
  "function getCertificatesByHolder(address holder) external view returns (uint256[])",
  "function hasCertificate(address holder, string courseId) external view returns (bool)",
  "function totalSupply() external view returns (uint256)",
  "function owner() external view returns (address)",
  // Events
  "event CertificateIssued(uint256 indexed tokenId, address indexed recipient, string courseId, string metadataURI, uint256 issuedAt)",
  "event CertificateRevoked(uint256 indexed tokenId, address indexed recipient)",
] as const;

export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";

// ─────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────

export interface CertificateOnChain {
  tokenId:     bigint;
  recipient:   string;
  studentName: string;
  courseName:  string;
  courseId:    string;
  metadataURI: string;
  issuedAt:    bigint;
  revoked:     boolean;
}

// ─────────────────────────────────────────────────────────────
//  Connect helpers
// ─────────────────────────────────────────────────────────────

/**
 * คืน provider จาก MetaMask ที่เชื่อมอยู่แล้ว (ใช้สำหรับ read)
 * ถ้าไม่มี MetaMask จะ fallback ไปใช้ public RPC หลายตัว
 */
export async function getProvider(): Promise<BrowserProvider | ethers.JsonRpcProvider> {
  // ถ้ามี MetaMask อยู่แล้ว → ใช้เลย เร็วและเชื่อถือได้กว่า
  if (typeof window !== "undefined" && window.ethereum) {
    return new BrowserProvider(window.ethereum);
  }
  // fallback: ลอง RPC หลายตัวตามลำดับ
  const RPC_LIST = [
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://sepolia.drpc.org",
    "https://rpc2.sepolia.org",
    "https://rpc.sepolia.org",
  ];
  for (const url of RPC_LIST) {
    try {
      const p = new ethers.JsonRpcProvider(url);
      await p.getBlockNumber(); // ทดสอบว่า RPC ตอบสนอง
      return p;
    } catch {
      // ลอง RPC ถัดไป
    }
  }
  throw new Error("ไม่สามารถเชื่อมต่อ Sepolia RPC ได้ — กรุณาติดตั้ง MetaMask");
}

/**
 * คืน signer จาก MetaMask (ต้องเชื่อมต่อก่อน)
 */
export async function getSigner(): Promise<ethers.JsonRpcSigner> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask not found. Please install MetaMask.");
  }
  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

/**
 * คืน Contract instance แบบ read-only
 */
export async function getReadOnlyContract(): Promise<Contract> {
  const provider = await getProvider();
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

/**
 * คืน Contract instance แบบ write (ต้องมี signer)
 */
export async function getWritableContract(): Promise<Contract> {
  const signer = await getSigner();
  return new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

// ─────────────────────────────────────────────────────────────
//  Utility functions
// ─────────────────────────────────────────────────────────────

/**
 * ดึง certificates ทั้งหมดของ wallet address นี้
 */
export async function getCertificatesOfHolder(
  holderAddress: string
): Promise<CertificateOnChain[]> {
  const contract = await getReadOnlyContract();
  const tokenIds: bigint[] = await contract.getCertificatesByHolder(holderAddress);

  if (tokenIds.length === 0) return [];

  const certs = await Promise.all(
    tokenIds.map((id) => contract.getCertificate(id))
  );

  return certs.map((c) => ({
    tokenId:     c.tokenId,
    recipient:   c.recipient,
    studentName: c.studentName,
    courseName:  c.courseName,
    courseId:    c.courseId,
    metadataURI: c.metadataURI,
    issuedAt:    c.issuedAt,
    revoked:     c.revoked,
  }));
}

/**
 * ออกใบประกาศ (เรียกจาก admin เท่านั้น)
 */
export async function issueCertificate(params: {
  recipient:   string;
  studentName: string;
  courseName:  string;
  courseId:    string;
  metadataURI: string;
}): Promise<{ txHash: string; tokenId?: bigint }> {
  const contract = await getWritableContract();
  const tx = await contract.issueCertificate(
    params.recipient,
    params.studentName,
    params.courseName,
    params.courseId,
    params.metadataURI
  );
  const receipt = await tx.wait();

  // ดึง tokenId จาก event
  let tokenId: bigint | undefined;
  for (const log of receipt.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "CertificateIssued") {
        tokenId = parsed.args.tokenId as bigint;
      }
    } catch (_) { /* skip unrelated logs */ }
  }

  return { txHash: receipt.hash, tokenId };
}

/**
 * เช็ค network ถูกต้องหรือไม่ (ต้องเป็น Sepolia)
 */
export async function checkNetwork(): Promise<boolean> {
  if (typeof window === "undefined" || !window.ethereum) return false;
  const provider = new BrowserProvider(window.ethereum);
  const network  = await provider.getNetwork();
  const expectedChainId = BigInt(process.env.NEXT_PUBLIC_CHAIN_ID ?? "11155111");
  return network.chainId === expectedChainId;
}

/**
 * ขอเปลี่ยน network ไปยัง Sepolia
 */
export async function switchToSepolia(): Promise<void> {
  if (!window.ethereum) throw new Error("MetaMask not found");
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0xaa36a7" }], // Sepolia chainId
  });
}
