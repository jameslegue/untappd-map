import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { DataProvider } from "@/components/DataProvider";
import { Nav } from "@/components/Nav";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "jimmylegs.beer",
  description: "Every place I've checked in a beer.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={geist.variable}>
        <DataProvider>
          <Nav />
          <main className="main">{children}</main>
        </DataProvider>
      </body>
    </html>
  );
}
