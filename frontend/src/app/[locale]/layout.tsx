import { Nunito, Nunito_Sans } from 'next/font/google';
import Script from 'next/script';
import '../globals.css';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { ProfileProvider } from '@/context/ProfileContext';
import { PageBrand } from '@/components/ui/PageBrand';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { EmergencyBar } from '@/components/ui/EmergencyBar';
import { BottomNav } from '@/components/ui/BottomNav';
import { SignOutButton } from '@/components/ui/SignOutButton';
import { LocaleDocumentSync } from '@/components/ui/LocaleDocumentSync';
import { THEME_COOKIE } from '@/lib/theme';
import { isRtl, SUPPORTED_LOCALES } from '@/lib/locale';

const nunito = Nunito({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'CalmGuide',
  description:
    'Multilingual AI companion for dementia caregivers. Get calm, structured support when you need it most.',
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'CalmGuide',
    description:
      'Multilingual AI companion for dementia caregivers. Get calm, structured support when you need it most.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#2B7A78',
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
  const isDark = theme === 'dark';
  const useSystemTheme = !theme;
  const rtl = isRtl(locale);

  return (
    <html
      lang={locale}
      dir={rtl ? 'rtl' : 'ltr'}
      className={`${nunito.variable} ${nunitoSans.variable}${isDark ? ' dark' : ''}`}
      // The beforeInteractive scripts below add `dark`/`data-facility`/`data-landing`
      // to this element before React hydrates (to avoid a flash of unstyled
      // content), based on client-only state (OS theme preference, pathname)
      // the server render can't know. That's an intentional, expected
      // mismatch on this element only -- suppress it rather than the render.
      suppressHydrationWarning
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
        {/* Locale list below must stay in sync with SUPPORTED_LOCALES in src/lib/locale.ts. */}
        <Script id="landing-layout-detect" strategy="beforeInteractive">{`
          try {
            if (/^\\/(en-US|es-ES|hi-IN)\\/?$/.test(window.location.pathname)) {
              document.documentElement.setAttribute('data-landing', '');
            }
          } catch (e) {}
        `}</Script>
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
            data-options={JSON.stringify({
              activationKey: 'space',
              activationMode: 'toggle',
              allowActivationInsideInput: true,
              maxContextLines: 3,
            })}
          />
        )}
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="https://mcp.figma.com/mcp/html-to-design/capture.js"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="min-h-dvh bg-background text-foreground font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <LocaleDocumentSync />
          <ProfileProvider>
            <div id="root-shell" className="h-dvh flex flex-col overflow-hidden">
              {/* The shell stays a single narrow column on phones (correct for
               * a one-handed, 3am tool) but is allowed to widen from `lg` up
               * so desktop screens can use horizontal space instead of
               * rendering a 512px ribbon on a 1440px display. Screens that
               * should stay narrow constrain themselves internally. */}
              <div
                id="root-chrome-header"
                className="mx-auto w-full max-w-lg lg:max-w-app flex items-center justify-between px-5 py-3 shrink-0"
              >
                <PageBrand />
                <div className="flex items-center gap-1">
                  <ThemeToggle className="h-12 w-12" />
                  {/* Sign out is also the only route back to the landing page —
                   * WelcomeGate redirects any stored session away from it.
                   * Confirmation-guarded, since an accidental 3am tap would
                   * send an exhausted caregiver hunting for their code. */}
                  <SignOutButton variant="icon" />
                </div>
              </div>
              <div
                id="root-content"
                className="mx-auto w-full max-w-lg lg:max-w-app flex-1 flex flex-col min-h-0"
              >
                {children}
              </div>
              <div id="root-chrome-footer">
                <EmergencyBar />
                <BottomNav />
              </div>
            </div>
          </ProfileProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
