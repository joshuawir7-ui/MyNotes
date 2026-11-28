import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Dancing_Script } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dancingScript = Dancing_Script({
  variable: "--font-dancing-script",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyNotes",
  description: "A premium, visual task manager",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

import MainLayout from "@/components/layout/main-layout";

const PRE_HYDRATION_TIER_SCRIPT = `(function(){try{var d=document.documentElement;var raw=localStorage.getItem('mynotes_perf_tier_mirror_v1');if(raw){var m=JSON.parse(raw);if(m&&m.tier){d.setAttribute('data-tier',m.tier);d.setAttribute('data-fx-blur',m.fxBlur||(m.tier==='low'?'off':'on'));d.setAttribute('data-fx-shadow',m.fxShadow||(m.tier==='high'?'full':'simple'));d.setAttribute('data-fx-motion',m.fxMotion||(m.tier==='high'?'full':m.tier==='medium'?'reduced':'minimal'));d.setAttribute('data-fx-bg',m.fxBg||(m.tier==='low'?'off':'on'));return;}}var leg=localStorage.getItem('notes-storage');if(leg){var lp=JSON.parse(leg);if(lp&&lp.state&&lp.state.performanceMode){d.setAttribute('data-tier','low');d.setAttribute('data-fx-blur','off');d.setAttribute('data-fx-shadow','simple');d.setAttribute('data-fx-motion','minimal');d.setAttribute('data-fx-bg','off');return;}}d.setAttribute('data-tier','medium');d.setAttribute('data-fx-blur','on');d.setAttribute('data-fx-shadow','simple');d.setAttribute('data-fx-motion','reduced');d.setAttribute('data-fx-bg','on');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <script dangerouslySetInnerHTML={{ __html: PRE_HYDRATION_TIER_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dancingScript.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <MainLayout>
            {children}
          </MainLayout>
        </ThemeProvider>
      </body>
    </html>
  );
}
