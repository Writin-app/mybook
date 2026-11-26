import type { Meta, StoryObj } from '@storybook/react-vite'

const colorTokens = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
] as const

const appTokens = ['focus-ring', 'app-border', 'app-surface', 'app-subtle'] as const

const actionTokens = [
  'token-actions-primary-background',
  'token-actions-primary-background-hover',
  'token-actions-primary-background-pressed',
  'token-actions-primary-foreground',
  'token-actions-secondary-background',
  'token-actions-secondary-background-hover',
  'token-actions-secondary-foreground',
  'token-actions-outline-background',
  'token-actions-outline-border',
  'token-actions-destructive-background',
  'token-actions-destructive-background-hover',
  'token-actions-assist-background',
  'token-actions-assist-background-hover',
  'token-actions-disabled-background',
  'token-actions-disabled-foreground',
] as const

const feedbackTokens = [
  'token-feedback-neutral-background',
  'token-feedback-neutral-border',
  'token-feedback-neutral-foreground',
  'token-feedback-info-background',
  'token-feedback-info-border',
  'token-feedback-info-foreground',
  'token-feedback-positive-background',
  'token-feedback-positive-border',
  'token-feedback-positive-foreground',
  'token-feedback-attention-background',
  'token-feedback-attention-border',
  'token-feedback-attention-foreground',
  'token-feedback-destructive-background',
  'token-feedback-destructive-border',
  'token-feedback-destructive-foreground',
  'token-feedback-assistive-background',
  'token-feedback-assistive-border',
  'token-feedback-assistive-foreground',
] as const

const folderNames = ['grey', 'blue', 'green', 'yellow', 'orange', 'red', 'pink', 'violet'] as const

const paletteFamilies = [
  'graphite-neutral',
  'blue',
  'red',
  'yellow',
  'green',
  'violet',
  'orange',
  'pink',
  'cyan',
] as const

const paletteSteps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const

const radiusTokens = [
  'token-dimension-radius-2',
  'token-dimension-radius-4',
  'token-dimension-radius-6',
  'token-dimension-radius-8',
  'token-dimension-radius-10',
  'token-dimension-radius-12',
  'token-dimension-radius-16',
  'token-dimension-radius-20',
  'token-dimension-radius-24',
  'token-dimension-radius-32',
  'token-dimension-radius-40',
  'token-dimension-radius-48',
  'token-dimension-radius-rounded',
] as const

const spacingTokens = [
  'token-dimension-spacing-2',
  'token-dimension-spacing-4',
  'token-dimension-spacing-6',
  'token-dimension-spacing-8',
  'token-dimension-spacing-10',
  'token-dimension-spacing-12',
  'token-dimension-spacing-16',
  'token-dimension-spacing-20',
  'token-dimension-spacing-24',
  'token-dimension-spacing-32',
] as const

const typographyScale = [
  { size: '10', lineHeight: '16', label: 'Caption / XS' },
  { size: '12', lineHeight: '16', label: 'Body SM' },
  { size: '14', lineHeight: '20', label: 'Body MD (Default)' },
  { size: '16', lineHeight: '24', label: 'Body LG / Editor' },
  { size: '18', lineHeight: '24', label: 'Subtitle' },
  { size: '20', lineHeight: '28', label: 'Heading 4' },
  { size: '24', lineHeight: '32', label: 'Heading 3' },
  { size: '30', lineHeight: '36', label: 'Heading 2' },
  { size: '34', lineHeight: '40', label: 'Document Title' },
  { size: '40', lineHeight: '48', label: 'Display SM' },
  { size: '48', lineHeight: '56', label: 'Display MD' },
] as const

const fontWeights = ['light', 'regular', 'medium', 'semibold', 'bold'] as const

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
}

function TokenSwatch({ name }: { name: string }) {
  const value = cssVar(name)

  return (
    <div className="grid gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
      <div
        className="h-14 rounded-md border border-[var(--app-border)]"
        style={{ background: `var(--${name})` }}
      />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">--{name}</p>
        <p className="truncate text-xs text-muted-foreground">{value}</p>
      </div>
    </div>
  )
}

function TokenValue({ name }: { name: string }) {
  return (
    <div className="flex flex-1 items-center justify-between gap-4 py-2 text-sm">
      <span className="font-medium">--{name}</span>
      <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{cssVar(name)}</code>
    </div>
  )
}

