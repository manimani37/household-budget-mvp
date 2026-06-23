import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "使い切り家計簿 MVP",
  description: "手入力で収支と食材期限を管理するローカル保存の家計簿MVP",
  manifest: "/manifest.json",
  themeColor: "#3f7d58",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
