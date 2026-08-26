import { Nunito, Nunito_Sans } from "next/font/google";
import { Noto_Sans_Arabic, Noto_Sans_JP, Noto_Sans_KR, Noto_Sans_SC } from "next/font/google";
import Script from "next/script";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { ProfileProvider } from "@/context/ProfileContext";
import { PageBrand } from "@/components/ui/PageBrand";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { EmergencyBar } from "@/components/ui/EmergencyBar";
import { LocaleDocumentSync } from "@/components/ui/LocaleDocumentSync";
import { THEME_COOKIE } from "@/lib/theme";
import { isRtl, SUPPORTED_LOCALES } from "@/lib/locale";

const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-arabic",
});

const notoJP = Noto_Sans_JP({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jp",
});

const notoKR = Noto_Sans_KR({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-kr",
});

const notoSC = Noto_Sans_SC({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sc",
});

export const metadata: Metadata = {
  title: "CalmGuide",
  description:
    "Multilingual AI companion for dementia caregivers. Get calm, structured support when you need it most.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "CalmGuide",
    description:
      "Multilingual AI companion for dementia caregivers. Get calm, structured support when you need it most.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#2B7A78",
};

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();
  const cookieStore = await cookies();
  const theme = cookieStore.get(THEME_COOKIE)?.value;
  // Cookie wins; otherwise defer to OS preference at runtime via the inline script below.
  const isDark = theme === "dark";
  const useSystemTheme = !theme;
  const rtl = isRtl(locale);

  return (
    <html
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className={`${nunito.variable} ${nunitoSans.variable} ${notoArabic.variable} ${notoJP.variable} ${notoKR.variable} ${notoSC.variable}${isDark ? " dark" : ""}`}
    >
      <head>
        {useSystemTheme && (
          <Script id="prefers-color-scheme-fallback" strategy="beforeInteractive">{`
            try {
              if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
              }
            } catch (e) {}
          `}</Script>
        )}
        <Script id="facility-layout-detect" strategy="beforeInteractive">{`
          try {
            if (/\\/facility(\\/|$)/.test(window.location.pathname) && !/\\/facility\\/login/.test(window.location.pathname)) {
              document.documentElement.setAttribute('data-facility', '');
            }
          } catch (e) {}
        `}</Script>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
            data-options={JSON.stringify(
              { activationKey: "space", activationMode: "toggle", allowActivationInsideInput: true, maxContextLines: 3 }
            )}
          />
        )}
        {process.env.NODE_ENV === "development" && (
          <Script src="https://mcp.figma.com/mcp/html-to-design/capture.js" strategy="afterInteractive" />
        )}
      </head>
      <body className="min-h-dvh bg-background text-foreground font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <LocaleDocumentSync />
          <ProfileProvider>
            <div className="h-dvh flex flex-col overflow-hidden">
              <div id="root-chrome-header" className="mx-auto w-full max-w-lg flex items-center justify-between px-5 py-3 shrink-0">
                <PageBrand />
                <ThemeToggle className="h-10 w-10" />
              </div>
              <div id="root-content" className="mx-auto w-full max-w-lg flex-1 flex flex-col min-h-0">{children}</div>
              <div id="root-chrome-footer"><EmergencyBar /></div>
            </div>
          </ProfileProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
