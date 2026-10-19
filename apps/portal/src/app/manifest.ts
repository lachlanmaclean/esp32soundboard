import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gooseboard",
    short_name: "Gooseboard",
    description: "Manage your Gooseboard devices and sound library",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#5865F2",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
