import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Theo dõi thay tủ mát WCM",
    short_name: "Tủ mát WCM",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f5",
    theme_color: "#0f6b4f",
    lang: "vi",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
