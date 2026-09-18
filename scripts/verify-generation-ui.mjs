// Isolated real-form browser harness: no credentials or external service requests.
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const { build } = createRequire(require.resolve('tsx/package.json'))('esbuild')
const client = resolve('tests/browser/generation-client.jsx')
const stubs = {
  '@clerk/nextjs': `import { state } from ${JSON.stringify(client)}; export const useAuth = () => ({userId: state.account, isLoaded: true});`,
  'next/navigation': 'export const useRouter = () => ({push() {}});',
  'next/image': 'export default function Image({fill, unoptimized, priority, ...props}) { return <img {...props}/> }',
  'next/link': 'export default function Link({prefetch, ...props}) { return <a {...props}/> }',
  '@/modules/studio/ui/components/thumbnail-generate-modal': 'export const ThumbnailGenerateModal = () => null;',
  '@/modules/studio/ui/components/thumbnail-upload-modal': 'export const ThumbnailUploadModal = () => null;',
  '@/modules/videos/ui/components/video-player': 'export const VideoPlayer = () => <div>Mock media player</div>;',
}
const result = await build({
  entryPoints: ['tests/browser/generation-ui.jsx'],
  bundle: true,
  write: false,
  jsx: 'automatic',
  format: 'iife',
  define: {
    'process.env.NODE_ENV': '"development"',
    'process.env.NEXT_PUBLIC_APP_URL': '"http://localhost:4318"',
  },
  plugins: [
    {
      name: 'test-boundaries',
      setup(build) {
        build.onResolve({ filter: /^ably$/ }, () => ({ path: resolve('tests/browser/realtime-ably.jsx') }))
        build.onResolve({ filter: /^@\/trpc\/client$/ }, () => ({ path: client }))
        build.onResolve({ filter: /^(next\/|@clerk\/|@\/modules\/)/ }, args =>
          args.path in stubs ? { path: args.path, namespace: 'stub' } : undefined
        )
        build.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({
          contents: stubs[args.path],
          loader: 'jsx',
          resolveDir: process.cwd(),
        }))
      },
    },
  ],
})
const realtime = await build({
  entryPoints: ['tests/browser/realtime-ui.jsx'],
  bundle: true,
  write: false,
  jsx: 'automatic',
  format: 'iife',
  define: {
    'process.env.NODE_ENV': '"development"',
    'process.env.NEXT_PUBLIC_APP_URL': '"http://localhost:4318"',
  },
  plugins: [
    {
      name: 'realtime-boundaries',
      setup(build) {
        build.onResolve({ filter: /^ably$/ }, () => ({ path: resolve('tests/browser/realtime-ably.jsx') }))
        build.onResolve({ filter: /^@\/trpc\/client$/ }, () => ({ path: client }))
        build.onResolve({ filter: /^(next\/|@clerk\/|@\/modules\/)/ }, args =>
          args.path in stubs ? { path: args.path, namespace: 'stub' } : undefined
        )
        build.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({
          contents: stubs[args.path],
          loader: 'jsx',
          resolveDir: process.cwd(),
        }))
      },
    },
  ],
})
const interactionsClient = resolve('tests/browser/interactions-client.jsx')
const interactions = await build({
  entryPoints: ['tests/browser/interactions-ui.jsx'],
  bundle: true,
  write: false,
  jsx: 'automatic',
  format: 'iife',
  define: {
    'process.env.NODE_ENV': '"development"',
    'process.env.NEXT_PUBLIC_APP_URL': '"http://localhost:4318"',
  },
  plugins: [
    {
      name: 'interaction-boundaries',
      setup(build) {
        build.onResolve({ filter: /^@\/trpc\/client$/ }, () => ({ path: interactionsClient }))
        build.onResolve({ filter: /^next\/(link|image)$/ }, args => ({ path: args.path, namespace: 'stub' }))
        build.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({
          contents: stubs[args.path],
          loader: 'jsx',
          resolveDir: process.cwd(),
        }))
        build.onResolve({ filter: /^@clerk\/nextjs$/ }, () => ({ path: 'clerk', namespace: 'interaction-stub' }))
        build.onLoad({ filter: /.*/, namespace: 'interaction-stub' }, () => ({
          contents:
            'export const useClerk = () => ({openSignIn() {}}); export const useAuth = () => ({ userId: "viewer", isLoaded: true });',
          loader: 'js',
        }))
      },
    },
  ],
})
const bundle = result.outputFiles[0].contents
const recoveryExample = await build({
  entryPoints: ['tests/browser/generation-action-ui.jsx'],
  bundle: true,
  write: false,
  jsx: 'automatic',
  format: 'iife',
  define: { 'process.env.NODE_ENV': '"development"' },
})
createServer((request, response) => {
  if (request.url === '/realtime.js') {
    response.setHeader('content-type', 'text/javascript')
    response.end(realtime.outputFiles[0].contents)
    return
  }
  if (request.url === '/realtime') {
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.end('<!doctype html><html><body><div id="root"></div><script src="/realtime.js"></script></body></html>')
    return
  }
  if (request.url === '/generation-action.js') {
    response.setHeader('content-type', 'text/javascript')
    response.end(recoveryExample.outputFiles[0].contents)
    return
  }
  if (request.url === '/generation-action') {
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.end('<!doctype html><html><body><div id="root"></div><script src="/generation-action.js"></script></body></html>')
    return
  }
  if (request.url === '/interactions.js') {
    response.setHeader('content-type', 'text/javascript')
    response.end(interactions.outputFiles[0].contents)
    return
  }
  if (request.url === '/interactions') {
    response.setHeader('content-type', 'text/html; charset=utf-8')
    response.end('<!doctype html><html><body><div id="root"></div><script src="/interactions.js"></script></body></html>')
    return
  }
  if (request.url === '/app.js') {
    response.setHeader('content-type', 'text/javascript')
    response.end(bundle)
    return
  }
  if (request.url !== '/') {
    response.writeHead(204).end()
    return
  }
  response.setHeader('content-type', 'text/html; charset=utf-8')
  response.end(
    '<!doctype html><html><head><title>Generation browser regression</title></head><body><pre id="report">Running browser checks…</pre><div id="root"></div><script src="/app.js"></script></body></html>'
  )
}).listen(4318, '127.0.0.1', () =>
  console.log('Open http://127.0.0.1:4318 — simulated services, real React form and query library. Ctrl+C to stop.')
)
