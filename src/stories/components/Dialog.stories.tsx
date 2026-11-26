import { useEffect, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Copy01Icon, Share01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  type DialogSize,
} from "@/components/ui/dialog"

import { DialogExample } from "../shadcnExamples"

type DialogPlaygroundArgs = {
  size: DialogSize
  scrollableContent: boolean
  showCloseButton: boolean
  showInlineAction: boolean
  showLeadingFooterActions: boolean
  title: string
  description: string
  bodyText: string
  primaryLabel: string
  cancelLabel: string
}

function DialogPlayground({
  size,
  scrollableContent,
  showCloseButton,
  showInlineAction,
  showLeadingFooterActions,
  title,
  description,
  bodyText,
  primaryLabel,
  cancelLabel,
}: DialogPlaygroundArgs) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [size, scrollableContent, showCloseButton])

  const paragraphs = scrollableContent
    ? Array.from({ length: 12 }, (_, index) => `${index + 1}. ${bodyText}`)
    : [bodyText, bodyText]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Open Dialog ({size})</DialogTrigger>
      <DialogContent size={size} scrollableContent={scrollableContent} showCloseButton={showCloseButton}>
        <DialogHeader
          inlineAction={
            showInlineAction ? (
              <>
                <Button aria-label="Copy link" size="icon-xs" variant="ghost">
                  <HugeiconsIcon aria-hidden="true" icon={Copy01Icon} strokeWidth={1.75} />
                </Button>
                <Button aria-label="Share" size="icon-xs" variant="ghost">
                  <HugeiconsIcon aria-hidden="true" icon={Share01Icon} strokeWidth={1.75} />
                </Button>
                <Badge>Beta</Badge>
              </>
            ) : undefined
          }
        >
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {paragraphs.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </DialogBody>
        <DialogFooter
          leadingActions={
            showLeadingFooterActions ? (
              <>
                <Button variant="outline">Back</Button>
                <Button variant="destructive">Delete</Button>
              </>
            ) : undefined
          }
        >
          <DialogClose render={<Button variant="outline" />}>
            {cancelLabel}
          </DialogClose>
          <Button onClick={() => setOpen(false)}>{primaryLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const meta = {
  title: "Components/Dialog",
  component: DialogPlayground,
  args: {
    size: "md",
    scrollableContent: false,
    showCloseButton: true,
    showInlineAction: false,
    showLeadingFooterActions: false,
    title: "Title",
    description: "Description goes here",
    bodyText:
      "A window overlaid on either the primary window or another dialog window, rendering the content underneath inert.",
    primaryLabel: "Continue",
    cancelLabel: "Cancel",
  },
  argTypes: {
    size: {
      control: "inline-radio",
      options: ["sm", "md", "lg", "xl"],
    },
    scrollableContent: { control: "boolean" },
    showCloseButton: { control: "boolean" },
    showInlineAction: { control: "boolean" },
    showLeadingFooterActions: { control: "boolean" },
    title: { control: "text" },
    description: { control: "text" },
    bodyText: { control: "text" },
    primaryLabel: { control: "text" },
    cancelLabel: { control: "text" },
  },
} satisfies Meta<DialogPlaygroundArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Default: Story = {
  render: () => <DialogExample />,
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {(["sm", "md", "lg", "xl"] as const).map((size) => (
        <Dialog key={size}>
          <DialogTrigger render={<Button variant="outline" />}>
            Size: {size}
          </DialogTrigger>
          <DialogContent size={size}>
            <DialogHeader>
              <DialogTitle>Dialog ({size})</DialogTitle>
              <DialogDescription>
                Configured width preset for {size} dialogs.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <p>
                A window overlaid on either the primary window or another dialog
                window, rendering the content underneath inert.
              </p>
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Cancel
              </DialogClose>
              <DialogClose render={<Button />}>Continue</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  ),
}

export const ScrollableBody: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        Open Scrollable Dialog
      </DialogTrigger>
      <DialogContent size="md" scrollableContent>
        <DialogHeader>
          <DialogTitle>Terms of Service</DialogTitle>
          <DialogDescription>
            Review the updated workspace sync policy before continuing.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {Array.from({ length: 16 }, (_, index) => (
            <p key={index}>
              {index + 1}. A window overlaid on either the primary window or
              another dialog window, rendering the content underneath inert.
            </p>
          ))}
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button />}>Accept</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}
