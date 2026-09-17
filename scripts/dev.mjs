import { spawn, spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const electron = require('electron')

function runVite(args) {
  const result = spawnSync(process.execPath, [viteCli, ...args], { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) {
    process.exitCode = 1
    process.exit(result.status ?? 1)
  }
}

runVite(['build', '-c', 'vite.main.config.ts'])
runVite(['build', '-c', 'vite.preload.config.ts'])

const devUrl = 'http://localhost:5173'
const renderer = spawn(process.execPath, [viteCli], { cwd: root, stdio: 'inherit' })

async function waitFor(url, attempts = 90) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {
      // server not ready yet
    }
    await delay(500)
  }
  return false
}

const up = await waitFor(devUrl)
if (!up) {
  console.error('[dev] Vite 开发服务器启动超时')
  renderer.kill()
  process.exit(1)
}

const app = spawn(electron, ['.'], {
  cwd: root,
  stdio: ['inherit', 'pipe', 'pipe'],
  env: { ...process.env, VITE_DEV_SERVER_URL: devUrl }
})

app.stdout.setEncoding('utf8')
app.stderr.setEncoding('utf8')
app.stdout.on('data', (chunk) => process.stdout.write(chunk))
app.stderr.on('data', (chunk) => process.stderr.write(chunk))

app.on('exit', (code) => {
  renderer.kill()
  process.exit(code ?? 0)
})
