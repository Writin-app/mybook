import {
  ArrowLeftIcon,
  CheckCircleIcon,
  LockClosedIcon,
  MoonIcon,
  ShieldCheckIcon,
  SunIcon,
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'

import { APP_VERSION } from '../config/app'
import { useAppStore } from '../stores/useAppStore'

export function PrivacyPage() {
  const { theme, toggleTheme } = useAppStore()

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-[var(--accent)] selection:text-white">
      {/* Sticky Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-[var(--app-border)] bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/about"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-[var(--app-hover)] hover:text-foreground"
              aria-label="Back to About"
            >
              <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
              <span>Back</span>
            </Link>
            <Link to="/about" className="flex items-center gap-2">
              <img src="/pwa-192.svg" alt="" className="size-7 rounded-lg" />
              <span className="font-semibold tracking-tight text-foreground">Writin</span>
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                v{APP_VERSION}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-[var(--app-border)] bg-[var(--app-card)] p-2 text-muted-foreground transition hover:bg-[var(--app-hover)] hover:text-foreground"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
            </button>
            <Link
              to="/login"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              Open App
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
        {/* Header */}
        <div className="border-b border-[var(--app-border)] pb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <ShieldCheckIcon className="size-4" aria-hidden="true" />
            <span>Privacy-First Architecture</span>
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last Updated: October 26, 2026 • Effective Immediately
          </p>
        </div>

        {/* Highlights Callout */}
        <div className="mt-8 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-6 shadow-sm sm:p-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <LockClosedIcon className="size-5 text-primary" aria-hidden="true" />
            <span>Our Core Privacy Commitments</span>
          </h2>
          <ul className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <li className="flex items-start gap-2.5">
              <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
              <span><strong>Local-First:</strong> Notes and spreadsheets are stored on your device via IndexedDB or chosen folder.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
              <span><strong>Narrow Google Drive Scope:</strong> We only access files created by Writin (<code className="rounded bg-muted px-1 text-xs">drive.file</code>).</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
              <span><strong>Zero Data Monetization:</strong> We never sell, rent, or trade your data or documents to anyone.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
              <span><strong>No AI Model Training:</strong> Your private writing and data are never used to train AI models.</span>
            </li>
          </ul>
        </div>

        {/* Policy Body */}
        <article className="prose prose-neutral mt-10 max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary">
          <section className="space-y-4">
            <h2 className="text-xl">1. Introduction</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Writin (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) provides a modern, high-speed document and spreadsheet workspace accessible at <strong>https://writin.app</strong> and associated subdomains. We believe your thoughts, documents, and spreadsheets belong to you. This Privacy Policy describes how we collect, use, and protect your information when you use our web applications.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">2. Information We Collect and How We Use It</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Writin is built on a local-first philosophy. We do not maintain centralized user databases that store your notes, documents, or spreadsheet records.
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                <strong>Local Device Storage:</strong> Documents and spreadsheets you create in Local Vault mode are stored exclusively inside your browser&rsquo;s IndexedDB database or in a device folder you explicitly select using the File System Access API. This data stays entirely on your physical device and never touches our servers.
              </li>
              <li>
                <strong>Google Account Information:</strong> If you choose to connect Google Drive for automatic backup and cloud sync, we request your permission to view your primary Google account email and basic profile information (such as your name). We use this information solely to identify your workspace session and personalize your app header.
              </li>
              <li>
                <strong>Zero Analytics &amp; Tracking:</strong> We do not use third-party analytics trackers, advertising SDKs, or session replay recorders.
              </li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">3. Google API Services &amp; Google Drive Data</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              When you opt into Google Drive cloud backup, Writin connects to Google APIs. We take your security and compliance with Google&rsquo;s developer standards with the highest priority:
            </p>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
              <h3 className="font-semibold text-primary">Narrow Permission Scope (<code className="rounded bg-primary/10 px-1 py-0.5 text-xs font-mono">drive.file</code>)</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Writin exclusively requests the narrow <code className="rounded bg-primary/10 px-1 py-0.5 text-xs font-mono">https://www.googleapis.com/auth/drive.file</code> scope. This grants Writin permission <strong>only</strong> to files and folders that Writin itself creates or that you explicitly open with the app. Writin <strong>cannot</strong> see, access, modify, or delete any other documents, photos, or spreadsheets stored in your Google Drive.
              </p>
            </div>

            <h3 className="mt-4 text-base font-semibold">Google API Limited Use Disclosure</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Writin&rsquo;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>

            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                <strong>No Transfer for Advertising:</strong> We never transfer, disclose, or sell Google user data to third parties for serving advertisements, retargeting, or market research.
              </li>
              <li>
                <strong>No AI Training:</strong> We do not use Google user data, document contents, or user files to train, retrain, or fine-tune generalized artificial intelligence (AI) or machine learning (ML) models.
              </li>
              <li>
                <strong>Human Access:</strong> No human employee, contractor, or agent reads or reviews your Google Drive files or document contents unless you explicitly provide written consent to investigate a specific technical error.
              </li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">4. Data Storage, Retention, and Security</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Writin employs industry-standard security safeguards:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                <strong>Encrypted Communications:</strong> All communications between your browser, Vercel serverless endpoints, and Google APIs are encrypted in transit using Transport Layer Security (TLS 1.3 / HTTPS).
              </li>
              <li>
                <strong>HttpOnly Session Security:</strong> When using backend authentication, session tokens are encrypted using AES-256-GCM and stored in secure, <code className="rounded bg-muted px-1 text-xs">HttpOnly</code>, <code className="rounded bg-muted px-1 text-xs">SameSite=Lax</code> cookies inaccessible to third-party scripts.
              </li>
              <li>
                <strong>Retention &amp; Control:</strong> You retain complete control over your data at all times. If you delete a document in Writin, it is moved to Trash or deleted according to your preferences. Backups in your Google Drive remain under your direct ownership and management inside your Google account.
              </li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">5. How to Revoke Access or Delete Data</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You may revoke Writin&rsquo;s access to your Google account or delete your stored data at any time:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                <strong>Revoke Google Access:</strong> Visit your{' '}
                <a
                  href="https://myaccount.google.com/connections"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Google Account Third-Party Connections
                </a>
                , locate <strong>Writin</strong>, and click &ldquo;Delete all connections.&rdquo;
              </li>
              <li>
                <strong>Delete Local Storage:</strong> You can clear your browser storage or delete the local workspace directly from the Writin Settings page or by clearing your browser site data.
              </li>
              <li>
                <strong>Delete Drive Backups:</strong> Open{' '}
                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Google Drive
                </a>
                , locate your &ldquo;Writin&rdquo; folder, and permanently delete it at any time.
              </li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">6. Children&rsquo;s Privacy</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Writin is not directed to children under 13 years of age, and we do not knowingly collect personal information from children under 13.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">7. Changes to this Policy</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We may update this Privacy Policy from time to time. When changes are made, we will update the &ldquo;Last Updated&rdquo; date at the top of this page. We encourage you to review this policy periodically.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">8. Contact Us</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Writin App Support &amp; Privacy Team</p>
              <p className="mt-1">
                Email:{' '}
                <a href="mailto:writin.app@gmail.com" className="font-medium text-primary hover:underline">
                  writin.app@gmail.com
                </a>
              </p>
              <p>Website: https://writin.app</p>
            </div>
          </section>
        </article>

        {/* Footer Navigation */}
        <footer className="mt-16 border-t border-[var(--app-border)] pt-8">
          <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} Writin. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link to="/about" className="hover:text-foreground hover:underline">About</Link>
              <Link to="/terms" className="hover:text-foreground hover:underline">Terms of Service</Link>
              <Link to="/privacy" className="font-semibold text-foreground">Privacy Policy</Link>
              <Link to="/login" className="hover:text-foreground hover:underline">Sign In</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
