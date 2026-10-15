import {
  ArrowPathIcon,
  Bars3Icon,
  BookOpenIcon,
  CheckIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

import { AppButton } from '@/components/common/AppButton'
import { ConfirmationModal } from '@/components/common/ConfirmationModal'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { IconButton } from '@/components/common/IconButton'
import { LoadingState } from '@/components/common/LoadingState'
import { MobileBottomSheet } from '@/components/common/MobileBottomSheet'
import { PageHeader } from '@/components/common/PageHeader'
import { PagePlaceholder } from '@/components/common/PagePlaceholder'
import { SearchInput } from '@/components/common/SearchInput'
import { SyncStatusBadge } from '@/components/common/SyncStatusBadge'
import { MobileBottomNavigation } from '@/components/layout/MobileBottomNavigation'
import { CreateItemDrawer } from '@/components/files/CreateItemDrawer'
import { DeleteFileDialog } from '@/components/files/DeleteFileDialog'
import { DeleteFolderDialog } from '@/components/files/DeleteFolderDialog'
import { FileActionsMenu } from '@/components/files/FileActionsMenu'
import { FileCard } from '@/components/files/FileCard'
import { FileNameDialog } from '@/components/files/FileNameDialog'
import { FolderActionsMenu } from '@/components/files/FolderActionsMenu'
import { FolderBreadcrumb } from '@/components/files/FolderBreadcrumb'
import { FolderCard } from '@/components/files/FolderCard'
import { FolderNameDialog } from '@/components/files/FolderNameDialog'
import { MoveFileMenu } from '@/components/files/MoveFileMenu'
import { TrashActionsMenu } from '@/components/files/TrashActionsMenu'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from '@/components/ui/button-group'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from '@/components/ui/combobox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DirectionProvider } from '@/components/ui/direction'
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp'
import { Input } from '@/components/ui/input'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemHeader, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Label } from '@/components/ui/label'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from '@/components/ui/menubar'
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageGroup, MessageHeader } from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '@/components/ui/native-select'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireTitle,
} from '@/components/ui/questionnaire'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toast'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const chartData = [
  { month: 'Jan', documents: 14 },
  { month: 'Feb', documents: 19 },
  { month: 'Mar', documents: 12 },
  { month: 'Apr', documents: 25 },
]

