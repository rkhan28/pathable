import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PathAble",
    short_name: "PathAble",
    description: "Accessible pedestrian navigation, starting in Toronto.",
    start_url: "/en/navigate",
    display: "standalone",
    background_color: "#faf7f0",
    theme_color: "#12372a",
    icons: [{ src: "/brand/pathable-app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
