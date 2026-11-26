import { readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

const sourceRoot = 'src/styles/design-tokens/source'

async function load(path) {
  return JSON.parse(await readFile(join(sourceRoot, path), 'utf8'))
}

function kebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function flatten(value, path = []) {
  if (!value || typeof value !== 'object') return []
  if (Object.hasOwn(value, '$value')) return [[path, value.$value]]
  return Object.entries(value)
    .filter(([key]) => key !== '$extensions' && key !== '$type')
    .flatMap(([key, child]) => flatten(child, [...path, key]))
}

function colorValue(value) {
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    const target = value.slice(1, -1).split('.').map(kebab).join('-')
    return `var(--token-${target})`
  }
  if (value?.hex) {
    const alpha = Math.round((value.alpha ?? 1) * 255)
    const suffix = alpha === 255 ? '' : alpha.toString(16).padStart(2, '0')
    return `${value.hex}${suffix}`
  }
  return String(value)
}

function scalarValue(path, value) {
  const name = path.map(kebab).join('-')
  if (path.includes('font-family') && value === 'Figtree') {
    return '"Figtree Variable", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  }
  if (typeof value !== 'number') return String(value)
  if (path.includes('opacity')) return `${value / 100}`
  if (path.includes('font-weight')) return `${value}`
  if (path[0] === 'letter-spacing') return `${value}px`
  return `${value}px`
}

function declaration(name, value) {
  return `  --token-${name}: ${value};`
}

function tokensBlock(entries, prefix = []) {
  return entries.map(([path, value]) => {
    const name = [...prefix, ...path].map(kebab).join('-')
    const rendered = value?.hex || (typeof value === 'string' && value.startsWith('{'))
      ? colorValue(value)
      : scalarValue([...prefix, ...path], value)
    return declaration(name, rendered)
  })
}

const primitiveColors = flatten(await load('colors.json'))
const light = flatten(await load('mode/mode-light.tokens.json'))
const dark = flatten(await load('mode/mode-dark.tokens.json'))
const desktopType = flatten(await load('typography/typography-desktop.tokens.json'))
const tabletType = flatten(await load('typography/typography-tablet.tokens.json'))
const mobileType = flatten(await load('typography/typography-mobile.tokens.json'))
const desktopDimension = flatten(await load('dimension/dimension-desktop.tokens.json'))
const tabletDimension = flatten(await load('dimension/dimension-tablet.tokens.json'))
const mobileDimension = flatten(await load('dimension/dimension-mobile.tokens.json'))

const modeAliases = [
  ['background', ['colors', 'background', 'default']],
  ['foreground', ['colors', 'foreground', 'primary']],
  ['card', ['colors', 'background', 'default']],
  ['card-foreground', ['colors', 'foreground', 'primary']],
  ['popover', ['colors', 'background', 'default']],
  ['popover-foreground', ['colors', 'foreground', 'primary']],
  ['primary', ['actions', 'primary', 'background']],
  ['primary-foreground', ['actions', 'primary', 'foreground']],
  ['secondary', ['colors', 'background', 'subtle']],
  ['secondary-foreground', ['colors', 'foreground', 'primary']],
  ['muted', ['colors', 'background', 'quiet']],
  ['muted-foreground', ['colors', 'foreground', 'secondary']],
  ['accent', ['colors', 'background', 'subtle']],
  ['accent-foreground', ['colors', 'foreground', 'primary']],
  ['destructive', ['colors', 'background', 'destructive-strong']],
  ['destructive-foreground', ['actions', 'destructive', 'foreground']],
  ['border', ['colors', 'border', 'primary']],
  ['input', ['colors', 'border', 'secondary']],
  ['ring', ['focus-ring', 'default-inner']],
  ['sidebar', ['colors', 'background', 'default']],
  ['sidebar-foreground', ['colors', 'foreground', 'primary']],
  ['sidebar-primary', ['actions', 'primary', 'background']],
  ['sidebar-primary-foreground', ['actions', 'primary', 'foreground']],
  ['sidebar-accent', ['colors', 'background', 'quiet']],
  ['sidebar-accent-foreground', ['colors', 'foreground', 'primary']],
  ['sidebar-border', ['colors', 'border', 'primary']],
  ['sidebar-ring', ['focus-ring', 'default-inner']],
]

function aliasLines() {
  const appAliases = [
    ['app-border', 'token-colors-border-primary'],
    ['app-surface', 'token-colors-background-default'],
    ['app-subtle', 'token-colors-background-quiet'],
    ['focus-ring', 'token-focus-ring-brand'],
    ['radius-control', 'token-dimension-radius-10'],
    ['radius-surface', 'token-dimension-radius-12'],
    ['radius-dialog', 'token-dimension-radius-16'],
  ]
  const lines = modeAliases.map(([name, path]) => {
    const tokenName = path.map(kebab).join('-')
    return `  --${name}: var(--token-${tokenName});`
  })
  for (const [name, target] of appAliases) lines.push(`  --${name}: var(--${target});`)
  lines.push('  --chart-1: var(--token-blue-300);')
  lines.push('  --chart-2: var(--token-blue-500);')
  lines.push('  --chart-3: var(--token-blue-700);')
  lines.push('  --chart-4: var(--token-violet-600);')
  lines.push('  --chart-5: var(--token-cyan-700);')
  lines.push('  --radius: var(--token-dimension-radius-10);')
  return lines
}

function modeBlock(selector, entries) {
  const lines = tokensBlock(entries)
  lines.push(...aliasLines())
  return `${selector} {\n${lines.join('\n')}\n}`
}

function responsiveBlock(label, typeEntries, dimensionEntries, maxWidth) {
  const lines = [
    ...tokensBlock(typeEntries, ['typography']),
    ...tokensBlock(dimensionEntries, ['dimension']),
  ]
  return `@media (max-width: ${maxWidth}px) {\n  :root {\n${lines.join('\n')}\n  }\n}`
}

const borderFiles = await readdir(join(sourceRoot, 'border-width'))
const standaloneBorders = []
for (const file of borderFiles.filter((name) => name.endsWith('.json'))) {
  const entries = flatten(await load(`border-width/${file}`))
  const scale = basename(file).match(/border-width-(\d+)/)?.[1]
  if (scale && entries[0]) standaloneBorders.push([[`standalone-${scale}`], entries[0][1]])
}

const content = [
  '/* Generated from src/styles/design-tokens/source. Run npm run tokens:build. */',
  ':root {',
  ...tokensBlock(primitiveColors),
  ...tokensBlock(desktopType, ['typography']),
  ...tokensBlock(desktopDimension, ['dimension']),
  ...tokensBlock(standaloneBorders, ['border-width']),
  ...tokensBlock(light),
  ...aliasLines(),
  '}',
  modeBlock('.dark, [data-theme="dark"]', dark),
  responsiveBlock('tablet', tabletType, tabletDimension, 768),
  responsiveBlock('mobile', mobileType, mobileDimension, 640),
  '',
].join('\n\n')

await writeFile('src/styles/design-tokens.css', content)
