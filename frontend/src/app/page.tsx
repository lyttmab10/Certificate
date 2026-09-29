"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GraduationCap, ShieldCheck, Globe, Settings, ChevronRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import { getConnectedAddress } from "@/utils/metamask";

const ADMIN_ADDRESS = (process.env.NEXT_PUBLIC_ADMIN_ADDRESS ?? "").toLowerCase();

export default function HomePage() {
  const [isAdmin, setIsAdmin] = useState(false);

  // ตรวจสอบว่า wallet ที่เชื่อมอยู่เป็น admin หรือไม่
  useEffect(() => {
    (async () => {
      const addr = await getConnectedAddress();
      setIsAdmin(!!addr && addr.toLowerCase() === ADMIN_ADDRESS);
    })();

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: unknown) => {
        const list = accounts as string[];
        const addr = list[0] ?? "";
        setIsAdmin(addr.toLowerCase() === ADMIN_ADDRESS);
      });
    }
  }, []);

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-20 text-center">

        {/* Badge */}
        <div className="mb-6 inline-block bg-blue-100 text-blue-700 text-sm font-semibold px-4 py-1.5 rounded-full">
          Soulbound Token · IPFS · MetaMask
        </div>

        {/* Hero */}
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
          ระบบออกใบประกาศนียบัตร<br />
          <span className="text-blue-600">บน Blockchain</span>
        </h1>
        <p className="text-lg text-gray-500 max-w-xl mx-auto mb-10">
          ออกใบประกาศในรูปแบบ <strong>Soulbound Token (SBT)</strong> ที่ไม่สามารถโอนได้
          รูปใบประกาศเก็บบน IPFS ผ่าน Pinata และ Metadata ผูกกับ wallet ของผู้เรียน
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/my-certificates"
            className="btn-primary text-base px-8 py-3 flex items-center justify-center gap-2">
            <GraduationCap className="w-5 h-5" />
            ดูใบประกาศของฉัน
          </Link>

          {/* ปุ่ม Admin — แสดงเฉพาะ wallet ที่เป็น owner */}
          {isAdmin && (
            <Link href="/admin"
              className="btn-secondary text-base px-8 py-3 flex items-center justify-center gap-2">
              <Settings className="w-5 h-5" />
              Admin — ออกใบประกาศ
            </Link>
          )}
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-20 text-left">
          {[
            {
              Icon: ShieldCheck,
              title: "Non-Transferable",
              desc: "ใบประกาศผูกกับ wallet เจ้าของถาวร ไม่สามารถซื้อขายหรือโอนได้",
              color: "text-blue-600 bg-blue-50",
            },
            {
              Icon: Globe,
              title: "เก็บบน IPFS",
              desc: "รูปและ metadata เก็บแบบ decentralized ผ่าน Pinata ไม่มีวันหาย",
              color: "text-green-600 bg-green-50",
            },
            {
              Icon: ChevronRight,
              title: "ตรวจสอบได้ทันที",
              desc: "ใครก็ตรวจสอบความถูกต้องผ่าน blockchain ได้โดยไม่ต้องผ่านองค์กร",
              color: "text-purple-600 bg-purple-50",
            },
          ].map(({ Icon, title, desc, color }) => (
            <div key={title} className="card text-left">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
