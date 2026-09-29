import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Certificate SBT — ระบบออกใบประกาศนียบัตร",
  description: "ออกใบประกาศนียบัตรในรูปแบบ Soulbound Token บน Blockchain",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        {/* Google Fonts — โหลดฟอนต์ภาษาไทยทั้งหมดที่ใช้ใน canvas */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Mitr:wght@400;600&family=Sarabun:wght@400;700&family=Kanit:wght@400;700&family=Charm:wght@400;700&family=Charmonman:wght@400;700&family=Noto+Serif+Thai:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
