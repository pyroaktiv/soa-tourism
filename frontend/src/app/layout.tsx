import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SOA Tourism App",
  description: "Aplikacija za turizam",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr">
      <body className={inter.className}>
        <Navbar />
        <main className="container mx-auto p-4 mt-4">
          {children}
        </main>
      </body>
    </html>
  );
}