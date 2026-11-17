import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // 체감 성능 기록에 어느 배포의 측정값인지 남긴다(D-075)
  env: { NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7) },
  partialPrefetching: true,
  // D-287: www.damo-on.com으로 들어오면 대표 주소 damo-on.com으로(경로·쿼리 그대로, 영구 이동)
  async redirects() {
    return [{ source: "/:path*", has: [{ type: "host", value: "www.damo-on.com" }], destination: "https://damo-on.com/:path*", permanent: true }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
