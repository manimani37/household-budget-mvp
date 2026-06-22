import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "使い切り家計簿 MVP",
  description: "手入力で収支と食材期限を管理するローカル保存の家計簿MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
