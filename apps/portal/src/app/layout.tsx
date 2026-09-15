import "./globals.css";

export const metadata = {
  title: "Gooseboard",
  description: "Manage your Gooseboard devices and sound library",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // The soundboard is a tap target grid; zooming on double-tap just gets in the way.
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
