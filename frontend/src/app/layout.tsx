import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "@/api/QueryProvider";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";

export const metadata: Metadata = {
  title: "HCM Lite — AI-Assisted Human Capital Management",
  description:
    "AI-assisted Human Capital Management system for Admin, HR, and Employees — Saylani Hackathon 2026",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
  },
};

const themeInitScript = `try{var m=document.querySelector('meta[name="color-scheme"]');if(m){m.content=localStorage.getItem("color-scheme")||"light dark";}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <QueryProvider>
          <LanguageProvider>
            <AuthProvider>{children}</AuthProvider>
          </LanguageProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
