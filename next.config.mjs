/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/network',
        destination: '/pairing-network.html',
      },
    ];
  },
};

export default nextConfig;