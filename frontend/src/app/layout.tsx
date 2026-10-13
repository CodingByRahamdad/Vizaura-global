export const dynamic = 'force-dynamic';
import type { Metadata } from "next";
import { Inter, Playfair_Display, Geist_Mono } from "next/font/google";
import { CartWishlistProvider } from "@/context/CartWishlistContext";
import { AuthProvider } from "@/context/AuthContext";
import { MarketProvider } from "@/context/MarketContext";
import { getServerMarket } from "@/lib/market";
import { getMarketsServer } from "@/lib/api/markets-server";
import { MARKET_OPTIONS } from "@/lib/constants/nav";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VIZAURA GLOBAL",
  description: "VIZAURA GLOBAL — premium natural, wellness, and lifestyle products.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const initialMarket = await getServerMarket();
  // Real, backend-driven market list (an admin-deactivated market must not
  // be offered by the switcher) — falls back to the hardcoded MARKET_OPTIONS
  // if the fetch fails, never a silently empty switcher. See
  // docs/modules/MARKETS.md.
  const activeMarketCodes = await getMarketsServer()
    .then((markets) => new Set(markets.map((m) => m.code)))
    .catch(() => null);
  // MARKET_OPTIONS keeps its existing label formatting (e.g. "Pakistan
  // (PKR)") — only which codes are offered comes from the live endpoint, so
  // an admin-deactivated market disappears without changing switcher copy.
  // A failed/empty fetch falls back to every option, never a blank switcher.
  const marketOptions =
    activeMarketCodes && activeMarketCodes.size > 0
      ? MARKET_OPTIONS.filter((option) => activeMarketCodes.has(option.value))
      : MARKET_OPTIONS;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfairDisplay.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <MarketProvider initialMarket={initialMarket} marketOptions={marketOptions}>
            <CartWishlistProvider>{children}</CartWishlistProvider>
          </MarketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
