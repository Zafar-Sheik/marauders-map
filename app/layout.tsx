import type { Metadata, Viewport } from "next";
import { IM_Fell_English, IM_Fell_English_SC, Pinyon_Script } from "next/font/google";
import "./globals.css";

const fell = IM_Fell_English({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-fell" });
const fellSC = IM_Fell_English_SC({ weight: "400", subsets: ["latin"], variable: "--font-fell-sc" });
const pinyon = Pinyon_Script({ weight: "400", subsets: ["latin"], variable: "--font-script" });

export const metadata: Metadata = {
  title: "The Marauder's Map",
  description:
    "An interactive, folding Marauder's Map of Hogwarts — every floor, the towers, the dungeons and the grounds, with live footprints, secret passages and hidden mischief.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#140c06",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className={`${fell.variable} ${fellSC.variable} ${pinyon.variable}`}>{children}</body>
    </html>
  );
}