const meta = {
  title: 'Foundations/Tokens',
  parameters: {
    docs: {
      description: {
        component: 'Live design-token reference generated from Figma token JSON sources into `src/styles/design-tokens.css` and bridged in `src/styles/globals.css`.',
      },
    },
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Colors: Story = {
  render: () => (
    <div className="space-y-10">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Semantic theme colors</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {colorTokens.map((token) => <TokenSwatch key={token} name={token} />)}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Action tokens</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actionTokens.map((token) => <TokenSwatch key={token} name={token} />)}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Feedback tokens</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {feedbackTokens.map((token) => <TokenSwatch key={token} name={token} />)}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Folder palette tokens</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {folderNames.map((folder) => (
            <div
              key={folder}
              className="flex items-center gap-3 rounded-lg border p-3"
              style={{
                background: `var(--token-folders-${folder}-outer)`,
                borderColor: `var(--token-folders-${folder}-outline)`,
                color: `var(--token-folders-${folder}-foreground-primary)`,
              }}
            >
              <div
                className="size-8 shrink-0 rounded-md"
                style={{ background: `var(--token-folders-${folder}-inner)` }}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold capitalize">{folder}</p>
                <p
                  className="truncate text-xs"
                  style={{ color: `var(--token-folders-${folder}-foreground-secondary)` }}
                >
                  --token-folders-{folder}-*
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">App surface tokens</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {appTokens.map((token) => <TokenSwatch key={token} name={token} />)}
        </div>
      </section>
    </div>
  ),
}

export const ColorPalette: Story = {
  render: () => (
    <div className="space-y-8">
      {paletteFamilies.map((family) => (
        <section key={family} className="space-y-2">
          <h2 className="text-base font-semibold capitalize">{family.replace('-', ' ')}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11">
            {paletteSteps.map((step) => {
              const token = `token-${family}-${step}`
              return (
                <div key={token} className="space-y-1">
                  <div
                    className="h-12 rounded-md border border-[var(--app-border)]"
                    style={{ background: `var(--${token})` }}
                  />
                  <p className="text-xs font-medium">{step}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{cssVar(token)}</p>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  ),
}

export const Typography: Story = {
  render: () => (
    <div className="space-y-10">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <p className="text-xs text-muted-foreground">--token-typography-font-family-primary</p>
          <p
            className="mt-2 text-2xl font-semibold"
            style={{ fontFamily: 'var(--token-typography-font-family-primary)' }}
          >
            Figtree Variable
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {cssVar('token-typography-font-family-primary')}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <p className="text-xs text-muted-foreground">--font-sans (Interface)</p>
          <p className="mt-2 text-2xl font-semibold">System UI</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{cssVar('font-sans')}</p>
        </div>
        <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
          <p className="text-xs text-muted-foreground">--font-mono</p>
          <p className="mt-2 font-mono text-2xl font-semibold">Monospace</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{cssVar('font-mono')}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Font weights</h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {fontWeights.map((weight) => (
            <div key={weight} className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
              <p
                className="text-xl"
                style={{
                  fontFamily: 'var(--token-typography-font-family-primary)',
                  fontWeight: `var(--token-typography-font-weight-${weight})`,
                }}
              >
                Aa Bb Cc
              </p>
              <p className="mt-2 text-xs font-medium capitalize">{weight}</p>
              <p className="text-xs text-muted-foreground">
                {cssVar(`token-typography-font-weight-${weight}`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Type scale (responsive desktop / tablet / mobile)</h2>
        <div className="divide-y divide-[var(--app-border)] rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)]">
          {typographyScale.map(({ size, lineHeight, label }) => (
            <div key={size} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-baseline sm:justify-between">
              <p
                style={{
                  fontFamily: 'var(--token-typography-font-family-primary)',
                  fontSize: `var(--token-typography-font-size-${size})`,
                  lineHeight: `var(--token-typography-line-height-${lineHeight})`,
                  fontWeight: 'var(--token-typography-font-weight-semibold)',
                }}
              >
                {label} — The quick brown fox
              </p>
              <code className="shrink-0 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                {cssVar(`token-typography-font-size-${size}`)} / {cssVar(`token-typography-line-height-${lineHeight}`)}
              </code>
            </div>
          ))}
        </div>
      </section>
    </div>
  ),
}

export const RadiusAndDimensions: Story = {
  render: () => (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Border radius</h2>
        <div className="divide-y divide-[var(--app-border)]">
          {radiusTokens.map((token) => (
            <div key={token} className="flex items-center gap-4 py-2">
              <div
                className="size-12 shrink-0 border border-primary bg-primary/10"
                style={{ borderRadius: `var(--${token})` }}
              />
              <TokenValue name={token} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Spacing scale</h2>
        <div className="divide-y divide-[var(--app-border)]">
          {spacingTokens.map((token) => (
            <div key={token} className="flex items-center gap-4 py-2">
              <div className="w-20 shrink-0">
                <div
                  className="h-3 rounded-sm bg-primary"
                  style={{ width: `var(--${token})` }}
                />
              </div>
              <TokenValue name={token} />
            </div>
          ))}
        </div>
      </section>
    </div>
  ),
}
