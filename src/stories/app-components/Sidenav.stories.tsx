import type { Meta, StoryObj } from "@storybook/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Clock01Icon,
  CloudSavingDone01Icon,
  Delete03Icon,
  File01Icon,
  HelpSquareIcon,
  Layers01Icon,
  LibraryIcon,
  Search01Icon,
  UnfoldMoreIcon,
} from "@hugeicons/core-free-icons"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { FolderIllustration } from "@/components/ui/folder-illustration"
import { IconWrapper } from "@/components/ui/icon-wrapper"
import {
  NavGroup,
  NavItem,
  TrailingContent,
} from "@/components/layout/sidenav/SidenavPrimitives"

const FAVORITE_ITEMS: Array<{
  label: string
  kind: "file" | "folder"
  folderStyle?: "grey" | "green"
  variant?: "subtle" | "strong"
}> = [
  { label: "Project spec", kind: "file" },
  { label: "Design mockup", kind: "file" },
  { label: "User flow", kind: "file" },
  { label: "Style guide", kind: "file" },
  { label: "Prototype", kind: "file" },
  { label: "User testing", kind: "file" },
  { label: "Final presentation", kind: "file" },
  { label: "Feedback report", kind: "file" },
  { label: "Development handoff", kind: "folder", folderStyle: "green", variant: "strong" },
  { label: "Design tokens", kind: "folder", folderStyle: "grey", variant: "subtle" },
  { label: "Iteration notes", kind: "file" },
]

