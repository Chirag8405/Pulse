import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AxeMonitor } from "@/components/shared/AxeMonitor";
import { ReactQueryProvider } from "@/components/shared/ReactQueryProvider";
import { SkipToContent } from "@/components/shared/SkipToContent";
import { AuthBootstrap } from "@/components/layout/AuthBootstrap";
import { APP_NAME, APP_TAGLINE } from "@/constants";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  keywords: ["crowd management", "venue operations", "live events", "sports"],
  authors: [{ name: "PULSE Team" }],
  robots: "noindex, nofollow", // hackathon demo — not for public indexing
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffdf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ReactQueryProvider>
            <TooltipProvider>
              <SkipToContent />
              <AuthBootstrap />
              {process.env.NODE_ENV === "development" ? <AxeMonitor /> : null}
              <main id="main-content">
                {children}
              </main>
              <Toaster richColors closeButton />
            </TooltipProvider>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
