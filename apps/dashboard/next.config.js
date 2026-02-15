/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@hypershift/shared", "@hypershift/contracts"],
  reactStrictMode: true,
};

module.exports = nextConfig;
