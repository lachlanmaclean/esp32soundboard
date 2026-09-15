export const metadata = {
  title: "Gooseboard",
  description: "Manage your Gooseboard devices and sound library",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
