import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  Bars3Icon,
  BoltIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleStackIcon,
  CloudArrowUpIcon,
  CommandLineIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  DocumentTextIcon,
  FolderOpenIcon,
  LockClosedIcon,
  MoonIcon,
  NoSymbolIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SunIcon,
  TableCellsIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { APP_VERSION } from '../config/app'
import {
  canPickDeviceDirectory,
  initializeLocalWorkspace,
  pickLocalWorkspaceDirectory,
} from '../services/localWorkspace'
import { useAppStore } from '../stores/useAppStore'
import { authApiUrl, isBackendAuthEnabled, useAuthStore } from '../stores/useAuthStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

type StudioTab = 'editor' | 'spreadsheet' | 'slash'
type PresetKey = 'notes' | 'plan' | 'sheet'

interface TaskItem {
  id: string
  text: string
  completed: boolean
}

export function AboutPage() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useAppStore()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const userEmail = useAuthStore((state) => state.email)
  const workspaceMode = useWorkspaceStore((state) => state.mode)
  const createLocalWorkspace = useWorkspaceStore((state) => state.createLocalWorkspace)

  const isUserLoggedIn = (isAuthenticated && workspaceMode === 'drive') || workspaceMode === 'local'
  const supportsDeviceFolder = useMemo(() => canPickDeviceDirectory(), [])

  // In-Page Get Started / Auth Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isCreatingLocal, setIsCreatingLocal] = useState(false)
  const [authModalError, setAuthModalError] = useState<string | null>(null)

  // Navigation
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Studio Centerpiece State
  const [activeStudioTab, setActiveStudioTab] = useState<StudioTab>('editor')
  const [activePreset, setActivePreset] = useState<PresetKey>('notes')
  const [editorText, setEditorText] = useState<string>(
    `# Project Blueprint: Writin\n\nPersonal workspace designed for absolute privacy and high speed.\n\n- [x] Fast local editor with instant offline startup\n- [ ] Multi-sheet financial and roadmap tracking\n- [x] Direct sync to private Google Drive\n\n> "Your thoughts belong to you, not a corporate database."`
  )
  const [isTyping, setIsTyping] = useState(false)

  // Interactive Checklist
  const [demoTasks, setDemoTasks] = useState<TaskItem[]>([
    { id: '1', text: 'Store notes locally in browser IndexedDB or device folder', completed: true },
    { id: '2', text: 'Zero telemetry, analytics, or server-side logging', completed: true },
    { id: '3', text: 'Sync securely to your personal Google Drive vault', completed: true },
    { id: '4', text: 'Export anytime to Markdown (.md) or Microsoft Word (.docx)', completed: false },
  ])

  // Interactive Spreadsheet State
  const [sheetRows, setSheetRows] = useState([
    { item: 'Architecture & Local DB', hours: 14, rate: 95 },
    { item: 'UniverJS Sheets Core', hours: 12, rate: 95 },
    { item: 'Google Drive Sync Sync', hours: 8, rate: 85 },
    { item: 'Keyboard Shortcuts Engine', hours: 6, rate: 85 },
  ])

  // Slash Command Interactive Palette
  const [slashPreview, setSlashPreview] = useState<string>('heading')

  // Vault Circuit Simulator
  const [isSyncingPacket, setIsSyncingPacket] = useState(false)
  const [storageModel, setStorageModel] = useState<'local' | 'drive' | 'cloud'>('local')

  // Interactive Offline Simulator
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false)

  // 3D Keyboard Simulator
  const [activeShortcut, setActiveShortcut] = useState<'search' | 'bold' | 'slash' | 'checkbox'>('search')
  const [pressedKey, setPressedKey] = useState<string | null>(null)

  // Interactive File Export Preview
  const [activeExportFormat, setActiveExportFormat] = useState<'md' | 'docx' | 'xlsx' | 'zip'>('md')

  // FAQ Accordion
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0)

  // Computed metrics
  const wordCount = useMemo(() => {
    return editorText.trim() ? editorText.trim().split(/\s+/).length : 0
  }, [editorText])

  const charCount = editorText.length

  const sheetTotal = useMemo(() => {
    return sheetRows.reduce((sum, r) => sum + r.hours * r.rate, 0)
  }, [sheetRows])

  const completedTasksCount = demoTasks.filter((t) => t.completed).length

  // Handlers
  const handlePresetSelect = (preset: PresetKey) => {
    setActivePreset(preset)
    if (preset === 'notes') {
      setActiveStudioTab('editor')
      setEditorText(
        `# Product Strategy & Architecture\n\nWritin combines the distraction-free flow of Markdown with the computational power of integrated spreadsheets.\n\n### Key Principles\n1. **Zero Proprietary Databases**: Your data is saved locally or in your Google Drive.\n2. **Universal Standards**: Seamlessly import/export Markdown, DOCX, and XLSX.\n3. **Keyboard Mastery**: Execute actions without lifting your hands from the keys.`
      )
    } else if (preset === 'plan') {
      setActiveStudioTab('editor')
      setEditorText(
        `# Weekly Execution Plan\n\n- [x] Complete local-first IndexedDB storage\n- [x] Build keyboard-driven command palette (Cmd+K)\n- [ ] Finalize dark mode contrast and accessibility\n- [ ] Ship universal export bundle (ZIP backup)\n\n> 💡 *Tip: Press Cmd+Shift+7 anywhere to convert line to checklist item.*`
      )
    } else {
      setActiveStudioTab('spreadsheet')
    }
  }

  const toggleTask = (id: string) => {
    setDemoTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
  }

  const updateSheetRow = (idx: number, field: 'hours' | 'rate', val: number) => {
    setSheetRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: Math.max(0, val) } : r))
    )
  }

  const triggerPacketSync = () => {
    setIsSyncingPacket(true)
    setTimeout(() => {
      setIsSyncingPacket(false)
    }, 1800)
  }

  const handleKeyPressSimulation = (key: string, shortcut: 'search' | 'bold' | 'slash' | 'checkbox') => {
    setPressedKey(key)
    setActiveShortcut(shortcut)
    setTimeout(() => setPressedKey(null), 250)
  }

  const handleOpenAuthModal = () => {
    setAuthModalError(null)
    setIsAuthModalOpen(true)
  }

  const handleStartInstantLocal = async () => {
    setIsCreatingLocal(true)
    setAuthModalError(null)
    try {
      await initializeLocalWorkspace({
        name: 'Writin',
        storagePreference: 'private',
        allowPrivateFallback: true,
      })
      createLocalWorkspace()
      setIsAuthModalOpen(false)
      navigate('/home')
    } catch {
      setAuthModalError('Could not initialize local storage. Please try again.')
    } finally {
      setIsCreatingLocal(false)
    }
  }

  const handlePickLocalFolder = async () => {
    setIsCreatingLocal(true)
    setAuthModalError(null)
    try {
      const directory = await pickLocalWorkspaceDirectory()
      if (!directory) {
        setIsCreatingLocal(false)
        return
      }
      await initializeLocalWorkspace({
        name: directory.name || 'Writin',
        storagePreference: 'file-system',
        directoryHandle: directory.handle,
        allowPrivateFallback: false,
      })
      createLocalWorkspace()
      setIsAuthModalOpen(false)
      navigate('/home')
    } catch {
      setAuthModalError('Folder permission was denied or cancelled.')
    } finally {
      setIsCreatingLocal(false)
    }
  }

  const handleStartGoogleLogin = () => {
    const setupReturnTo = `/login?setup=google&returnTo=%2Fhome`
    if (isBackendAuthEnabled) {
      window.location.assign(`${authApiUrl('/google/start')}?returnTo=${encodeURIComponent(setupReturnTo)}`)
    } else {
      setIsAuthModalOpen(false)
      navigate('/login')
    }
  }

  return (
    <div className="relative h-full w-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* Dynamic Background: Line Grid + Ambient Radial Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-line-grid opacity-60 dark:opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
      />

      {/* Ambient Gradient Orbs (WorkOS / Attio Glow) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed left-1/2 top-[-10rem] z-0 -translate-x-1/2 blur-3xl opacity-30 dark:opacity-40 animate-pulse-glow"
      >
        <div className="h-[520px] w-[860px] rounded-full bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400" />
      </div>

      {/* 1. Header / Navigation */}
      <header className="sticky top-0 z-50 border-b border-[var(--app-border)]/80 bg-background/75 backdrop-blur-xl transition-colors">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/about" className="group flex items-center gap-2.5 transition">
              <div className="relative flex size-8 items-center justify-center rounded-lg bg-primary/10 shadow-sm transition group-hover:scale-105">
                <img src="/pwa-192.svg" alt="Writin logo" className="size-7 rounded-md" />
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground">Writin</span>
            </Link>
            <span className="hidden rounded-full border border-[var(--app-border)] bg-muted/60 px-2 py-0.5 font-mono text-[11px] font-medium text-muted-foreground sm:inline-block">
              v{APP_VERSION}
            </span>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#interactive-studio" className="transition hover:text-foreground">
              Interactive Studio
            </a>
            <a href="#vault-architecture" className="transition hover:text-foreground">
              Architecture & Vault
            </a>
            <a href="#features-bento" className="transition hover:text-foreground">
              Feature Bento
            </a>
            <a href="#comparison" className="transition hover:text-foreground">
              Compare
            </a>
            <a href="#faq" className="transition hover:text-foreground">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              className="flex size-9 items-center justify-center rounded-lg border border-[var(--app-border)] bg-background/80 text-muted-foreground shadow-sm transition hover:bg-muted hover:text-foreground"
            >
              {theme === 'light' ? <MoonIcon className="size-4" /> : <SunIcon className="size-4 text-amber-400" />}
            </button>

            {isUserLoggedIn ? (
              <div className="flex items-center gap-2.5">
                <span className="hidden text-xs text-muted-foreground lg:inline-block font-mono">
                  {workspaceMode === 'local' ? 'Local Vault' : userEmail ?? 'Signed in'}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/home')}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md transition hover:opacity-90 sm:text-sm"
                >
                  <span>Open Workspace</span>
                  <ArrowRightIcon className="size-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAuthModal}
                  className="rounded-lg px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/80 sm:text-sm"
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={handleOpenAuthModal}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md transition hover:opacity-90 sm:text-sm"
                >
                  <span>Get Started</span>
                  <ArrowRightIcon className="size-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex size-9 items-center justify-center rounded-lg border border-[var(--app-border)] md:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <XMarkIcon className="size-5" /> : <Bars3Icon className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen ? (
          <div className="border-b border-[var(--app-border)] bg-background/95 px-4 py-4 backdrop-blur-xl md:hidden">
            <div className="grid gap-2">
              <a
                href="#interactive-studio"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Interactive Studio
              </a>
              <a
                href="#vault-architecture"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Architecture & Vault
              </a>
              <a
                href="#features-bento"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Feature Bento
              </a>
              <a
                href="#comparison"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                Compare
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                FAQ
              </a>
              <div className="mt-2 pt-3 border-t border-[var(--app-border)]">
                {isUserLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      navigate('/home')
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    <span>Open Workspace</span>
                    <ArrowRightIcon className="size-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      handleOpenAuthModal()
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    <span>Get Started Free</span>
                    <ArrowRightIcon className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {/* 2. Hero Section (WorkOS Atlas / Attio Aesthetic) */}
      <section className="relative z-10 pt-16 pb-20 sm:pt-24 sm:pb-28 lg:pt-28">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          {/* Shimmer Announcement Pill */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-foreground backdrop-blur-md shadow-sm sm:text-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-semibold text-primary">Writin Workspace</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">Zero Central Database · 100% Sovereign</span>
          </div>

          {/* Large Hero Typography */}
          <h1 className="mt-8 text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Where thoughts <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500 bg-clip-text text-transparent">flow freely</span>, and data stays yours.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg sm:leading-8">
            A minimalist, high-speed workspace uniting Markdown documents and live spreadsheets. 
            Saved directly onto your device or synced privately with your personal Google Drive. 
            No proprietary databases. No recurring monthly subscriptions.
          </p>

          {/* Hero CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
            {isUserLoggedIn ? (
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="group flex h-12 w-full items-center justify-center gap-2.5 rounded-[var(--radius-control)] bg-primary px-7 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:opacity-95 hover:shadow-xl sm:w-auto"
              >
                <span>Return to Workspace</span>
                <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenAuthModal}
                className="group flex h-12 w-full items-center justify-center gap-2.5 rounded-[var(--radius-control)] bg-primary px-7 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:opacity-95 hover:shadow-xl sm:w-auto"
              >
                <span>Get Started Free</span>
                <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
              </button>
            )}

            <a
              href="#interactive-studio"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--app-border)] bg-background/80 px-6 text-base font-semibold text-foreground backdrop-blur-sm transition hover:bg-muted sm:w-auto"
            >
              <span>Explore Interactive Studio</span>
              <CommandLineIcon className="size-4 text-muted-foreground" />
            </a>
          </div>

          {/* Floating Key Badges (Attio Style) */}
          <div className="mt-12 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <div className="flex items-center gap-2.5 rounded-xl border border-[var(--app-border)] bg-background/60 p-3 backdrop-blur-md shadow-sm transition hover:border-primary/40">
              <ShieldCheckIcon className="size-5 shrink-0 text-emerald-500" />
              <div className="text-xs font-semibold text-foreground">Zero Central Database</div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-[var(--app-border)] bg-background/60 p-3 backdrop-blur-md shadow-sm transition hover:border-primary/40">
              <BoltIcon className="size-5 shrink-0 text-amber-500" />
              <div className="text-xs font-semibold text-foreground">0ms Instant Local Launch</div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-[var(--app-border)] bg-background/60 p-3 backdrop-blur-md shadow-sm transition hover:border-primary/40">
              <CloudArrowUpIcon className="size-5 shrink-0 text-blue-500" />
              <div className="text-xs font-semibold text-foreground">Personal Google Drive Vault</div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-[var(--app-border)] bg-background/60 p-3 backdrop-blur-md shadow-sm transition hover:border-primary/40">
              <TableCellsIcon className="size-5 shrink-0 text-purple-500" />
              <div className="text-xs font-semibold text-foreground">Markdown + Live Spreadsheets</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Centerpiece: Interactive Studio (AlignUI & WorkOS Atlas Inspiration) */}
      <section id="interactive-studio" className="relative z-10 py-16 sm:py-24 border-t border-[var(--app-border)] bg-muted/15">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
              <SparklesIcon className="size-3.5" />
              <span>Interactive Live Sandbox</span>
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Experience Writin before signing in
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
              Try the distraction-free typing engine, check off tasks, test slash commands, and recalculate formulas directly in this window.
            </p>
          </div>

          {/* Mode Tabs (AlignUI Segmented Controller Style) */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] pb-4">
            <div className="inline-flex rounded-xl border border-[var(--app-border)] bg-background/80 p-1 shadow-sm backdrop-blur-md">
              <button
                type="button"
                onClick={() => setActiveStudioTab('editor')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                  activeStudioTab === 'editor'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <DocumentTextIcon className="size-4" />
                <span>Rich Document (Markdown)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStudioTab('spreadsheet')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                  activeStudioTab === 'spreadsheet'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TableCellsIcon className="size-4" />
                <span>Integrated Spreadsheet</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStudioTab('slash')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                  activeStudioTab === 'slash'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CommandLineIcon className="size-4" />
                <span>Slash Command Palette (/)</span>
              </button>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground mr-1">Sample Preset:</span>
              <button
                type="button"
                onClick={() => handlePresetSelect('notes')}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  activePreset === 'notes' && activeStudioTab === 'editor'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-[var(--app-border)] bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                Strategy Memo
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect('plan')}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  activePreset === 'plan' && activeStudioTab === 'editor'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-[var(--app-border)] bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                Sprint Checklist
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect('sheet')}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  activeStudioTab === 'spreadsheet'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-[var(--app-border)] bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                Live Budget Sheet
              </button>
            </div>
          </div>

          {/* Elevated macOS Studio Window Card */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-card shadow-2xl transition hover:shadow-primary/5">
            {/* Top Chrome Window Bar */}
            <div className="flex items-center justify-between border-b border-[var(--app-border)] bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="size-3 rounded-full bg-rose-500/80 inline-block" />
                  <span className="size-3 rounded-full bg-amber-500/80 inline-block" />
                  <span className="size-3 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <span className="ml-2 font-mono text-[11px] text-muted-foreground font-medium">
                  {activeStudioTab === 'editor' && 'workspace-draft.md'}
                  {activeStudioTab === 'spreadsheet' && 'financial-ledger.xlsx'}
                  {activeStudioTab === 'slash' && 'command-menu.preview'}
                </span>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2.5">
                <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className={`size-2 rounded-full bg-emerald-500 ${isTyping ? 'animate-ping' : ''}`} />
                  {isSimulatedOffline ? 'Airplane mode (offline cache responding)' : 'Saved locally in IndexedDB (0ms)'}
                </span>
              </div>
            </div>

            {/* TAB 1: Markdown Document Studio */}
            {activeStudioTab === 'editor' && (
              <div className="p-4 sm:p-6 lg:p-8">
                {/* Micro Formatting Bar */}
                <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-muted/30 p-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditorText((prev) => `${prev}\n\n## Section Header\n`)}
                    className="rounded-md px-2.5 py-1 font-semibold hover:bg-muted text-muted-foreground hover:text-foreground transition"
                  >
                    H2
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorText((prev) => `${prev} **bold text**`)}
                    className="rounded-md px-2.5 py-1 font-bold hover:bg-muted text-muted-foreground hover:text-foreground transition"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorText((prev) => `${prev}\n- [ ] New active checklist task`)}
                    className="rounded-md px-2.5 py-1 hover:bg-muted text-muted-foreground hover:text-foreground transition flex items-center gap-1"
                  >
                    <CheckCircleIcon className="size-3.5" />
                    <span>Task</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorText((prev) => `${prev}\n> 💡 Critical note: your files stay sovereign.\n`)}
                    className="rounded-md px-2.5 py-1 hover:bg-muted text-muted-foreground hover:text-foreground transition"
                  >
                    Callout
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorText((prev) => `${prev}\n\`\`\`ts\nconst vault = await openVault('writin');\n\`\`\`\n`)}
                    className="rounded-md px-2.5 py-1 font-mono hover:bg-muted text-muted-foreground hover:text-foreground transition"
                  >
                    &lt;/&gt; Code
                  </button>

                  <div className="ml-auto hidden text-[11px] text-muted-foreground font-mono sm:block">
                    Full Markdown &amp; shortcut support
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <label htmlFor="interactive-editor-canvas" className="sr-only">Live interactive document</label>
                    <textarea
                      id="interactive-editor-canvas"
                      rows={11}
                      value={editorText}
                      onChange={(e) => {
                        setEditorText(e.target.value)
                        setIsTyping(true)
                        setTimeout(() => setIsTyping(false), 250)
                      }}
                      className="w-full resize-none rounded-xl border border-[var(--app-border)] bg-muted/10 p-4 font-mono text-sm leading-relaxed text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />

                    <div className="mt-2.5 flex items-center justify-between text-xs font-mono text-muted-foreground">
                      <span>{wordCount} words · {charCount} characters · ~{Math.ceil(wordCount / 200)} min read</span>
                      <span className="text-primary font-medium">Type freely to test</span>
                    </div>
                  </div>

                  {/* Interactive Checklist Sandbox */}
                  <div className="rounded-xl border border-[var(--app-border)] bg-muted/20 p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Interactive Task List
                      </h4>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                        {completedTasksCount} / {demoTasks.length}
                      </span>
                    </div>

                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${(completedTasksCount / demoTasks.length) * 100}%` }}
                      />
                    </div>

                    <div className="mt-4 space-y-2">
                      {demoTasks.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => toggleTask(task.id)}
                          className={`flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left text-xs transition ${
                            task.completed
                              ? 'bg-emerald-500/10 text-muted-foreground line-through'
                              : 'bg-background hover:bg-muted text-foreground shadow-sm'
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${
                              task.completed
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-[var(--app-border)] bg-background'
                            }`}
                          >
                            {task.completed ? <CheckIcon className="size-3 stroke-[3]" /> : null}
                          </span>
                          <span className="leading-snug">{task.text}</span>
                        </button>
                      ))}
                    </div>

                    <p className="mt-4 text-[11px] text-muted-foreground italic">
                      Click tasks to toggle. Writin supports nested checklists with keyboard reordering.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: UniverJS Spreadsheet Live Engine */}
            {activeStudioTab === 'spreadsheet' && (
              <div className="p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center mb-6">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Live UniverJS Computation Engine</h3>
                    <p className="text-xs text-muted-foreground">
                      Edit the hours or rate cells below. Formulas recalculate totals with zero lag.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2">
                    <span className="text-xs text-muted-foreground">Grand Total:</span>
                    <span className="font-mono text-xl font-bold text-primary">${sheetTotal.toLocaleString()}</span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-[var(--app-border)]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/70 text-muted-foreground font-mono">
                      <tr>
                        <th className="py-3 px-4 font-semibold">Deliverable</th>
                        <th className="py-3 px-4 font-semibold w-28">Hours</th>
                        <th className="py-3 px-4 font-semibold w-32">Rate ($/hr)</th>
                        <th className="py-3 px-4 font-semibold text-right w-36">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--app-border)]">
                      {sheetRows.map((row, idx) => {
                        const lineTotal = row.hours * row.rate
                        return (
                          <tr key={row.item} className="hover:bg-muted/30 transition">
                            <td className="py-3 px-4 font-medium text-foreground">{row.item}</td>
                            <td className="py-2 px-4">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={row.hours}
                                onChange={(e) => updateSheetRow(idx, 'hours', Number(e.target.value) || 0)}
                                className="w-20 rounded-md border border-[var(--app-border)] bg-background px-2.5 py-1 font-mono text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              />
                            </td>
                            <td className="py-2 px-4">
                              <input
                                type="number"
                                min={0}
                                max={500}
                                value={row.rate}
                                onChange={(e) => updateSheetRow(idx, 'rate', Number(e.target.value) || 0)}
                                className="w-24 rounded-md border border-[var(--app-border)] bg-background px-2.5 py-1 font-mono text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                              />
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">
                              ${lineTotal.toLocaleString()}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-[var(--app-border)] bg-muted/40 font-mono">
                      <tr>
                        <td colSpan={3} className="py-3 px-4 text-right text-muted-foreground">
                          Dynamic Evaluator: <code className="text-primary font-bold">=SUM(D2:D5)</code>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-primary text-sm">
                          ${sheetTotal.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <SparklesIcon className="size-4 text-primary shrink-0" />
                  <span>
                    Powered by UniverJS presets. Embed sheets directly inside notes without opening Excel or Google Sheets.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 3: Interactive Slash Command Palette */}
            {activeStudioTab === 'slash' && (
              <div className="p-4 sm:p-6 lg:p-8">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-foreground">Keyboard-Driven Slash Menu</h3>
                  <p className="text-xs text-muted-foreground">
                    Click any slash command below to test how easily blocks are generated in Writin.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Command Selector */}
                  <div className="space-y-2">
                    {[
                      { key: 'heading', name: '/h1 Heading 1', desc: 'Large section title' },
                      { key: 'task', name: '/todo Task List', desc: 'Interactive checkable task item' },
                      { key: 'table', name: '/table Data Table', desc: 'Custom grid with rows and columns' },
                      { key: 'sheet', name: '/sheet Spreadsheet', desc: 'Full UniverJS live calculation sheet' },
                      { key: 'code', name: '/code Code Block', desc: 'Syntax-highlighted code editor' },
                    ].map((cmd) => (
                      <button
                        key={cmd.key}
                        type="button"
                        onClick={() => setSlashPreview(cmd.key)}
                        className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                          slashPreview === cmd.key
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-[var(--app-border)] bg-background hover:bg-muted'
                        }`}
                      >
                        <div>
                          <div className="font-mono text-xs font-bold text-foreground">{cmd.name}</div>
                          <div className="text-[11px] text-muted-foreground">{cmd.desc}</div>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">Press ↵</span>
                      </button>
                    ))}
                  </div>

                  {/* Rendered Live Preview */}
                  <div className="rounded-xl border border-[var(--app-border)] bg-muted/20 p-5 flex flex-col justify-center">
                    <span className="font-mono text-[11px] text-muted-foreground mb-3">Live Block Rendering:</span>

                    {slashPreview === 'heading' && (
                      <h2 className="text-2xl font-bold tracking-tight text-foreground border-b border-[var(--app-border)] pb-2">
                        Executive Overview &amp; Goals
                      </h2>
                    )}

                    {slashPreview === 'task' && (
                      <div className="flex items-center gap-2.5 rounded-lg border border-[var(--app-border)] bg-background p-3 shadow-sm">
                        <span className="size-4 rounded border border-emerald-500 bg-emerald-500 text-white flex items-center justify-center">
                          <CheckIcon className="size-3 stroke-[3]" />
                        </span>
                        <span className="text-sm line-through text-muted-foreground">Verify end-to-end encryption keys</span>
                      </div>
                    )}

                    {slashPreview === 'table' && (
                      <div className="rounded-lg border border-[var(--app-border)] bg-background overflow-hidden text-xs">
                        <div className="grid grid-cols-2 bg-muted/60 p-2 font-semibold">
                          <span>Metric</span>
                          <span>Value</span>
                        </div>
                        <div className="grid grid-cols-2 p-2 border-t border-[var(--app-border)]">
                          <span>Local Read Latency</span>
                          <span className="font-mono text-emerald-600">0.4ms</span>
                        </div>
                      </div>
                    )}

                    {slashPreview === 'sheet' && (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
                        <TableCellsIcon className="size-8 mx-auto text-primary" />
                        <div className="mt-2 text-xs font-bold">UniverJS Sheet Core Embedded</div>
                        <div className="text-[11px] text-muted-foreground">Formulas, charts, and multi-tab workbook</div>
                      </div>
                    )}

                    {slashPreview === 'code' && (
                      <pre className="rounded-lg bg-zinc-950 p-3 font-mono text-xs text-emerald-400 overflow-x-auto">
                        <code>{`// Writin Local Storage Engine\nconst vault = await db.files.toArray();\nreturn vault.filter(f => !f.isDeleted);`}</code>
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Vault Circuit & Storage Architecture (WorkOS Atlas Visual Graph) */}
      <section id="vault-architecture" className="relative z-10 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <LockClosedIcon className="size-3.5" />
              <span>Zero-Knowledge Architecture</span>
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Where does your data live?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
              Traditional cloud note apps store your plaintext notes on company servers. Writin is built so only you hold the keys.
            </p>
          </div>

          {/* Interactive Model Toggle */}
          <div className="mt-10 flex justify-center">
            <div className="inline-flex rounded-xl border border-[var(--app-border)] bg-muted/40 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setStorageModel('local')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                  storageModel === 'local'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FolderOpenIcon className="size-4" />
                <span>1. Local Device Vault</span>
              </button>
              <button
                type="button"
                onClick={() => setStorageModel('drive')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                  storageModel === 'drive'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CloudArrowUpIcon className="size-4" />
                <span>2. Google Drive Vault</span>
              </button>
              <button
                type="button"
                onClick={() => setStorageModel('cloud')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition sm:text-sm ${
                  storageModel === 'cloud'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <NoSymbolIcon className="size-4 text-destructive" />
                <span>Traditional SaaS Notes</span>
              </button>
            </div>
          </div>

          {/* Animated Circuit Visual Box */}
          <div className="mt-6 rounded-2xl border border-[var(--app-border)] bg-card p-6 shadow-xl sm:p-8">
            {storageModel === 'local' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                  <div className="flex flex-1 flex-col items-center rounded-xl border border-[var(--app-border)] bg-muted/30 p-6 text-center">
                    <DevicePhoneMobileIcon className="size-12 text-primary" />
                    <span className="mt-3 text-sm font-bold">Your Device / Browser</span>
                    <span className="text-xs text-muted-foreground">Client-side React 19 app</span>
                  </div>

                  <div className="flex flex-col items-center text-emerald-600 dark:text-emerald-400">
                    <span className="text-xs font-mono font-bold tracking-wider">0ms Local Bus</span>
                    <svg className="h-6 w-32" fill="none">
                      <path d="M0 12 H128" stroke="currentColor" strokeWidth="2.5" className="animate-beam" />
                    </svg>
                    <span className="text-[11px] text-muted-foreground font-mono">No network request sent</span>
                  </div>

                  <div className="flex flex-1 flex-col items-center rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-6 text-center shadow-sm">
                    <CircleStackIcon className="size-12 text-emerald-600 dark:text-emerald-400" />
                    <span className="mt-3 text-sm font-bold">IndexedDB / Device Folder</span>
                    <span className="text-xs text-muted-foreground">Direct File System Access API</span>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--app-border)] bg-muted/20 p-4 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">Total Sovereign Isolation:</strong> You do not even need an account. 
                  Your files never leave your device unless you choose to export them. Works completely offline on flights, remote areas, or air-gapped systems.
                </div>
              </div>
            )}

            {storageModel === 'drive' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                  <div className="flex flex-1 flex-col items-center rounded-xl border border-[var(--app-border)] bg-muted/30 p-6 text-center">
                    <ComputerDesktopIcon className="size-12 text-primary" />
                    <span className="mt-3 text-sm font-bold">Your Laptop, Tablet, or Phone</span>
                    <span className="text-xs text-muted-foreground">Cross-device live sync</span>
                  </div>

                  <div className="flex flex-col items-center text-blue-600 dark:text-blue-400">
                    <span className="text-xs font-mono font-bold tracking-wider">Direct OAuth 2.0 Vault</span>
                    <svg className="h-6 w-32" fill="none">
                      <path d="M0 12 H128" stroke="currentColor" strokeWidth="2.5" className="animate-beam" />
                    </svg>
                    <button
                      type="button"
                      onClick={triggerPacketSync}
                      className="mt-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-600 transition hover:bg-blue-500/20"
                    >
                      {isSyncingPacket ? '⚡ Transmitting packet...' : 'Click to Simulate Sync'}
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col items-center rounded-xl border border-blue-500/40 bg-blue-500/5 p-6 text-center shadow-sm">
                    <CloudArrowUpIcon className="size-12 text-blue-600 dark:text-blue-400" />
                    <span className="mt-3 text-sm font-bold">Your Personal Google Drive</span>
                    <span className="text-xs text-muted-foreground">Restricted to &quot;Writin&quot; folder only</span>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--app-border)] bg-muted/20 p-4 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">Zero Central Database:</strong> Unlike other services, Writin does not store your files on any middleman server. 
                  Data travels directly between your browser and Google Drive via official APIs using restricted scopes—meaning Writin has zero access to any other files in your Drive.
                </div>
              </div>
            )}

            {storageModel === 'cloud' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                  <div className="flex flex-1 flex-col items-center rounded-xl border border-[var(--app-border)] bg-muted/30 p-6 text-center">
                    <DevicePhoneMobileIcon className="size-12 text-muted-foreground" />
                    <span className="mt-3 text-sm font-bold">Your Personal Notes</span>
                  </div>

                  <div className="flex flex-col items-center text-destructive">
                    <span className="text-xs font-mono font-bold tracking-wider">Unencrypted Cloud Upload</span>
                    <span className="text-2xl">→</span>
                    <span className="text-[11px] text-destructive">Stored on corporate database</span>
                  </div>

                  <div className="flex flex-1 flex-col items-center rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center shadow-sm">
                    <CircleStackIcon className="size-12 text-destructive" />
                    <span className="mt-3 text-sm font-bold text-destructive">Vendor Server Database</span>
                    <span className="text-xs text-muted-foreground">Vendor lock-in &amp; subscription traps</span>
                  </div>
                </div>

                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs sm:text-sm leading-relaxed text-destructive/90">
                  <strong className="text-destructive font-semibold">The SaaS problem:</strong> Typical SaaS note tools hold your data in proprietary cloud databases. If they change terms, raise prices, or get breached, your personal notes are vulnerable.
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. Attio-Style Feature Bento Grid */}
      <section id="features-bento" className="relative z-10 py-16 sm:py-24 border-t border-[var(--app-border)] bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Engineered for velocity and focus
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
              Every detail is tuned to eliminate cognitive friction so you stay in creative flow.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Bento Card 1: 3D Keyboard Deck */}
            <div className="rounded-2xl border border-[var(--app-border)] bg-card p-6 shadow-md flex flex-col justify-between transition hover:border-primary/40">
              <div>
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CommandLineIcon className="size-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold">Tactile Keyboard Flow</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Never leave the home row. Search files, run commands, format text, and open recent items with muscle memory.
                </p>
              </div>

              {/* 3D Keys Deck */}
              <div className="mt-6 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '⌘K', name: 'search', full: '⌘K' },
                    { label: '⌘B', name: 'bold', full: '⌘B' },
                    { label: '/', name: 'slash', full: '/' },
                    { label: '⌘⇧7', name: 'checkbox', full: '⌘⇧7' },
                  ].map((k) => (
                    <button
                      key={k.label}
                      type="button"
                      onClick={() => handleKeyPressSimulation(k.label, k.name as 'search' | 'bold' | 'slash' | 'checkbox')}
                      className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition shadow-sm ${
                        pressedKey === k.label || activeShortcut === k.name
                          ? 'border-primary bg-primary text-primary-foreground translate-y-0.5 shadow-none'
                          : 'border-[var(--app-border)] bg-background text-foreground hover:bg-muted'
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border border-[var(--app-border)] bg-muted/40 p-3 text-xs font-mono text-muted-foreground">
                  {activeShortcut === 'search' && '⌘K → Global Spotlight Search across notes, folders & sheets'}
                  {activeShortcut === 'bold' && '⌘B → Toggle bold formatting on active text selection'}
                  {activeShortcut === 'slash' && '/ → Trigger Slash Menu for headings, tables, and callouts'}
                  {activeShortcut === 'checkbox' && '⌘⇧7 → Toggle interactive task list checkbox on current block'}
                </div>
              </div>
            </div>

            {/* Bento Card 2: Offline Airplane Simulator */}
            <div className="rounded-2xl border border-[var(--app-border)] bg-card p-6 shadow-md flex flex-col justify-between transition hover:border-primary/40">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                    <BoltIcon className="size-6" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSimulatedOffline(!isSimulatedOffline)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      isSimulatedOffline
                        ? 'bg-amber-500 text-white'
                        : 'border border-[var(--app-border)] text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {isSimulatedOffline ? '✈ Airplane Mode Active' : 'Toggle Airplane Mode'}
                  </button>
                </div>
                <h3 className="mt-4 text-lg font-bold">100% Offline-Ready PWA</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Installable as a standalone Progressive Web App on macOS, Windows, Linux, iOS, and Android. Works seamlessly on flights or off the grid.
                </p>
              </div>

              <div className="mt-6 rounded-xl border border-[var(--app-border)] bg-muted/40 p-3 text-xs font-mono">
                <div className="text-foreground font-semibold">Service Worker Telemetry:</div>
                <div className="mt-1 text-emerald-600 dark:text-emerald-400">
                  {isSimulatedOffline ? '● 0 network required · Local IndexedDB responding' : '● Ready for standalone desktop & mobile install'}
                </div>
              </div>
            </div>

            {/* Bento Card 3: Universal Export Hub */}
            <div className="rounded-2xl border border-[var(--app-border)] bg-card p-6 shadow-md flex flex-col justify-between transition hover:border-primary/40">
              <div>
                <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <ArrowDownTrayIcon className="size-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold">Universal Sovereign Export</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Your work is stored in standard formats. Export single documents or download a full ZIP vault anytime.
                </p>
              </div>

              <div className="mt-6 space-y-2.5">
                <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
                  {(['md', 'docx', 'xlsx', 'zip'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setActiveExportFormat(fmt)}
                      className={`rounded-lg border py-1.5 text-center font-bold transition ${
                        activeExportFormat === fmt
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-[var(--app-border)] bg-background text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      .{fmt}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border border-[var(--app-border)] bg-muted/40 p-3 text-xs font-mono text-muted-foreground">
                  {activeExportFormat === 'md' && 'Markdown: Portable plain text with YAML metadata frontmatter'}
                  {activeExportFormat === 'docx' && 'Word: Native Microsoft Word document with headings and tables'}
                  {activeExportFormat === 'xlsx' && 'Excel: Standard spreadsheet workbook with live calculations'}
                  {activeExportFormat === 'zip' && 'Full Vault: Complete compressed backup of all notes and sheets'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Comparison Table (WorkOS Atlas Clean Matrix) */}
      <section id="comparison" className="relative z-10 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              How Writin compares
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">
              See why creators and privacy advocates choose Writin over legacy tools.
            </p>
          </div>

          <div className="mt-12 overflow-x-auto rounded-2xl border border-[var(--app-border)] bg-card shadow-lg">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--app-border)] bg-muted/60 text-xs font-semibold uppercase font-mono text-muted-foreground">
                <tr>
                  <th className="py-4 px-5">Capability</th>
                  <th className="py-4 px-5 text-primary font-bold">Writin</th>
                  <th className="py-4 px-5">Notion</th>
                  <th className="py-4 px-5">Obsidian</th>
                  <th className="py-4 px-5">Google Docs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--app-border)] text-xs sm:text-sm">
                <tr>
                  <td className="py-4 px-5 font-semibold text-foreground">Local-first (Zero server database)</td>
                  <td className="py-4 px-5 font-bold text-emerald-600 dark:text-emerald-400">✓ Yes (Your device)</td>
                  <td className="py-4 px-5 text-muted-foreground">✗ Cloud database only</td>
                  <td className="py-4 px-5 text-emerald-600 dark:text-emerald-400">✓ Yes (Local files)</td>
                  <td className="py-4 px-5 text-muted-foreground">✗ Cloud only</td>
                </tr>
                <tr>
                  <td className="py-4 px-5 font-semibold text-foreground">Personal Google Drive sync</td>
                  <td className="py-4 px-5 font-bold text-emerald-600 dark:text-emerald-400">✓ Built-in &amp; Free</td>
                  <td className="py-4 px-5 text-muted-foreground">✗ Not supported</td>
                  <td className="py-4 px-5 text-muted-foreground">✗ $8/mo Sync fee</td>
                  <td className="py-4 px-5 text-emerald-600 dark:text-emerald-400">✓ Included</td>
                </tr>
                <tr>
                  <td className="py-4 px-5 font-semibold text-foreground">Integrated Spreadsheets</td>
                  <td className="py-4 px-5 font-bold text-emerald-600 dark:text-emerald-400">✓ Built-in (UniverJS)</td>
                  <td className="py-4 px-5 text-muted-foreground">Tables only</td>
                  <td className="py-4 px-5 text-muted-foreground">Needs 3rd party plugins</td>
                  <td className="py-4 px-5 text-muted-foreground">Separate Sheets App</td>
                </tr>
                <tr>
                  <td className="py-4 px-5 font-semibold text-foreground">Offline Capable PWA</td>
                  <td className="py-4 px-5 font-bold text-emerald-600 dark:text-emerald-400">✓ 100% Offline</td>
                  <td className="py-4 px-5 text-muted-foreground">✗ Requires internet</td>
                  <td className="py-4 px-5 text-emerald-600 dark:text-emerald-400">✓ Native app</td>
                  <td className="py-4 px-5 text-muted-foreground">Partial Chrome extension</td>
                </tr>
                <tr>
                  <td className="py-4 px-5 font-semibold text-foreground">Monthly Subscription Fee</td>
                  <td className="py-4 px-5 font-bold text-emerald-600 dark:text-emerald-400">$0 (Free &amp; Sovereign)</td>
                  <td className="py-4 px-5 text-muted-foreground">$10–$20/mo</td>
                  <td className="py-4 px-5 text-muted-foreground">$0–$8/mo</td>
                  <td className="py-4 px-5 text-muted-foreground">Free with account</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 7. FAQ Accordions */}
      <section id="faq" className="relative z-10 py-16 sm:py-24 border-t border-[var(--app-border)] bg-muted/20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Frequently Asked Questions
            </h2>
            <p className="mx-auto mt-3 text-base text-muted-foreground">
              Everything you need to know about privacy, security, and using Writin.
            </p>
          </div>

          <div className="mt-10 space-y-3">
            {[
              {
                q: 'Where are my documents and spreadsheets stored?',
                a: 'If you choose Local Mode, everything stays directly on your device inside your browser’s IndexedDB or a folder you pick via the File System Access API. If you connect Google Drive, files are synced directly to your private Google Drive in a dedicated "Writin" folder. We run zero server databases.',
              },
              {
                q: 'Can anyone at Writin read my notes?',
                a: 'No. There are no backend database servers storing customer content. When you use Google Drive sync, traffic travels straight between your browser and Google’s official APIs using your authenticated token.',
              },
              {
                q: 'Do I need a Google account to use Writin?',
                a: 'No! You can use Writin 100% locally on your computer, tablet, or phone without logging into Google or creating an account. Simply choose "Local Vault" when getting started.',
              },
              {
                q: 'How does Writin work offline?',
                a: 'Writin is built as an offline-first Progressive Web App (PWA). All scripts and styles are cached by the service worker, and all document edits are saved locally first. You can write on airplanes, trains, or off the grid without issue.',
              },
              {
                q: 'How do I export my notes if I want to leave?',
                a: 'You can export individual documents to Markdown (.md), Microsoft Word (.docx), or HTML. In Preferences, you can also download a complete ZIP archive of your entire workspace at any time.',
              },
              {
                q: 'Is Writin really free? What is the catch?',
                a: 'There is no catch! Because Writin leverages your own device and your existing personal Google Drive storage, we do not incur expensive recurring database hosting costs per user. We build software we love using ourselves.',
              },
            ].map((item, index) => {
              const isOpen = expandedFaq === index
              return (
                <div
                  key={item.q}
                  className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-card transition"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isOpen ? null : index)}
                    className="flex w-full items-center justify-between p-4 sm:p-5 text-left font-semibold text-foreground text-sm sm:text-base hover:bg-muted/40"
                    aria-expanded={isOpen}
                  >
                    <span>{item.q}</span>
                    <span className="ml-4 shrink-0 font-mono text-muted-foreground">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="px-4 pb-5 pt-1 text-xs sm:text-sm leading-relaxed text-muted-foreground border-t border-[var(--app-border)]/50">
                      {item.a}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 8. Bottom Magnetic CTA (WorkOS Atlas Style Glow) */}
      <section className="relative z-10 overflow-hidden py-20 sm:py-28 border-t border-[var(--app-border)]">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Start writing with complete freedom.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            No credit card. No vendor lock-in. Experience modern note-taking with sovereign data ownership.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
            {isUserLoggedIn ? (
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary px-8 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/25 transition hover:opacity-95 sm:w-auto"
              >
                <span>Jump to Workspace</span>
                <ArrowRightIcon className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenAuthModal}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary px-8 text-base font-semibold text-primary-foreground shadow-xl shadow-primary/25 transition hover:opacity-95 sm:w-auto"
              >
                <span>Get Started Now</span>
                <ArrowRightIcon className="size-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--app-border)] bg-background px-6 text-base font-semibold text-foreground transition hover:bg-muted sm:w-auto"
            >
              Back to Top ↑
            </button>
          </div>
        </div>
      </section>

      {/* 9. Sleek Minimal Footer */}
      <footer className="relative z-10 border-t border-[var(--app-border)] bg-muted/40 py-10 text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <img src="/pwa-192.svg" alt="" className="size-5 rounded" />
            <span className="font-bold text-foreground">Writin</span>
            <span>· Version {APP_VERSION}</span>
          </div>

          <div className="flex items-center gap-6 font-medium">
            <a href="#interactive-studio" className="hover:text-foreground transition">
              Studio
            </a>
            <a href="#vault-architecture" className="hover:text-foreground transition">
              Vault
            </a>
            <a href="#comparison" className="hover:text-foreground transition">
              Compare
            </a>
            <a href="#faq" className="hover:text-foreground transition">
              FAQ
            </a>
            <Link to="/privacy" className="hover:text-foreground transition">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground transition">
              Terms
            </Link>
            <Link to="/login" className="hover:text-foreground transition">
              Sign In
            </Link>
          </div>

          <div className="font-mono text-[11px]">
            Engineered for privacy, speed, and focus.
          </div>
        </div>
      </footer>

      {/* In-Page Get Started & Sign In Modal (Single-Page Seamless Flow) */}
      {isAuthModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--app-border)] bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              aria-label="Close dialog"
              className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XMarkIcon className="size-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <img src="/pwa-192.svg" alt="" className="size-7 rounded-md" />
              </div>
              <div>
                <h3 id="auth-modal-title" className="text-lg font-bold text-foreground">
                  Get Started with Writin
                </h3>
                <p className="text-xs text-muted-foreground">
                  Choose your storage vault. You own 100% of your notes.
                </p>
              </div>
            </div>

            {authModalError && (
              <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {authModalError}
              </div>
            )}

            <div className="mt-6 space-y-3">
              {/* Option 1: Instant Local Device Vault */}
              <button
                type="button"
                disabled={isCreatingLocal}
                onClick={handleStartInstantLocal}
                className="group flex w-full items-start gap-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-left transition hover:border-emerald-500 hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CircleStackIcon className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-foreground">Private Device Vault</span>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold font-mono text-emerald-700 dark:text-emerald-300">
                      1-Click Instant
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Stored in browser IndexedDB. Works completely offline with zero accounts needed.
                  </p>
                </div>
              </button>

              {/* Option 2: Choose Local Device Folder (if supported) */}
              {supportsDeviceFolder && (
                <button
                  type="button"
                  disabled={isCreatingLocal}
                  onClick={handlePickLocalFolder}
                  className="group flex w-full items-start gap-3.5 rounded-xl border border-[var(--app-border)] bg-background p-4 text-left transition hover:border-primary hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderOpenIcon className="size-5" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-bold text-foreground">Select Local Folder</span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Pick a real folder on your device. Edit files directly on your disk.
                    </p>
                  </div>
                </button>
              )}

              {/* Option 3: Connect Google Drive */}
              <button
                type="button"
                disabled={isCreatingLocal}
                onClick={handleStartGoogleLogin}
                className="group flex w-full items-start gap-3.5 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 text-left transition hover:border-blue-500 hover:bg-blue-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <CloudArrowUpIcon className="size-5" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-bold text-foreground">Connect Google Drive</span>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sync notes &amp; sheets across devices using your personal Google Drive vault.
                  </p>
                </div>
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-[var(--app-border)] pt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheckIcon className="size-4" />
                100% Private Ownership
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAuthModalOpen(false)
                  navigate('/login')
                }}
                className="font-medium text-foreground hover:underline"
              >
                Full vault options →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
