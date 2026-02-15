import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ApplySettings } from "@/components/apply-settings";
import { SessionProvider } from "@/components/session-provider";
import { SplashScreen } from "@/components/splash-screen";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "HyperShift",
  description:
    "Agent-powered pipeline: from intent to deployed, with security, reliability, and cost built in.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <SessionProvider>
          <ApplySettings />
          <SplashScreen>{children}</SplashScreen>
        </SessionProvider>
      </body>
    </html>
  );
}
