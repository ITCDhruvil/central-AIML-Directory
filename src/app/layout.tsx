import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { BrandingProvider } from "@/components/BrandingProvider";
import { PolicyProvider } from "@/components/PolicyProvider";
import { documentTitle } from "@/lib/branding";
import { getBranding } from "@/lib/brandingSettings";
import { getSecurityPolicy } from "@/lib/securityPolicySettings";
import { getCurrentUser } from "@/lib/auth/dal";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: documentTitle(await getBranding()),
    description: "Internal AIML project tracking directory",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [user, policy, branding] = await Promise.all([getCurrentUser(), getSecurityPolicy(), getBranding()]);
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme before first paint so the page never flashes the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-screen overflow-hidden">
        <BrandingProvider branding={branding}>
          <PolicyProvider policy={policy}>
            <AppShell user={user}>{children}</AppShell>
          </PolicyProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
