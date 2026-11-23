import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { Chat, ChatBubble, ChatComposer, ChatDayDivider, ChatMessage, ChatParts, ChatTyping } from "@/components/glass"
import { Button } from "@/components/ui/button"

const meta = { title: "Glass/Catalog/Chat", parameters: { fullWidth: true } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function ChatDemo() {
  const [value, setValue] = useState("")
  const [approved, setApproved] = useState(false)
  const send = () => { setValue("") }
  return <section className="mx-auto grid h-[38rem] w-full max-w-3xl grid-rows-[1fr_auto] gap-3 rounded-[2rem] border border-[var(--glass-rim)] bg-[var(--app-surface)]/80 p-3 shadow-lg">
    <Chat aria-label="Writing assistant conversation" className="min-h-0">
      <ChatDayDivider>Today</ChatDayDivider>
      <ChatMessage from="user" name="You" timestamp="10:42 AM" avatarFallback="AL"><ChatBubble>Can you organize the main points and include the sources?</ChatBubble></ChatMessage>
      <ChatMessage from="assistant" name="Assistant" avatarFallback="AI" timestamp="10:43 AM" actions={<Button size="xs" variant="ghost">Copy</Button>} reactions={<span className="text-xs">Helpful · 2</span>}>
        <ChatBubble><ChatParts parts={[{ type: "reasoning", duration: "4s", text: "I grouped the notes by theme and checked the linked references." }, { type: "text", text: "## Main points\n- **Clarity** improves when each section has one purpose.\n- [Use short headings](https://example.com/guide) to help readers scan.\n\n| Section | Purpose |\n| --- | --- |\n| Intro | Set context |\n| Body | Explain evidence |\n\n```ts\nconst outline = [\"Context\", \"Evidence\"]\n```" }, { type: "source", title: "Writing guide", url: "https://example.com/guide" }, { type: "file", name: "outline.md", detail: "3 sections" }, { type: "tool", name: "Create outline", status: approved ? "complete" : "running", requiresApproval: !approved, result: approved ? "Outline ready" : undefined }]} onApprove={() => setApproved(true)} onDeny={() => setApproved(false)} /></ChatBubble>
      </ChatMessage>
      <ChatTyping name="Assistant" />
    </Chat>
    <ChatComposer value={value} onValueChange={setValue} onSend={send} quickReplies={["Make it shorter", "Add a conclusion"]} />
  </section>
}

export const Showcase: Story = { render: () => <ChatDemo /> }
