import type { Meta, StoryObj } from "@storybook/react-vite"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"

const meta = { title: "Glass/Surfaces", parameters: { fullWidth: true } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

export const Materials: Story = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Glass material</CardTitle>
          <CardDescription>Content surfaces stay quiet and readable.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Cards use the regular material tier and a soft rim.</CardContent>
      </Card>
      <Alert>
        <AlertTitle>Soft callout</AlertTitle>
        <AlertDescription>Inline feedback uses a gentle fill instead of a heavy panel.</AlertDescription>
      </Alert>
      <Item variant="outline">
        <ItemContent><ItemTitle>Outlined row</ItemTitle><ItemDescription>A reusable row with a low contrast glass outline.</ItemDescription></ItemContent>
      </Item>
      <Item variant="muted">
        <ItemContent><ItemTitle>Muted row</ItemTitle><ItemDescription>Subtle fill for grouped content.</ItemDescription></ItemContent>
      </Item>
    </div>
  ),
}
