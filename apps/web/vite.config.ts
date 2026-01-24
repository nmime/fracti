import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, type Plugin } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

// Browser API stubs code moved to bundle-lambda.mjs for proper injection order
const browserStubsCode = ``;

// Plugin to inject browser stubs at the start of SSR bundle
function browserStubsPlugin(): Plugin {
  return {
    name: 'browser-stubs',
    apply: 'build',
    enforce: 'pre',
    renderChunk(code, chunk) {
      // Only inject into server entry chunk
      if (chunk.isEntry && chunk.facadeModuleId?.includes('server')) {
        return browserStubsCode + code;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    browserStubsPlugin(),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
  ],
  build: {
    target: "ES2024",
    rollupOptions: {
      // Ensure react-router is bundled
      external: [],
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router"],
  },
  resolve: {
    // Dedupe to ensure single copy is bundled
    dedupe: ["react-router", "react", "react-dom"],
  },
  ssr: {
    // Bundle everything for Lambda deployment
    noExternal: true,
    external: [],
  },
})
