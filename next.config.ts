import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack rules apply only during local `next dev` (not Vercel production builds)
  ...(process.env.NODE_ENV !== "production" && {
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
  }),
};

export default nextConfig;
