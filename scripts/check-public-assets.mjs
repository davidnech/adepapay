import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const missing = []
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) await inspect(filename)
    else if (entry.isFile()) {
      const bytes = await readFile(filename)
      if (bytes.subarray(0, 100).toString().startsWith('version https://git-lfs.github.com/spec/v1')) {
        missing.push(path.relative(root, filename))
      }
    }
  }
}
await inspect(path.join(root, 'public'))
if (missing.length) {
  console.error('Build stopped: these website assets are Git LFS pointers, not the original files:')
  missing.forEach(filename => console.error(`  ${filename}`))
  console.error('Restore the original assets from your project backup, then git add and commit them. See DEPLOY_RENDER.md.')
  process.exitCode = 1
} else {
  console.log('Public assets checked: no unresolved Git LFS pointers.')
}
