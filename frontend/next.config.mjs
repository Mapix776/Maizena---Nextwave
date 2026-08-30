import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDirectory = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.join(appDirectory, '..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  turbopack: {
    root: workspaceRoot,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
