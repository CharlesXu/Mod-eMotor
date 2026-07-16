import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "电改模拟工具",
  description: "电动车姿态与改装参数模拟工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
