import type { Meta, StoryObj } from "@storybook/react-vite"

import { Glass } from "@/components/glass/glass"
import { Aurora, Backdrop, BackgroundExtension, Blockquote, Display, Heading, InlineCode, List, Prose, Text, TextLink, ThemeScope } from "@/components/glass/surfaces"

const meta = { title: "Glass/Catalog/Surfaces and Typography", parameters: { fullWidth: true } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Surfaces: Story = {
  render: () => (
    <div className="relative isolate min-h-[32rem] overflow-hidden rounded-[2rem] p-6 sm:p-10">
      <Aurora className="-z-10" />
      <div className="relative z-10 grid gap-5 md:grid-cols-2">
        <Glass className="grid gap-4 p-6">
          <Heading>Liquid materials</Heading>
          <Text>Frosted content surfaces keep reading content clear while floating tools use a stronger glass layer.</Text>
          <Glass variant="liquid" className="flex items-center justify-between gap-4 p-2 pl-4">
            <span className="text-sm">Floating tool group</span>
            <button className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Continue</button>
          </Glass>
        </Glass>
        <Backdrop variant="mesh" className="grid min-h-64 place-items-center rounded-3xl p-6">
          <Glass intensity="strong" className="max-w-xs p-5 text-center">Mesh backdrop</Glass>
        </Backdrop>
        <ThemeScope variables={{ "--primary": "oklch(0.58 0.17 160)", "--ring": "oklch(0.58 0.17 160)" }} className="rounded-3xl border border-[var(--glass-rim)] bg-[var(--glass-tint)]/40 p-6">
          <Heading level={3}>Scoped theme</Heading><Text size="sm">The accent is changed for this subtree only.</Text>
        </ThemeScope>
        <BackgroundExtension src="/pwa-192.svg" className="rounded-3xl border border-[var(--glass-rim)] p-6">
          <Text size="sm">Blurred image extension can continue beneath a toolbar edge.</Text>
        </BackgroundExtension>
      </div>
    </div>
  ),
}

export const Typography: Story = {
  render: () => (
    <Prose className="mx-auto rounded-3xl border border-[var(--glass-rim)] bg-[var(--glass-tint)]/60 p-8">
      <Display>Clear writing, quiet interface.</Display>
      <Text size="lg">A modular type scale keeps headings expressive without changing Writin's font family.</Text>
      <Heading level={2}>A short field note</Heading>
      <p>Use <InlineCode>ThemeScope</InlineCode> to adjust a single subtree. <TextLink href="#reference">Learn more</TextLink>.</p>
      <Blockquote>Good glass gives content a calm surface and lets the words remain the focus.</Blockquote>
      <List><li>Readable contrast</li><li>Comfortable line height</li></List>
    </Prose>
  ),
}
