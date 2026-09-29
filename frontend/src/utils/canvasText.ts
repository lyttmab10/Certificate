/**
 * canvasText.ts
 * ─────────────
 * วาดชื่อนักเรียนทับบนรูป template ด้วย Canvas API
 * แล้ว export เป็น File (PNG) พร้อม upload ไป Pinata
 *
 * ทำงานบน client-side เท่านั้น (ต้องการ browser Canvas)
 */

export interface TextConfig {
  text:       string;
  topPercent: number;
  fontSize:   number;
  color:      string;
  fontFamily: string;
  fontWeight: string;   // "bold" | "600" | "normal" ฯลฯ
}

const DEFAULT_CONFIG: Omit<TextConfig, "text"> = {
  topPercent: 54,
  fontSize:   32,   // ลดลงจาก 48 → 32 (เทียบกับความกว้างรูป 800px)
  color:      "#1a1a2e",
  fontFamily: "Sarabun, Noto Serif Thai, serif",
  fontWeight: "bold",
};

/**
 * โหลดรูปจาก URL แล้ววาดชื่อทับ → คืนเป็น File (PNG)
 *
 * @param templateUrl  URL ของรูป template (https://...)
 * @param studentName  ชื่อนักเรียนที่จะวาด
 * @param config       ตั้งค่าตัวหนังสือ (optional)
 */
export async function drawNameOnCertificate(
  templateUrl: string,
  studentName: string,
  config?: Partial<Omit<TextConfig, "text">>
): Promise<File> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // ── โหลดรูป template ──────────────────────────────────────
  const img = await loadImage(templateUrl);

  // ── สร้าง Canvas ขนาดเท่ารูป ─────────────────────────────
  const canvas = document.createElement("canvas");
  canvas.width  = img.naturalWidth  || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ไม่สามารถสร้าง Canvas context ได้");

  // ── วาดรูป template ───────────────────────────────────────
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // ── ตั้งค่าตัวหนังสือ ─────────────────────────────────────
  // fontSize อิงตามขนาดรูปจริง เพื่อให้ scale ถูกต้องทุกขนาด
  const scaledFontSize = Math.round((cfg.fontSize / 800) * canvas.width);
  ctx.font        = `${cfg.fontWeight} ${scaledFontSize}px ${cfg.fontFamily}`;
  ctx.fillStyle   = cfg.color;
  ctx.textAlign   = "center";
  ctx.textBaseline = "middle";

  // ── คำนวณตำแหน่ง ─────────────────────────────────────────
  const x = canvas.width  / 2;
  const y = canvas.height * (cfg.topPercent / 100);

  // ── วาดชื่อ ───────────────────────────────────────────────
  ctx.fillText(studentName, x, y);

  // ── Export เป็น Blob → File ───────────────────────────────
  const blob = await canvasToBlob(canvas);
  const safeName = studentName.replace(/[^a-zA-Z0-9ก-๙\s]/g, "").trim().replace(/\s+/g, "_");
  return new File([blob], `certificate_${safeName}.png`, { type: "image/png" });
}

// ── Helpers ──────────────────────────────────────────────────

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous"; // จำเป็นสำหรับ IPFS/external URL
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`โหลดรูปไม่ได้: ${url}`));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png", 1.0);
  });
}
