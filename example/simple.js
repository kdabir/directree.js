import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import directree, {text, js} from '../dist/index.js'


// run `pnpm run build` first, then `node example/simple.js`

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'out')

const plan = directree({
  '.gitignore': text`node_modules`,
  'README.md': '# my project',
  'index.js': js`export default () => "hello"`,
  'spec': {
    'index.spec.js': 'import hello from "../index.js";',
  },
}, outDir)

console.log(plan)
