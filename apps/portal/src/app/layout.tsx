import "./globals.css";
import { ErrorBannerProvider } from "@/components/ErrorBannerProvider";
import { PlayerProvider } from "@/components/PlayerProvider";
import { NowPlayingBar } from "@/components/NowPlayingBar";

export const metadata = {
  title: "Gooseboard",
  description: "Manage your Gooseboard devices and sound library",
  manifest: "/manifest.webmanifest",
  // Covers the iOS "Add to Home Screen" case - Safari doesn't read the web
  // manifest for its icon/launch behavior, only these tags.
  appleWebApp: {
    capable: true,
    title: "Gooseboard",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // The soundboard is a tap target grid; zooming on double-tap just gets in the way.
  maximumScale: 1,
  themeColor: "#5865F2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ErrorBannerProvider>
          <PlayerProvider>
            {children}
            <NowPlayingBar />
          </PlayerProvider>
        </ErrorBannerProvider>
      </body>
    </html>
  );
}
