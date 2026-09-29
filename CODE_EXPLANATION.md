# อธิบายการทำงานของโค้ด — ระบบออกใบประกาศนียบัตร SBT

---

## ภาพรวมระบบ

```
ผู้ใช้ (Browser)
    │
    ├── หน้า Admin  ──► Canvas วาดชื่อ ──► /api/upload-image ──► Pinata (รูป PNG)
    │                                   ──► /api/issue-certificate ──► Pinata (JSON)
    │                                   ──► MetaMask ──► Smart Contract (Blockchain)
    │
    └── หน้า My Certificates ──► Smart Contract (อ่าน) ──► Pinata (ดึง metadata)
```

---

## 1. Smart Contract — `contracts/CertificateSBT.sol`

ไฟล์นี้คือหัวใจของระบบ ทำงานบน Ethereum (Sepolia Testnet)

### State Variables (ตัวแปรที่เก็บข้อมูลบน Blockchain)

```solidity
address public owner;               // wallet ที่ deploy contract = admin
uint256 private _tokenIdCounter;    // นับ token ที่ออกไปแล้ว (1, 2, 3, ...)

struct Certificate { ... }          // โครงสร้างข้อมูลใบประกาศ 1 ใบ

mapping(uint256 => Certificate) private _certificates;
// เก็บข้อมูลใบประกาศ: tokenId → Certificate

mapping(address => mapping(string => uint256)) private _issued;
// เช็คซ้ำ: wallet + courseId → tokenId (ถ้า = 0 แปลว่ายังไม่ออก)

mapping(address => uint256[]) private _holderTokens;
// ดึงใบประกาศทั้งหมดของ wallet: address → [tokenId1, tokenId2, ...]
```

### ฟังก์ชันหลัก

| ฟังก์ชัน | ใครเรียกได้ | ทำอะไร |
|---------|------------|--------|
| `issueCertificate()` | owner เท่านั้น | ออกใบประกาศใหม่ → mint token |
| `revokeCertificate()` | owner เท่านั้น | ยกเลิกใบประกาศ (flag revoked = true) |
| `getCertificate()` | ทุกคน | ดึงข้อมูลใบประกาศจาก tokenId |
| `getCertificatesByHolder()` | ทุกคน | ดึง tokenIds ทั้งหมดของ wallet |
| `transfer()` / `transferFrom()` | — | **revert ทันที** — นี่คือ Soulbound Token |

### ทำไมถึงเป็น Soulbound Token?

```solidity
function transfer(address, uint256) external pure {
    revert("SBT: token is non-transferable"); // โอนไม่ได้เด็ดขาด
}
```

ฟังก์ชัน transfer ถูก block ทุกเส้นทาง ใบประกาศจึงผูกกับ wallet ผู้รับถาวร

---

## 2. Utility Functions (ฝั่ง Frontend)

### 2.1 `src/utils/pinata.ts` — จัดการ IPFS

```
ipfsToHttp("ipfs://CID")
    → "https://gateway.pinata.cloud/ipfs/CID"
    ใช้แปลง URI จาก blockchain ให้เปิดใน browser ได้

fetchMetadata("ipfs://CID")
    → ดึง JSON metadata จาก IPFS แล้ว parse เป็น object
    ใช้ในหน้า My Certificates เพื่อดึงข้อมูลรูปและชื่อ
```

### 2.2 `src/utils/contract.ts` — ติดต่อ Smart Contract

```
getProvider()
    ถ้ามี MetaMask → ใช้ MetaMask provider (เร็วและเชื่อถือได้)
    ถ้าไม่มี → ลอง public RPC หลายตัวตามลำดับ

getReadOnlyContract()
    → Contract instance สำหรับอ่านข้อมูลอย่างเดียว (ไม่ต้อง sign)

getWritableContract()
    → Contract instance ที่เชื่อมกับ MetaMask (ต้องกด Confirm)

getCertificatesOfHolder(address)
    1. ดึง tokenIds ทั้งหมดของ wallet จาก contract
    2. วนดึงข้อมูลแต่ละ token
    3. คืนเป็น array ของ CertificateOnChain[]

issueCertificate(params)
    1. เรียก contract.issueCertificate() ผ่าน MetaMask
    2. รอ transaction confirm
    3. ดึง tokenId จาก event log
    4. คืน { txHash, tokenId }
```

### 2.3 `src/utils/metamask.ts` — จัดการ Wallet

```
connectWallet()
    → popup MetaMask ให้ผู้ใช้กด Connect
    → คืน wallet address

getConnectedAddress()
    → ดึง address ที่เชื่อมอยู่แล้ว (ไม่ popup)
    → ใช้ตอน mount component เพื่อ restore session

shortenAddress("0x1234...abcd")
    → "0x1234...abcd" (ตัดให้สั้น)

listenWalletEvents({ onAccountChange, onChainChange })
    → ฟังเหตุการณ์จาก MetaMask:
       - เปลี่ยน account
       - เปลี่ยน network
```