const chartConfig = {
  documents: {
    label: 'Documents',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

const cardFile = {
  id: 'file-1',
  name: 'Product brief',
  type: 'document' as const,
  content: '',
  mimeType: 'text/markdown',
  createdAt: '2026-09-13T12:00:00.000Z',
  updatedAt: '2026-09-13T12:30:00.000Z',
  driveFileId: null,
  lastSyncedAt: '2026-09-13T12:30:00.000Z',
  syncStatus: 'backed-up' as const,
  isDeleted: false,
  folderId: null,
}

const folder = {
  id: 'folder-1',
  driveFolderId: null,
  name: 'Research',
  parentId: null,
  createdAt: '2026-09-13T12:00:00.000Z',
  updatedAt: '2026-09-13T12:30:00.000Z',
  isDeleted: false,
}

export function AccordionExample() {
  return (
    <Accordion defaultValue={['sync']} multiple className="max-w-2xl">
      <AccordionItem value="sync">
        <AccordionTrigger>Sync behavior</AccordionTrigger>
        <AccordionContent>Files can stay local or be backed up to Drive with the same visual controls.</AccordionContent>
      </AccordionItem>
      <AccordionItem value="offline">
        <AccordionTrigger>Offline mode</AccordionTrigger>
        <AccordionContent>Unavailable network state keeps actions disabled while preserving local editing.</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export function AlertExample() {
  return (
    <div className="grid max-w-2xl gap-4">
      <Alert>
        <ExclamationTriangleIcon aria-hidden="true" className="size-5" />
        <AlertTitle>Backup paused</AlertTitle>
        <AlertDescription>Reconnect your Drive account to continue syncing this workspace.</AlertDescription>
        <AlertAction>
          <Button size="sm" variant="outline">Reconnect</Button>
        </AlertAction>
      </Alert>
      <Alert variant="destructive">
        <ExclamationTriangleIcon aria-hidden="true" className="size-5" />
        <AlertTitle>Upload failed</AlertTitle>
        <AlertDescription>The file was saved locally but could not be backed up.</AlertDescription>
      </Alert>
    </div>
  )
}

export function AlertDialogExample() {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="destructive" />}>Move to Trash</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move this file to Trash?</AlertDialogTitle>
          <AlertDialogDescription>The file can be restored later from Trash.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Move to Trash</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function AspectRatioExample() {
  return (
    <div className="grid max-w-3xl gap-4 md:grid-cols-2">
      <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg border border-[var(--app-border)] bg-muted">
        <div className="flex size-full items-center justify-center text-sm text-muted-foreground">16:9 preview</div>
      </AspectRatio>
      <AspectRatio ratio={4 / 3} className="overflow-hidden rounded-lg border border-[var(--app-border)] bg-muted">
        <div className="flex size-full items-center justify-center text-sm text-muted-foreground">4:3 preview</div>
      </AspectRatio>
    </div>
  )
}

export function AttachmentExample() {
  return (
    <AttachmentGroup className="max-w-4xl">
      {(['done', 'uploading', 'processing', 'error', 'idle'] as const).map((state) => (
        <Attachment key={state} state={state}>
          <AttachmentMedia>
            <PaperClipIcon aria-hidden="true" />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{state === 'done' ? 'outline.docx' : `${state}.docx`}</AttachmentTitle>
            <AttachmentDescription>{state}</AttachmentDescription>
          </AttachmentContent>
          <AttachmentActions>
            <AttachmentAction aria-label="More attachment actions">
              <EllipsisHorizontalIcon aria-hidden="true" />
            </AttachmentAction>
          </AttachmentActions>
        </Attachment>
      ))}
    </AttachmentGroup>
  )
}

export function AvatarExample() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <Avatar>
        <AvatarImage src="/pwa-192.svg" alt="Writin workspace" />
        <AvatarFallback>MB</AvatarFallback>
        <AvatarBadge />
      </Avatar>
      <AvatarGroup>
        <Avatar><AvatarFallback>AL</AvatarFallback></Avatar>
        <Avatar><AvatarFallback>RS</AvatarFallback></Avatar>
        <Avatar><AvatarFallback>MK</AvatarFallback></Avatar>
        <AvatarGroupCount>+4</AvatarGroupCount>
      </AvatarGroup>
    </div>
  )
}

export function BadgeExample() {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
    </div>
  )
}

export function BreadcrumbExample() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem><BreadcrumbLink href="#">Writin</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbLink href="#">Projects</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbPage>Launch notes</BreadcrumbPage></BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export function BubbleExample() {
  return (
    <BubbleGroup className="max-w-2xl">
      <Bubble><BubbleContent>Draft saved locally.</BubbleContent></Bubble>
      <Bubble variant="secondary" align="end">
        <BubbleContent>Back it up to Drive when I reconnect.</BubbleContent>
        <BubbleReactions><CheckIcon aria-hidden="true" className="size-3" /></BubbleReactions>
      </Bubble>
      <Bubble variant="muted"><BubbleContent>Muted system message.</BubbleContent></Bubble>
      <Bubble variant="destructive"><BubbleContent>Sync failed. Try again later.</BubbleContent></Bubble>
    </BubbleGroup>
  )
}

export function ButtonExample() {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="xs">Extra small</Button>
        <Button size="sm">Small</Button>
        <Button>Default</Button>
        <Button size="lg">Large</Button>
        <Button aria-label="More actions" size="icon"><EllipsisHorizontalIcon aria-hidden="true" className="size-4" /></Button>
      </div>
    </div>
  )
}

export function ButtonGroupExample() {
  return (
    <ButtonGroup>
      <ButtonGroupText>View</ButtonGroupText>
      <Button variant="outline">Grid</Button>
      <ButtonGroupSeparator />
      <Button variant="outline">List</Button>
    </ButtonGroup>
  )
}

export function CalendarExample() {
  return (
    <div className="w-fit rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-3">
      <Calendar mode="single" selected={new Date(2026, 8, 13)} />
    </div>
  )
}

export function CardExample() {
  return (
    <div className="grid max-w-3xl gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Reading notes</CardTitle>
          <CardDescription>Edited 12 minutes ago</CardDescription>
          <CardAction><Button aria-label="More actions" size="icon" variant="ghost"><EllipsisHorizontalIcon aria-hidden="true" className="size-4" /></Button></CardAction>
        </CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">A compact surface for reusable content previews.</p></CardContent>
        <CardFooter><Badge variant="secondary">Document</Badge></CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  )
}

