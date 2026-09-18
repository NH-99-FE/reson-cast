// Real Next App Router, with production navigation components and no external services.
import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const fixture = await mkdtemp(join(tmpdir(), 'reson-navigation-'))
const files = [
  'components/sidebar-navigation.tsx',
  'components/sidebar-navigation.module.css',
  'components/sidebar-page-skeleton.tsx',
  'components/ui/skeleton.tsx',
  'lib/utils.ts',
]
for (const file of files) {
  await mkdir(join(fixture, 'src', file, '..'), { recursive: true })
  await cp(resolve('src', file), join(fixture, 'src', file))
}
await symlink(resolve('node_modules'), join(fixture, 'node_modules'))
await mkdir(join(fixture, 'src/app/[...slug]'), { recursive: true })
await writeFile(join(fixture, 'package.json'), JSON.stringify({ private: true }))
await writeFile(
  join(fixture, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'ES2017',
      lib: ['dom', 'esnext'],
      jsx: 'preserve',
      module: 'esnext',
      moduleResolution: 'bundler',
      esModuleInterop: true,
      strict: true,
      skipLibCheck: true,
      paths: { '@/*': ['./src/*'] },
    },
  })
)
await writeFile(
  join(fixture, 'src/app/layout.jsx'),
  `
import { Links } from './links'
export default function Layout({ children }) {
  return <html><body><Links /><main>{children}</main></body></html>
}`
)
await writeFile(
  join(fixture, 'src/app/links.jsx'),
  `
'use client'
import { useEffect, useState } from 'react'
import { SidebarNavigationLink } from '@/components/sidebar-navigation'
import { usePathname } from 'next/navigation'
export function Links() {
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  return <nav data-ready={ready}>
    {[['/', '主页'], ['/feed/trending', '热门'], ['/playlists/history', '历史记录'], ['/prefetched', '预取页面']].map(([href, label]) =>
      <SidebarNavigationLink key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</SidebarNavigationLink>)}
    <SidebarNavigationLink href="/feed/trending" target="_blank">新标签页</SidebarNavigationLink>
    <SidebarNavigationLink href="/playlists/liked" onClick={event => event.preventDefault()}>需要登录</SidebarNavigationLink>
  </nav>
}`
)
await writeFile(
  join(fixture, 'src/app/page.jsx'),
  `'use client'; import { useState } from 'react'; export default function Page() { const [value, setValue] = useState(''); return <><h1>原页面内容</h1><input aria-label="草稿" value={value} onChange={e => setValue(e.target.value)} /></> }`
)
await writeFile(
  join(fixture, 'src/app/[...slug]/page.jsx'),
  `
export const dynamic = 'force-dynamic'
export default async function Page({ params }) { const { slug } = await params; return <h1>真实页面：{slug.join('/')}</h1> }
`
)
await mkdir(join(fixture, 'src/app/prefetched'), { recursive: true })
await writeFile(
  join(fixture, 'src/app/prefetched/loading.jsx'),
  `
import { SidebarPageSkeleton } from '@/components/sidebar-page-skeleton'
export default function Loading() { return <SidebarPageSkeleton href="/feed/trending" /> }
`
)
await writeFile(
  join(fixture, 'src/app/prefetched/page.jsx'),
  `
export const dynamic = 'force-dynamic'
export default async function Page() {
  await new Promise(resolve => setTimeout(resolve, 1500))
  return <h1>预取页面真实内容</h1>
}
`
)
// Use the real production router: automatic prefetch is disabled in next dev.
// Webpack permits this fixture's dependency symlink outside its temporary root.
const next = resolve('node_modules/next/dist/bin/next')
let child
let stopping = false
const stop = () => {
  stopping = true
  child?.kill('SIGTERM')
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
const run = args =>
  new Promise((done, reject) => {
    child = spawn(process.execPath, [next, ...args], {
      stdio: 'inherit',
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    })
    child.once('error', reject)
    child.once('exit', code => done(code ?? 1))
  })
try {
  const code = await run(['build', fixture, '--webpack'])
  process.exitCode = code
  if (code === 0 && !stopping) process.exitCode = await run(['start', fixture, '-p', '4319', '-H', '127.0.0.1'])
} finally {
  await rm(fixture, { recursive: true, force: true })
}