### 2.4 `src/utils/canvasText.ts` — วาดชื่อบนรูป

นี่คือจุดสำคัญที่ทำให้ชื่อ "อยู่บนรูปจริงๆ" ไม่ใช่แค่ CSS overlay

```
drawNameOnCertificate(templateUrl, studentName, config)

ขั้นตอน:
1. loadImage(templateUrl)
   → โหลดรูป template จาก Pinata (CORS: crossOrigin = "anonymous")

2. document.createElement("canvas")
   → สร้าง canvas ขนาดเท่ารูป template พอดี

3. ctx.drawImage(img, ...)
   → วาดรูป template ลงบน canvas

4. scaledFontSize = (fontSize / 800) * canvas.width
   → คำนวณขนาดตัวอักษรให้ scale ตามขนาดรูปจริง
     (รูป 1600px wide จะได้ font ใหญ่ขึ้น 2 เท่าโดยอัตโนมัติ)

5. ctx.fillText(studentName, x, y)
   → วาดชื่อตรงกลางแนวนอน (x = กึ่งกลาง)
   → แนวตั้งตาม topPercent (y = ความสูง × topPercent%)

6. canvas.toBlob() → new File(...)
   → export เป็นไฟล์ PNG ใหม่ที่มีชื่อฝังอยู่จริงๆ
```

**ทำไมต้องทำแบบนี้?**
รูปบน IPFS เป็น template เปล่า ถ้าวาดชื่อด้วย CSS ผู้ดูรูปโดยตรงจะไม่เห็นชื่อ การใช้ Canvas ทำให้ชื่อ "burn in" อยู่ในไฟล์รูปจริงๆ

---

## 3. API Routes (ฝั่ง Server)

ทำงานบน Next.js Server ซ่อน Pinata Secret Key ไม่ให้ client เห็น

### 3.1 `src/app/api/upload-image/route.ts`

```
POST /api/upload-image
Body: FormData { file: File }

ขั้นตอน:
1. รับไฟล์รูปจาก request
2. ตรวจสอบ: ต้องเป็น PNG/JPG/WEBP และขนาด ≤ 10MB
3. ส่งต่อไปยัง Pinata API (pinFileToIPFS)
   - ใช้ PINATA_API_KEY และ PINATA_SECRET_API_KEY จาก env
4. คืน { ipfsHash, ipfsUri, gatewayUrl }

ทำไมต้องผ่าน server?
→ ถ้าเรียก Pinata จาก browser ตรงๆ จะ expose Secret Key ให้ทุกคนเห็น
```

### 3.2 `src/app/api/issue-certificate/route.ts`

```
POST /api/issue-certificate
Body: JSON { studentName, courseId, imageIpfsUri, recipientAddress }

ขั้นตอน:
1. รับข้อมูลจาก request
2. validate ว่าครบทุก field
3. สร้าง metadata JSON ตาม ERC-721 standard:
   {
     name: "Certificate",
     description: "...",
     image: "ipfs://CID-ของรูปที่มีชื่อ",
     attributes: [
       { trait_type: "Student Name", value: "สมชาย" },
       { trait_type: "Course ID",    value: "WEB3-001" },
       ...
     ]
   }
4. ส่ง JSON ไปยัง Pinata (pinJSONToIPFS)
5. คืน { metadataUri: "ipfs://CID-ของ-JSON" }
```

---

## 4. Pages (หน้าเว็บ)

### 4.1 `src/app/page.tsx` — หน้าแรก

```
- แสดงข้อมูลทั่วไปของระบบ
- ตรวจสอบ wallet ที่เชื่อมอยู่:
  ถ้า address == NEXT_PUBLIC_ADMIN_ADDRESS → แสดงปุ่ม Admin
  ถ้าไม่ใช่ → ไม่มีปุ่ม Admin ให้กด
```

### 4.2 `src/app/admin/page.tsx` — ออกใบประกาศ

```
Flow การทำงาน:
1. Mount: ตรวจสอบ wallet ที่เชื่อมอยู่แล้ว (ไม่ต้อง reconnect ทุกครั้ง)
2. โหลดรูป template จาก Pinata (ผ่าน CID ใน env)
3. Admin พิมพ์ชื่อนักเรียน:
   → useEffect debounce 300ms → generatePreview()
   → Canvas วาดชื่อ → แสดง preview รูปที่มีชื่อ
4. Admin ปรับ slider (ขนาด/ตำแหน่ง/ฟอนต์/สี):
   → useEffect ไม่ debounce → generatePreview() ทันที
5. กด "ออกใบประกาศ":
   a. POST /api/upload-image → อัพโหลดรูปที่มีชื่อ
   b. POST /api/issue-certificate → Pin metadata JSON
   c. contract.issueCertificate() ผ่าน MetaMask
   d. แสดง Token ID และลิงก์ Etherscan
```

