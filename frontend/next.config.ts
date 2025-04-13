/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://main-service-48k0.onrender.com'}`,
      },
    ];
  },
};

export default nextConfig;
