import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MY_CAREER_PLANNER | 오늘의 커리어 루틴",
  description: "목표를 계획하고, 실제 실행을 기록하고, 다음 계획으로 이어가는 커리어 루틴",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
