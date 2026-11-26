import type { Meta, StoryObj } from '@storybook/react-vite'

const writinIcons = [
  '/icons/resize-field.svg',
  '/icons/checked.svg',
  '/icons/writin-doc-icon.svg',
  '/icons/more-horizontal-strong.svg',
  '/icons/vault.svg',
  '/icons/writin-folder.svg',
]

const appIcons = [
  '/icons/file.svg',
  '/icons/folder-small.svg',
  '/icons/folder.svg',
  '/icons/gear.svg',
  '/icons/house.svg',
  '/icons/magnifier.svg',
  '/icons/pencil-to-square.svg',
  '/icons/sheet.svg',
  '/pwa-192.svg',
  '/pwa-512.svg',
  '/pwa-maskable.svg',
]

function IconGrid({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {items.map((src) => (
        <div
          key={src}
          className="grid min-h-28 place-items-center gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3 text-center"
        >
          <img src={src} alt="" aria-hidden="true" className="size-8" />
          <span className="max-w-full truncate text-xs text-muted-foreground">
            {src.replace(/^\//, '')}
          </span>
        </div>
      ))}
    </div>
  )
}

const meta = { title: 'Foundations/Icons/Custom Icons' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const AppIcons: Story = {
  render: () => (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Writin Custom Icons</h2>
        <IconGrid items={writinIcons} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">App &amp; PWA Icons</h2>
        <IconGrid items={appIcons} />
      </section>
    </div>
  ),
}
