import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const localAddresses = Object.values(networkInterfaces()).flatMap((addresses) =>
  (addresses || [])
    .filter((address) => address.family === "IPv4")
    .map((address) => address.address),
);

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: [...new Set(localAddresses)],
};

export default nextConfig;
