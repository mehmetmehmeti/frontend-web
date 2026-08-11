import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Diploma Cloud Console",
  description: "Cloud-side video streaming and recording control console",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