### 4.3 `src/app/my-certificates/page.tsx` — ดูใบประกาศ

```
Flow การทำงาน:
1. Mount: ตรวจสอบ wallet ที่เชื่อมอยู่แล้ว
2. ถ้ามี wallet: เรียก getCertificatesOfHolder(address)
   → ดึง tokenIds ทั้งหมดจาก contract
   → ดึง metadata จาก IPFS แบบ parallel (Promise.all)
3. แสดง CertificateCard สำหรับแต่ละใบ
```

---

## 5. Components

### 5.1 `src/components/Navbar.tsx`

```
State ที่จัดการ:
- address: wallet ที่เชื่อมต่ออยู่
- wrongNetwork: true ถ้าไม่ได้อยู่บน Sepolia
- dropdownOpen: เปิด/ปิด dropdown menu
- isAdmin: true ถ้า address == ADMIN_ADDRESS

Events ที่ฟัง:
- accountsChanged: อัพเดต address เมื่อผู้ใช้เปลี่ยน account ใน MetaMask
- chainChanged: เช็ค network ใหม่เมื่อผู้ใช้เปลี่ยน network

Dropdown แสดงตามสถานะ:
- ทุกคน: ใบประกาศของฉัน, Copy Address, Disconnect
- admin เท่านั้น: Admin Panel
```

### 5.2 `src/components/CertificateCard.tsx`

```
รับ props:
- onChain: ข้อมูลจาก blockchain (ชื่อ, courseId, วันที่, wallet)
- meta: ข้อมูลจาก IPFS JSON (รูป, description)

แสดง:
- รูปใบประกาศ (โหลดจาก IPFS ผ่าน gateway)
- ข้อมูล on-chain: ชื่อ, รหัสคอร์ส, วันที่, wallet
- ลิงก์เปิดรูปเต็มและ metadata บน IPFS
- Badge "ยกเลิกแล้ว" ถ้า revoked = true
```

---

## 6. Environment Variables (`.env.local`)

```
PINATA_API_KEY                      → ใช้บน server เท่านั้น (upload ไฟล์)
PINATA_SECRET_API_KEY               → ใช้บน server เท่านั้น (ซ่อน client)
PINATA_GATEWAY                      → URL gateway สำหรับแปลง ipfs:// → https://

NEXT_PUBLIC_CONTRACT_ADDRESS        → address ของ Smart Contract บน Sepolia
NEXT_PUBLIC_CHAIN_ID                → 11155111 (Sepolia)
NEXT_PUBLIC_ADMIN_ADDRESS           → wallet ที่มีสิทธิ์เห็นหน้า Admin
NEXT_PUBLIC_CERTIFICATE_TEMPLATE_CID → CID ของรูป template ที่อัพไว้บน Pinata
```

> ตัวแปรที่ขึ้นต้นด้วย `NEXT_PUBLIC_` จะถูกส่งไปยัง browser ด้วย  
> ตัวแปรที่ไม่มี `NEXT_PUBLIC_` จะอยู่บน server เท่านั้น (ปลอดภัยกว่า)

---

## 7. Flow การออกใบประกาศ (สรุปแบบ Step-by-Step)

```
[Admin]
  1. เปิดหน้า /admin
  2. MetaMask auto-connect (ไม่ต้องกดใหม่ถ้าเคย connect แล้ว)
  3. พิมพ์ชื่อนักเรียน → Canvas วาดชื่อบน template → แสดง preview
  4. ปรับ ขนาด / ตำแหน่ง / ฟอนต์ / สี → preview อัพเดตทันที
  5. กรอก Course ID และ Wallet Address ผู้รับ
  6. กด "ออกใบประกาศนียบัตร"

[Browser → Next.js Server]
  7. POST /api/upload-image
     → รูป PNG ที่มีชื่อฝังอยู่ → Pinata → ได้ imageIpfsUri

[Browser → Next.js Server]  
  8. POST /api/issue-certificate
     → สร้าง metadata JSON → Pinata → ได้ metadataUri

[Browser → MetaMask → Blockchain]
  9. MetaMask popup: "ยืนยันการส่ง transaction?"
  10. Admin กด Confirm
  11. Smart Contract บันทึก Certificate + mint Token
  12. คืน tokenId และ txHash

[ผู้รับ]
  13. เปิดหน้า /my-certificates
  14. Connect MetaMask ด้วย wallet ของตัวเอง
  15. ระบบดึงใบประกาศทั้งหมดจาก blockchain
  16. แสดงรูปใบประกาศที่มีชื่อจาก IPFS
```
