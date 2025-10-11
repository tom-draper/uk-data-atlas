import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // webpack: (config, { isServer, dev }) => {
  //   // Optimize watch options in development
  //   if (dev && !isServer) {
  //     config.watchOptions = {
  //       ...config.watchOptions,
  //       // Reduce file watching to avoid unnecessary reloads
  //       ignored: ['**/node_modules', '**/.next', '**/.git'],
  //     };
  //   }
  //   return config;
  // },
  // // Optional: Configure caching headers for map assets
  // async headers() {
  //   return [
  //     {
  //       source: '/:path*',
  //       headers: [
  //         {
  //           key: 'Cache-Control',
  //           value: 'public, max-age=31536000, immutable',
  //         },
  //       ],
  //     },
  //   ];
  // },
};

export default nextConfig;
