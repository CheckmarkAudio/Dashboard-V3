import { readdir, readFile } from 'node:fs/promises'
const markers = ['Dev Admin', 'dev@checkmarkaudio.com', 'SAMPLE_READ_ONLY', 'sample-project-0', 'preview-login-sentinel@example.test', 'preview-password-sentinel']
const files = (await readdir('dist/assets')).filter(file => file.endsWith('.js'))
if (!files.length) throw new Error('No release JavaScript found')
for (const file of files) {
  const contents = await readFile(`dist/assets/${file}`, 'utf8')
  for (const marker of markers) {
    if (contents.includes(marker)) throw new Error(`Release contains a development/auth-test marker in ${file}`)
  }
}
console.log(`Checked ${files.length} release chunks: no development user, sample transport, or injected login credentials.`)