const meta = {
  title: "Components/Sidenav/Sidebar",
  parameters: {
    layout: "fullscreen",
    fullWidth: true,
  },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <SidebarProvider className="h-screen min-h-0 overflow-hidden bg-[var(--token-colors-background-default)] text-[var(--token-colors-foreground-primary)]">
      <Sidebar
        collapsible="none"
        style={{ width: 280, flexShrink: 0 }}
        className="gap-[var(--token-dimension-spacing-16,16px)] border-r border-[var(--token-colors-border-primary)] !bg-[var(--token-overlay-backdrop-overlay-backdrop-light,rgba(108,113,128,0.05))] p-[var(--token-dimension-spacing-12,12px)] backdrop-blur-[20px]"
      >
        <SidebarHeader className="shrink-0 gap-[var(--token-dimension-spacing-16,16px)] p-0">
          {/* Top inline vault dropdown trigger */}
          <button
            type="button"
            aria-label="Select vault, current vault My writin vault"
            className="inline-flex w-fit items-center gap-[var(--token-dimension-spacing-6,6px)] rounded-[var(--token-dimension-radius-8,8px)] px-[var(--token-dimension-spacing-8,8px)] py-[var(--token-dimension-spacing-6,6px)] text-left text-[var(--token-colors-foreground-secondary)] transition-colors hover:bg-[var(--token-colors-background-muted)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)]"
          >
            <IconWrapper size="20">
              <HugeiconsIcon icon={Layers01Icon} strokeWidth={1.75} />
            </IconWrapper>
            <span className="truncate font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-14,14px)] font-[number:var(--token-typography-font-weight-medium,500)] leading-[18px] antialiased">
              My writin vault
            </span>
            <IconWrapper size="20">
              <HugeiconsIcon icon={UnfoldMoreIcon} strokeWidth={1.75} />
            </IconWrapper>
          </button>

          {/* Search trigger */}
          <button
            type="button"
            aria-label="Open search"
            className="flex h-[40px] w-full items-center gap-[var(--token-dimension-spacing-8,8px)] rounded-[var(--token-dimension-radius-10,10px)] border border-[var(--token-colors-border-secondary)] bg-[var(--token-colors-background-default)] px-[var(--token-dimension-spacing-10,10px)] text-left transition-colors hover:bg-[var(--token-colors-background-quiet)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--token-focus-ring-default-inner),0_0_1px_3px_var(--token-focus-ring-default-outer)]"
          >
            <IconWrapper size="20" className="text-[var(--token-colors-foreground-secondary)]">
              <HugeiconsIcon icon={Search01Icon} strokeWidth={1.75} />
            </IconWrapper>
            <span className="min-w-0 flex-1 font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-14,14px)] font-[number:var(--token-typography-font-weight-regular,400)] leading-[18px] text-[var(--token-colors-foreground-muted)] antialiased">
              Search
            </span>
            <TrailingContent type="kbd" size="sm" label="⌘K" />
          </button>

          {/* Primary nav items */}
          <div className="flex w-full flex-col gap-[var(--token-dimension-spacing-4,4px)]">
            <NavItem
              to="#recent"
              label="Recent"
              active
              icon={<HugeiconsIcon icon={Clock01Icon} strokeWidth={1.75} />}
            />
            <NavItem
              to="#library"
              label="Library"
              icon={<HugeiconsIcon icon={LibraryIcon} strokeWidth={1.75} />}
            />
          </div>
        </SidebarHeader>

        <SidebarContent className="min-h-0 flex-1 gap-0 overflow-y-auto">
          <NavGroup
            title="Your favorites"
            actionLabel="See all"
            onActionClick={() => {}}
            showSeparator={false}
          >
            {FAVORITE_ITEMS.map((item, idx) => (
              <NavItem
                key={`${item.label}-${idx}`}
                to={`#fav-${idx}`}
                label={item.label}
                icon={
                  item.kind === "folder" ? (
                    <FolderIllustration
                      size="xs"
                      folderStyle={item.folderStyle ?? "grey"}
                      variant={item.variant ?? "subtle"}
                      aria-hidden="true"
                    />
                  ) : (
                    <HugeiconsIcon icon={File01Icon} strokeWidth={1.75} />
                  )
                }
              />
            ))}
          </NavGroup>
        </SidebarContent>

        <SidebarFooter className="shrink-0 gap-[var(--token-dimension-spacing-16,16px)] p-0">
          <div className="flex w-full flex-col gap-[var(--token-dimension-spacing-4,4px)]">
            <NavItem
              to="#trash"
              label="Trash"
              icon={<HugeiconsIcon icon={Delete03Icon} strokeWidth={1.75} />}
            />
            <NavItem
              to="#support"
              label="Support & help"
              icon={<HugeiconsIcon icon={HelpSquareIcon} strokeWidth={1.75} />}
            />
          </div>

          {/* Account card */}
          <div className="flex h-[46px] w-full items-center gap-[var(--token-dimension-spacing-8,8px)] rounded-[var(--token-dimension-radius-12,12px)] border border-[var(--token-colors-border-secondary)] bg-[var(--token-colors-background-default)] px-[var(--token-dimension-spacing-8,8px)] py-[var(--token-dimension-spacing-6,6px)]">
            <Avatar size="sm" className="size-[32px] shrink-0 border border-[var(--token-colors-border-primary)] bg-[var(--token-colors-background-quiet)]">
              <AvatarFallback
                size="sm"
                initials="MS"
                className="font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-14,14px)] font-[number:var(--token-typography-font-weight-semibold,600)] leading-[18px] text-[var(--token-colors-foreground-secondary)]"
              />
              <AvatarBadge className="size-[12px] border border-[var(--token-graphite-neutral-0,#ffffff)] bg-[var(--token-colors-foreground-success,#1c824c)] text-white [&>svg]:size-[8px]">
                <HugeiconsIcon icon={CloudSavingDone01Icon} strokeWidth={2} />
              </AvatarBadge>
            </Avatar>

            <div className="flex min-w-0 flex-1 flex-col gap-[var(--token-dimension-spacing-2,2px)]">
              <p className="truncate font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-12,12px)] font-[number:var(--token-typography-font-weight-medium,500)] leading-[var(--token-typography-line-height-16,16px)] text-[var(--token-colors-foreground-primary)] antialiased">
                Mohsin Ali Sayyed
              </p>
              <p className="truncate font-[family-name:var(--token-typography-font-family-primary)] text-[length:var(--token-typography-font-size-10,10px)] font-[number:var(--token-typography-font-weight-regular,400)] leading-[14px] text-[var(--token-colors-foreground-subtle)] antialiased">
                Synced to cloud
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Open account menu"
              className="shrink-0 text-[var(--token-colors-foreground-secondary)]"
            >
              <HugeiconsIcon icon={UnfoldMoreIcon} size={16} strokeWidth={1.75} />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 flex-1 bg-[var(--token-colors-background-default)] p-8">
        <h1 className="font-[family-name:var(--token-typography-font-family-primary)] text-2xl font-semibold text-[var(--token-colors-foreground-primary)]">
          Sidebar composition
        </h1>
        <p className="mt-2 font-[family-name:var(--token-typography-font-family-primary)] text-sm text-[var(--token-colors-foreground-secondary)]">
          Full Writin sidebar composed with NavGroup, NavItem, TrailingContent, FolderIllustration, Avatar, and updated graphite neutral tokens.
        </p>
      </SidebarInset>
    </SidebarProvider>
  ),
}
