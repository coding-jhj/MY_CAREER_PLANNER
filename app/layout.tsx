import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Post-training Research Engineer 지원 준비",
  description: "공개 Plan–Do–See 준비 기록",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
