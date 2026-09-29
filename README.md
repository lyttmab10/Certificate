# 🎓 Certificate SBT — ระบบออกใบประกาศนียบัตรบน Blockchain

ระบบออกใบประกาศนียบัตรในรูปแบบ **Soulbound Token (SBT)** ที่ไม่สามารถโอนได้  
รูปใบประกาศเก็บบน **IPFS ผ่าน Pinata** และ metadata ผูกกับ wallet ของผู้เรียน

---

## 📁 โครงสร้างโปรเจกต์

```
CertificateSBT/
├── contracts/
│   └── CertificateSBT.sol          ← Smart Contract (deploy ด้วย Remix)
└── frontend/                        ← Next.js 14 App
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx             ← Landing page
    │   │   ├── admin/page.tsx       ← Admin ออกใบประกาศ
    │   │   ├── my-certificates/     ← นักเรียนดูใบประกาศของตัวเอง
    │   │   └── api/
    │   │       ├── upload-image/    ← POST: อัพโหลดรูปไป Pinata
    │   │       └── issue-certificate/ ← POST: Pin metadata JSON
    │   ├── components/
    │   │   ├── Navbar.tsx
    │   │   └── CertificateCard.tsx
    │   ├── utils/
    │   │   ├── pinata.ts            ← Pinata / IPFS helpers
    │   │   ├── contract.ts          ← ethers.js v6 contract helpers
    │   │   └── metamask.ts          ← MetaMask connection helpers
    │   └── types/
    │       └── global.d.ts          ← window.ethereum types
    └── .env.local                   ← API keys (ไม่ commit)
```

---

## 🚀 ขั้นตอนการตั้งค่า

### 1. Deploy Smart Contract ด้วย Remix

1. เปิด [remix.ethereum.org](https://remix.ethereum.org)
2. สร้างไฟล์ใหม่ → วางโค้ดจาก `contracts/CertificateSBT.sol`
3. Compile → เลือก compiler **0.8.20**
4. Deploy บน **Injected Provider (MetaMask)** → เลือก network **Sepolia Testnet**
5. Copy **Contract Address** ที่ได้หลัง deploy

### 2. ตั้งค่า Pinata

1. สมัคร/เข้าสู่ระบบ [app.pinata.cloud](https://app.pinata.cloud)
2. ไปที่ **API Keys** → สร้าง key ใหม่ (เปิด `pinFileToIPFS` และ `pinJSONToIPFS`)
3. Copy **API Key** และ **Secret API Key**

### 3. ตั้งค่า `.env.local`

```bash
# frontend/.env.local

PINATA_API_KEY=วาง_api_key_ที่นี่
PINATA_SECRET_API_KEY=วาง_secret_key_ที่นี่
PINATA_GATEWAY=https://gateway.pinata.cloud

NEXT_PUBLIC_CONTRACT_ADDRESS=วาง_contract_address_ที่นี่
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_NETWORK_NAME=Sepolia
NEXT_PUBLIC_ADMIN_ADDRESS=วาง_wallet_address_ของ_admin
```

### 4. รัน Frontend

```bash
cd frontend
npm install
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

---

## 🔄 Flow การทำงาน

```
Admin                    Next.js Server              Pinata (IPFS)        Blockchain
  │                           │                           │                    │
  ├─ เลือกรูป template ───────►│                           │                    │
  │                           ├─ POST /api/upload-image ──►│                    │
  │                           │◄─ ipfsUri (ipfs://CID) ───┤                    │
  │                           │                           │                    │
  ├─ กรอกข้อมูลนักเรียน ──────►│                           │                    │
  │                           ├─ POST /api/issue-certificate                   │
  │                           ├─ สร้าง metadata JSON ─────►│                    │
  │                           │◄─ metadataUri ────────────┤                    │
  │                           │                           │                    │
  ├─ ยืนยันใน MetaMask ────────────────────────────────────────────────────────►│
  │                           │                           │          issueCertificate()
  │◄─ Token ID + TxHash ───────────────────────────────────────────────────────┤
```

---

## 🔒 ทำไมถึงเป็น Soulbound Token?

- Contract **block transfer ทุกฟังก์ชัน** (`transfer`, `transferFrom`, `approve`)
- ใบประกาศผูกกับ wallet ถาวร ไม่สามารถซื้อขายหรือโอนได้
- ยกเลิกได้เฉพาะ owner ของ contract (flag `revoked = true`)
- ข้อมูลทั้งหมด on-chain → ตรวจสอบได้โดยไม่ต้องผ่านตัวกลาง

---

## 🧪 Test Network

ใช้ **Sepolia Testnet** — รับ test ETH ได้ที่ [sepoliafaucet.com](https://sepoliafaucet.com)
