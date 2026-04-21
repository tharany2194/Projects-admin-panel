import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Crowfy Admin",
    short_name: "Crowfy",
    description: "Crowfy Admin business management dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#6c5ce7",
    orientation: "portrait",
    icons: [
      {
        src: "/crowfy-logo.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/crowfy-logo.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/crowfy-logo.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