export function CarouselExample() {
  return (
    <Carousel className="mx-12 max-w-lg">
      <CarouselContent>
        {[1, 2, 3].map((item) => (
          <CarouselItem key={item}>
            <div className="flex aspect-video items-center justify-center rounded-lg border border-[var(--app-border)] bg-muted text-2xl font-semibold">
              {item}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  )
}

export function ChartExample() {
  return (
    <div className="max-w-2xl rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <ChartContainer config={chartConfig} className="min-h-64">
        <BarChart accessibilityLayer data={chartData}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="documents" fill="var(--color-documents)" radius={6} />
        </BarChart>
      </ChartContainer>
    </div>
  )
}

export function CheckboxExample() {
  const [checked, setChecked] = useState(true)

  return (
    <div className="grid gap-4">
      <Label className="flex items-center gap-3">
        <Checkbox checked={checked} onCheckedChange={(value) => setChecked(Boolean(value))} />
        <span>Back up this file to Drive</span>
      </Label>
      <Label className="flex items-center gap-3 text-muted-foreground">
        <Checkbox disabled />
        <span>Disabled option</span>
      </Label>
    </div>
  )
}

export function CollapsibleExample() {
  return (
    <Collapsible defaultOpen className="max-w-xl">
      <CollapsibleTrigger render={<Button variant="outline" />}>Toggle details</CollapsibleTrigger>
      <CollapsibleContent className="mt-3 rounded-lg border border-[var(--app-border)] p-4 text-sm text-muted-foreground">
        Collapsible content keeps secondary information available without taking over the page.
      </CollapsibleContent>
    </Collapsible>
  )
}

export function ComboboxExample() {
  return (
    <div className="max-w-sm">
      <Combobox defaultValue="document" items={['document', 'spreadsheet', 'folder']}>
        <ComboboxInput placeholder="Choose type" />
        <ComboboxContent>
          <ComboboxList>
            <ComboboxLabel>Types</ComboboxLabel>
            <ComboboxItem value="document">Document</ComboboxItem>
            <ComboboxItem value="spreadsheet">Spreadsheet</ComboboxItem>
            <ComboboxItem value="folder">Folder</ComboboxItem>
            <ComboboxEmpty>No matching type.</ComboboxEmpty>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}

export function CommandExample() {
  return (
    <Command className="max-w-xl border border-[var(--app-border)]">
      <CommandInput placeholder="Search commands..." />
      <CommandList>
        <CommandEmpty>No command found.</CommandEmpty>
        <CommandGroup heading="Files">
          <CommandItem>New document<CommandShortcut>Cmd N</CommandShortcut></CommandItem>
          <CommandItem>Search library<CommandShortcut>Cmd K</CommandShortcut></CommandItem>
          <CommandItem disabled>Sync Drive folder</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

export function ContextMenuExample() {
  return (
    <ContextMenu>
      <ContextMenuTrigger className="flex min-h-28 min-w-72 items-center justify-center rounded-lg border border-dashed border-[var(--app-border)] text-sm text-muted-foreground">
        Right click this surface
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem>Open</ContextMenuItem>
        <ContextMenuItem>Rename</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">Move to Trash</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function DataTableExample() {
  return (
    <div className="max-w-3xl rounded-lg border border-[var(--app-border)]">
      <Table>
        <TableCaption>Recent Writin documents.</TableCaption>
        <TableHeader>
          <TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          <TableRow><TableCell>Product brief</TableCell><TableCell>Document</TableCell><TableCell>Synced</TableCell></TableRow>
          <TableRow><TableCell>Annual plan</TableCell><TableCell>Spreadsheet</TableCell><TableCell>Local</TableCell></TableRow>
          <TableRow><TableCell>Research index</TableCell><TableCell>Folder</TableCell><TableCell>Shared</TableCell></TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

export function DatePickerExample() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>Pick date</PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={new Date(2026, 8, 13)} />
      </PopoverContent>
    </Popover>
  )
}

export function DialogExample() {
  return (
    <Dialog>
      <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename file</DialogTitle>
          <DialogDescription>Update the display name without changing the file contents.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DirectionExample() {
  return (
    <div className="grid max-w-2xl gap-4 md:grid-cols-2">
      <DirectionProvider direction="ltr">
        <div className="rounded-lg border border-[var(--app-border)] p-4 text-sm">LTR layout direction</div>
      </DirectionProvider>
      <DirectionProvider direction="rtl">
        <div className="rounded-lg border border-[var(--app-border)] p-4 text-right text-sm">RTL layout direction</div>
      </DirectionProvider>
    </div>
  )
}

export function DrawerExample() {
  return (
    <Drawer>
      <DrawerTrigger render={<Button variant="outline" />}>Open drawer</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Create new</DrawerTitle>
          <DrawerDescription>Choose the kind of item to add to your workspace.</DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-2 px-4">
          <Button variant="secondary">Document</Button>
          <Button variant="secondary">Spreadsheet</Button>
          <Button variant="secondary">Folder</Button>
        </div>
        <DrawerFooter><DrawerClose render={<Button variant="outline" />}>Cancel</DrawerClose></DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export function DropdownMenuExample() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <EllipsisHorizontalIcon aria-hidden="true" className="size-4" />
        File actions
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Document</DropdownMenuLabel>
        <DropdownMenuItem><PencilSquareIcon aria-hidden="true" className="size-4" />Rename</DropdownMenuItem>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive"><TrashIcon aria-hidden="true" className="size-4" />Move to Trash</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function EmptyExample() {
  return (
    <Empty className="max-w-xl border">
      <EmptyHeader>
        <EmptyMedia variant="icon"><DocumentTextIcon aria-hidden="true" /></EmptyMedia>
        <EmptyTitle>No documents found</EmptyTitle>
        <EmptyDescription>Try another search term or create a new document.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent><Button>Create document</Button></EmptyContent>
    </Empty>
  )
}

export function FieldExample() {
  return (
    <FieldSet className="max-w-2xl">
      <FieldLegend>Document settings</FieldLegend>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="field-title">Name</FieldLabel>
          <Input id="field-title" placeholder="Untitled document" />
          <FieldDescription>Shown in the file list and editor header.</FieldDescription>
        </Field>
        <Field orientation="horizontal" data-invalid="true">
          <FieldContent>
            <FieldTitle>Required title</FieldTitle>
            <FieldDescription>Validation messages use FieldError.</FieldDescription>
            <FieldError>Enter a document title.</FieldError>
          </FieldContent>
        </Field>
      </FieldGroup>
    </FieldSet>
  )
}

export function HoverCardExample() {
  return (
    <HoverCard>
      <HoverCardTrigger render={<Button variant="link" />}>Hover workspace</HoverCardTrigger>
      <HoverCardContent className="w-72">
        <p className="text-sm font-medium">Writin workspace</p>
        <p className="mt-1 text-sm text-muted-foreground">A quiet place for local and Drive-backed files.</p>
      </HoverCardContent>
    </HoverCard>
  )
}

export function InputExample() {
  return (
    <div className="grid max-w-md gap-4">
      <Input placeholder="Untitled document" />
      <Input value="Read-only workspace" disabled />
      <Input aria-invalid placeholder="Invalid title" />
    </div>
  )
}

export function InputGroupExample() {
  return (
    <div className="grid max-w-2xl gap-4">
      <InputGroup>
        <InputGroupAddon><MagnifyingGlassIcon aria-hidden="true" className="size-4" /></InputGroupAddon>
        <InputGroupInput placeholder="Search or name a file" />
        <InputGroupAddon align="inline-end"><InputGroupButton>Find</InputGroupButton></InputGroupAddon>
      </InputGroup>
      <InputGroup>
        <InputGroupAddon align="block-start"><InputGroupText>Summary</InputGroupText></InputGroupAddon>
        <InputGroupTextarea placeholder="Add a longer note..." />
      </InputGroup>
    </div>
  )
}

export function InputOTPExample() {
  return (
    <InputOTP maxLength={6} defaultValue="123456" aria-label="One-time passcode">
      <InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /></InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup>
    </InputOTP>
  )
}

export function ItemExample() {
  return (
    <ItemGroup className="max-w-2xl">
      <ItemHeader>Recent</ItemHeader>
      <Item variant="outline">
        <ItemMedia variant="icon"><DocumentTextIcon aria-hidden="true" className="size-5 text-primary" /></ItemMedia>
        <ItemContent>
          <ItemTitle>Chapter outline</ItemTitle>
          <ItemDescription>Updated just now with local changes.</ItemDescription>
        </ItemContent>
        <ItemActions><Badge variant="secondary">Local</Badge></ItemActions>
      </Item>
      <ItemSeparator />
      <Item variant="muted" size="sm">
        <ItemContent>
          <ItemTitle>Research notes</ItemTitle>
          <ItemDescription>Long descriptions wrap and clamp without expanding the row unexpectedly.</ItemDescription>
        </ItemContent>
      </Item>
    </ItemGroup>
  )
}

export function KbdExample() {
  return <KbdGroup><Kbd>Cmd</Kbd><Kbd>K</Kbd></KbdGroup>
}

export function LabelExample() {
  return (
    <div className="grid max-w-md gap-2">
      <Label htmlFor="label-demo">Document title</Label>
      <Input id="label-demo" placeholder="Untitled document" />
    </div>
  )
}

export function MarkerExample() {
  return (
    <div className="grid max-w-xl gap-4">
      <Marker variant="separator"><MarkerContent>Today</MarkerContent></Marker>
      <Marker variant="border">
        <MarkerIcon><DocumentTextIcon aria-hidden="true" /></MarkerIcon>
        <MarkerContent>Document metadata marker</MarkerContent>
      </Marker>
    </div>
  )
}

export function MenubarExample() {
  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem>New document<MenubarShortcut>Cmd N</MenubarShortcut></MenubarItem>
          <MenubarItem>Duplicate</MenubarItem>
          <MenubarSeparator />
          <MenubarItem variant="destructive">Move to Trash</MenubarItem>
        </MenubarContent>
      </MenubarMenu>
      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent><MenubarItem>Recent</MenubarItem><MenubarItem>Favorites</MenubarItem></MenubarContent>
      </MenubarMenu>
    </Menubar>
  )
}

export function MessageExample() {
  return (
    <MessageGroup className="max-w-2xl">
      <Message>
        <MessageAvatar><Avatar><AvatarFallback>MB</AvatarFallback></Avatar></MessageAvatar>
        <MessageContent>
          <MessageHeader>Writin</MessageHeader>
          <Bubble variant="muted"><BubbleContent>Your document is ready.</BubbleContent></Bubble>
          <MessageFooter>Just now</MessageFooter>
        </MessageContent>
      </Message>
      <Message align="end"><MessageContent><Bubble align="end"><BubbleContent>Open it in the editor.</BubbleContent></Bubble></MessageContent></Message>
    </MessageGroup>
  )
}

export function MessageScrollerExample() {
  return (
    <MessageScrollerProvider>
      <MessageScroller className="h-64 max-w-2xl rounded-lg border border-[var(--app-border)]">
        <MessageScrollerViewport>
          <MessageScrollerContent>
            {Array.from({ length: 10 }, (_, index) => (
              <MessageScrollerItem key={index}>
                <Bubble variant={index % 2 ? 'secondary' : 'muted'}>
                  <BubbleContent>Scrollable message {index + 1}</BubbleContent>
                </Bubble>
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

export function NativeSelectExample() {
  return (
    <div className="flex flex-wrap gap-3">
      <NativeSelect defaultValue="document" aria-label="File type">
        <NativeSelectOptGroup label="Files">
          <NativeSelectOption value="document">Document</NativeSelectOption>
          <NativeSelectOption value="spreadsheet">Spreadsheet</NativeSelectOption>
        </NativeSelectOptGroup>
        <NativeSelectOption value="folder">Folder</NativeSelectOption>
      </NativeSelect>
      <NativeSelect size="sm" defaultValue="compact" aria-label="Density">
        <NativeSelectOption value="compact">Compact</NativeSelectOption>
        <NativeSelectOption value="comfortable">Comfortable</NativeSelectOption>
      </NativeSelect>
    </div>
  )
}

export function NavigationMenuExample() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Workspace</NavigationMenuTrigger>
          <NavigationMenuContent className="w-64">
            <NavigationMenuLink href="#">Recent files</NavigationMenuLink>
            <NavigationMenuLink href="#">Favorites</NavigationMenuLink>
            <NavigationMenuLink href="#">Trash</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem><NavigationMenuLink href="#">Settings</NavigationMenuLink></NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  )
}

export function PaginationExample() {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
        <PaginationItem><PaginationLink href="#" isActive>1</PaginationLink></PaginationItem>
        <PaginationItem><PaginationLink href="#">2</PaginationLink></PaginationItem>
        <PaginationItem><PaginationEllipsis /></PaginationItem>
        <PaginationItem><PaginationNext href="#" /></PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

export function PopoverExample() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>Workspace details</PopoverTrigger>
      <PopoverContent className="w-72">
        <PopoverHeader>
          <PopoverTitle>Local workspace</PopoverTitle>
          <PopoverDescription>Files stay on this device unless Drive backup is enabled.</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}

export function ProgressExample() {
  return (
    <div className="max-w-xl">
      <Progress value={68}>
        <ProgressLabel>Storage used</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  )
}

export function QuestionnaireExample() {
  return (
    <Questionnaire className="max-w-xl">
      <QuestionnaireProgress>Step 1 of 3</QuestionnaireProgress>
      <QuestionnaireItem name="workspace">
        <QuestionnaireTitle>Where should new files be created?</QuestionnaireTitle>
        <QuestionnaireDescription>Select the default location for this workspace.</QuestionnaireDescription>
        <QuestionnaireChoices>
          <QuestionnaireChoice value="local">
            Local workspace
            <QuestionnaireChoiceDescription>Keep documents on this device.</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
          <QuestionnaireChoice value="drive">
            Drive backup
            <QuestionnaireChoiceDescription>Back up documents to Google Drive.</QuestionnaireChoiceDescription>
          </QuestionnaireChoice>
        </QuestionnaireChoices>
      </QuestionnaireItem>
      <QuestionnaireActions><QuestionnairePrevious /><QuestionnaireNext /></QuestionnaireActions>
    </Questionnaire>
  )
}

export function RadioGroupExample() {
  return (
    <RadioGroup defaultValue="local" aria-label="Workspace mode" className="grid gap-3">
      <Label className="flex items-center gap-3"><RadioGroupItem value="local" /><span>Local workspace</span></Label>
      <Label className="flex items-center gap-3"><RadioGroupItem value="drive" /><span>Google Drive workspace</span></Label>
      <Label className="flex items-center gap-3 text-muted-foreground"><RadioGroupItem value="team" disabled /><span>Team workspace unavailable</span></Label>
    </RadioGroup>
  )
}

export function ResizableExample() {
  return (
    <div className="h-64 max-w-3xl rounded-lg border border-[var(--app-border)]">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={35}><div className="flex h-full items-center justify-center bg-muted text-sm">Sidebar</div></ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={65}><div className="flex h-full items-center justify-center text-sm">Content</div></ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

export function ScrollAreaExample() {
  return (
    <ScrollArea className="h-52 max-w-md rounded-lg border border-[var(--app-border)] p-4">
      <div className="space-y-3">
        {Array.from({ length: 16 }, (_, index) => (
          <p key={index} className="text-sm text-muted-foreground">Scrollable note row {index + 1}</p>
        ))}
      </div>
    </ScrollArea>
  )
}

export function SelectExample() {
  return (
    <Select defaultValue="document" aria-label="File type">
      <SelectTrigger className="w-56"><SelectValue placeholder="Choose a type" /></SelectTrigger>
      <SelectContent>
        <SelectLabel>File type</SelectLabel>
        <SelectItem value="document">Document</SelectItem>
        <SelectItem value="spreadsheet">Spreadsheet</SelectItem>
        <SelectItem value="folder">Folder</SelectItem>
      </SelectContent>
    </Select>
  )
}

export function SeparatorExample() {
  return (
    <div className="max-w-md space-y-4">
      <div className="flex h-10 items-center gap-3">
        <Button variant="ghost">Recent</Button>
        <Separator orientation="vertical" />
        <Button variant="ghost">Favorites</Button>
      </div>
      <Separator />
      <p className="text-sm text-muted-foreground">Horizontal and vertical separators use shared border tokens.</p>
    </div>
  )
}

export function SheetExample() {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>Open sheet</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>File details</SheetTitle>
          <SheetDescription>Review metadata and available actions for this file.</SheetDescription>
        </SheetHeader>
        <SheetFooter><SheetClose render={<Button />}>Done</SheetClose></SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function SidebarExample() {
  return (
    <DirectionProvider direction="ltr">
      <div className="h-[32rem] overflow-hidden rounded-lg border border-[var(--app-border)]">
        <SidebarProvider className="h-full">
          <Sidebar side="left" collapsible="icon">
            <SidebarHeader>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<NavLink to="/home" />} size="lg" tooltip="Workspace">
                    <BookOpenIcon aria-hidden="true" className="size-5 text-sidebar-primary" />
                    <span className="font-semibold">Workspace</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/home" />} isActive tooltip="Dashboard"><DocumentTextIcon aria-hidden="true" className="size-4" /><span>Dashboard</span></SidebarMenuButton></SidebarMenuItem>
                    <SidebarMenuItem><SidebarMenuButton render={<NavLink to="/folders" />} tooltip="Library"><FolderIcon aria-hidden="true" className="size-4" /><span>Library</span></SidebarMenuButton></SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
              <SidebarMenu><SidebarMenuItem><SidebarMenuButton tooltip="Menu"><Bars3Icon aria-hidden="true" className="size-4" /><span>Menu</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
          </Sidebar>
          <SidebarInset className="bg-background p-4">
            <SidebarTrigger />
            <div className="mt-6 rounded-lg border border-[var(--app-border)] p-6 text-sm text-muted-foreground">Sidebar inset content</div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </DirectionProvider>
  )
}

export function SkeletonExample() {
  return (
    <div className="max-w-md space-y-3">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}

export function SliderExample() {
  return (
    <div className="grid max-w-md gap-3">
      <Label id="story-density">Editor density</Label>
      <Slider aria-labelledby="story-density" defaultValue={[45]} max={100} step={5} />
    </div>
  )
}

export function SpinnerExample() {
  return <div className="flex flex-wrap items-center gap-4"><Spinner className="size-3" /><Spinner /><Spinner className="size-6" /></div>
}

export function SwitchExample() {
  const [enabled, setEnabled] = useState(false)

  return (
    <Label className="flex items-center gap-3">
      <Switch checked={enabled} onCheckedChange={setEnabled} />
      <span>Show editor helpers</span>
    </Label>
  )
}

export function TableExample() {
  return (
    <Table className="max-w-3xl">
      <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
      <TableBody>
        <TableRow><TableCell>Product brief</TableCell><TableCell>Document</TableCell><TableCell>Synced</TableCell></TableRow>
        <TableRow><TableCell>Annual plan</TableCell><TableCell>Spreadsheet</TableCell><TableCell>Local</TableCell></TableRow>
      </TableBody>
    </Table>
  )
}

export function TabsExample() {
  return (
    <Tabs defaultValue="recent" className="max-w-2xl">
      <TabsList aria-label="File views">
        <TabsTrigger value="recent">Recent</TabsTrigger>
        <TabsTrigger value="favorites">Favorites</TabsTrigger>
        <TabsTrigger value="folders">Folders</TabsTrigger>
      </TabsList>
      <TabsContent value="recent">Recently edited documents appear here.</TabsContent>
      <TabsContent value="favorites">Favorite files and folders appear here.</TabsContent>
      <TabsContent value="folders">Folder browsing appears here.</TabsContent>
    </Tabs>
  )
}

export function TextareaExample() {
  return <Textarea className="max-w-md" placeholder="Capture a thought..." />
}

export function ToastExample() {
  return (
    <Button
      onClick={() => toast.add({
        title: 'Document saved',
        description: 'Your local changes are ready.',
        type: 'success',
      })}
    >
      Show toast
    </Button>
  )
}

export function ToggleExample() {
  return <div className="flex flex-wrap gap-3"><Toggle aria-label="Toggle bold">B</Toggle><Toggle variant="outline" aria-label="Toggle italic">I</Toggle></div>
}

export function ToggleGroupExample() {
  return (
    <ToggleGroup defaultValue={['list']} aria-label="Editor tools">
      <ToggleGroupItem value="list">List</ToggleGroupItem>
      <ToggleGroupItem value="quote">Quote</ToggleGroupItem>
      <ToggleGroupItem value="code">Code</ToggleGroupItem>
    </ToggleGroup>
  )
}

export function TooltipExample() {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button aria-label="More file actions" size="icon" variant="ghost" />}>
        <EllipsisHorizontalIcon aria-hidden="true" className="size-4" />
      </TooltipTrigger>
      <TooltipContent>More file actions</TooltipContent>
    </Tooltip>
  )
}

export function TypographyExample() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-4xl font-semibold tracking-normal">Display heading</h1>
      <h2 className="text-2xl font-semibold tracking-normal">Section heading</h2>
      <p className="text-base text-muted-foreground">Body copy uses the app typography scale and semantic text colors.</p>
      <blockquote className="border-l-2 pl-4 text-sm text-muted-foreground">Readable long-form text for documents and design documentation.</blockquote>
    </div>
  )
}

export function AppButtonExample() {
  return (
    <div className="grid max-w-sm gap-3">
      <AppButton><PlusIcon aria-hidden="true" className="size-5" />New document</AppButton>
      <AppButton variant="secondary" isLoading loadingLabel="Saving...">Save</AppButton>
      <AppButton variant="outline" isDisabled>Disabled</AppButton>
      <AppButton fullWidth variant="ghost"><ArrowPathIcon aria-hidden="true" className="size-5" />Full width action</AppButton>
    </div>
  )
}

export function AppCommonExample() {
  const [query, setQuery] = useState('chapter outline')

  return (
    <div className="grid max-w-3xl gap-6">
      <PageHeader
        eyebrow="Library"
        title="Recent files"
        description="Continue writing, editing, and organizing your workspace."
        leading={<BookOpenIcon aria-hidden="true" className="mt-1 size-7 text-primary" />}
        actions={<><IconButton label="More page actions" variant="ghost"><EllipsisHorizontalIcon aria-hidden="true" className="size-5" /></IconButton><AppButton><PlusIcon aria-hidden="true" className="size-5" />New file</AppButton></>}
      />
      <SearchInput label="Search files" placeholder="Search files and folders" value={query} onChange={setQuery} />
      <div className="flex flex-wrap gap-2">
        <SyncStatusBadge status="local" />
        <SyncStatusBadge status="backing-up" />
        <SyncStatusBadge status="backed-up" />
        <SyncStatusBadge status="failed" />
        <SyncStatusBadge status="offline" />
      </div>
    </div>
  )
}

export function AppFeedbackExample() {
  return (
    <div className="grid max-w-3xl gap-6">
      <EmptyState title="No notes yet" description="Create a note to capture your first idea." action={<AppButton>Create note</AppButton>} />
      <LoadingState rows={2} />
      <ErrorState message="We could not load your recent files." action={<AppButton variant="secondary"><ArrowPathIcon aria-hidden="true" className="size-5" />Try again</AppButton>} />
      <PagePlaceholder icon={BookOpenIcon} title="Workspace coming soon" description="This placeholder keeps secondary views calm while the feature is being prepared." />
    </div>
  )
}

export function AppFilesExample() {
  return (
    <div className="grid max-w-4xl gap-6">
      <FolderBreadcrumb folders={[folder]} currentFolderId="folder-1" onNavigate={() => undefined} />
      <div className="grid gap-4 md:grid-cols-2">
        <FileCard
          name={cardFile.name}
          meta="Document - backed up"
          type={cardFile.type}
          syncStatus="backed-up"
          onOpen={() => undefined}
          action={<FileActionsMenu fileName={cardFile.name} folders={[folder]} currentFolderId={null} onRename={() => undefined} onDuplicate={() => undefined} onMove={() => Promise.resolve({ success: true })} onCreateFolder={async (name, parentId) => ({ success: true, data: { ...folder, id: `created-${name}`, name, parentId } })} onDelete={() => undefined} />}
        />
        <FolderCard
          name={folder.name}
          fileCount={3}
          folderCount={1}
          onOpen={() => undefined}
          action={<FolderActionsMenu folderName={folder.name} folders={[folder]} folderId={folder.id} currentParentId={null} onRename={() => undefined} onMove={() => Promise.resolve({ success: true })} onCreateFolder={async (name, parentId) => ({ success: true, data: { ...folder, id: `created-${name}`, name, parentId } })} onDelete={() => undefined} />}
        />
      </div>
      <MoveFileMenu fileName={cardFile.name} folders={[folder]} currentFolderId={null} onMove={() => Promise.resolve({ success: true })} onCreateFolder={async (name, parentId) => ({ success: true, data: { ...folder, id: `created-${name}`, name, parentId } })} />
      <TrashActionsMenu fileName={cardFile.name} onRestore={() => undefined} onDelete={() => undefined} />
    </div>
  )
}

export function AppDialogsExample() {
  const [dialog, setDialog] = useState<'file-name' | 'folder-name' | 'delete-file' | 'delete-folder' | null>(null)
  const close = () => setDialog(null)
  const success = async () => ({ success: true })

  return (
    <div className="flex flex-wrap gap-3">
      <MobileBottomSheet trigger="Open file actions" triggerClassName="border border-[var(--app-border)] px-4" title="File actions" footer={<AppButton fullWidth>Done</AppButton>}>
        <div className="space-y-2">
          <button type="button" className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium hover:bg-muted">Rename</button>
          <button type="button" className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium hover:bg-muted">Move</button>
          <button type="button" className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-medium text-destructive hover:bg-destructive/10">Move to Trash</button>
        </div>
      </MobileBottomSheet>
      <CreateItemDrawer folderId={null} onCreateFolder={() => undefined} />
      <ConfirmationModal trigger={<AppButton variant="danger"><TrashIcon aria-hidden="true" className="size-5" />Delete file</AppButton>} title="Delete this file?" description="This action cannot be undone. The file will be permanently removed." confirmLabel="Delete" onConfirm={() => undefined} />
      <AppButton variant="secondary" onPress={() => setDialog('file-name')}>Rename file</AppButton>
      <AppButton variant="secondary" onPress={() => setDialog('folder-name')}>Rename folder</AppButton>
      <AppButton variant="danger" onPress={() => setDialog('delete-file')}>Delete file</AppButton>
      <AppButton variant="danger" onPress={() => setDialog('delete-folder')}>Delete folder</AppButton>
      <FileNameDialog fileName="Product brief" isOpen={dialog === 'file-name'} onClose={close} onSubmit={success} />
      <FolderNameDialog isOpen={dialog === 'folder-name'} title="Rename folder" submitLabel="Save" initialName="Research" existingFolderNames={['Archive']} onClose={close} onSubmit={success} />
      <DeleteFileDialog isOpen={dialog === 'delete-file'} fileName="Product brief" onClose={close} onConfirm={close} />
      <DeleteFolderDialog isOpen={dialog === 'delete-folder'} folderName="Research" hasContents onClose={close} onConfirm={close} />
    </div>
  )
}

export function MobileBottomNavigationExample() {
  return (
    <div className="max-w-sm border border-[var(--app-border)] bg-background pt-6">
      <MobileBottomNavigation />
    </div>
  )
}
