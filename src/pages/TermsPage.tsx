import {
  ArrowLeftIcon,
  CheckCircleIcon,
  DocumentCheckIcon,
  MoonIcon,
  ScaleIcon,
  SunIcon,
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'

import { APP_VERSION } from '../config/app'
import { useAppStore } from '../stores/useAppStore'

export function TermsPage() {
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
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <ScaleIcon className="size-4" aria-hidden="true" />
            <span>Clear, Fair Terms</span>
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last Updated: October 26, 2026 • Effective Immediately
          </p>
        </div>

        {/* Highlights Callout */}
        <div className="mt-8 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-6 shadow-sm sm:p-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <DocumentCheckIcon className="size-5 text-primary" aria-hidden="true" />
            <span>Summary of Key Principles</span>
          </h2>
          <ul className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <li className="flex items-start gap-2.5">
              <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
              <span><strong>100% Content Ownership:</strong> You own all intellectual property in your notes, documents, and spreadsheets.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
              <span><strong>No Vendor Lock-in:</strong> Export your data anytime to standard formats (.md, .docx, .xlsx, .zip).</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
              <span><strong>Personal Cloud Storage:</strong> When cloud sync is used, backups reside in your personal Google Drive account.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
              <span><strong>Private by Default:</strong> Local workspaces run entirely inside your browser on this device.</span>
            </li>
          </ul>
        </div>

        {/* Terms Body */}
        <article className="prose prose-neutral mt-10 max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary">
          <section className="space-y-4">
            <h2 className="text-xl">1. Acceptance of Terms</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              By accessing or using the Writin application (&ldquo;Writin,&rdquo; &ldquo;Service,&rdquo; or &ldquo;Application&rdquo;) hosted at <strong>https://writin.app</strong> and its subdomains, you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree with any part of these Terms, you may not access or use the Service.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">2. Description of Service</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Writin is a high-speed, local-first document and spreadsheet editor. It enables users to create, view, edit, organize, and export rich documents and spreadsheet workbooks. Users may choose between offline local device storage (using IndexedDB or the File System Access API) or connecting their personal Google Drive account for cloud backup and multi-device synchronization.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">3. User Content and Absolute Ownership</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You retain all ownership, intellectual property rights, and copyright to any notes, documents, spreadsheets, data, text, or images that you create, edit, or store in Writin (&ldquo;User Content&rdquo;).
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                <strong>No License to User Content:</strong> We do not claim any copyright, license, or intellectual property rights over your User Content.
              </li>
              <li>
                <strong>No AI Training on User Content:</strong> We do not scrape, index, analyze, or process your User Content to build, train, or improve any machine learning or artificial intelligence models.
              </li>
              <li>
                <strong>Portability:</strong> You are free to export all of your documents and spreadsheets at any time in industry-standard formats including Markdown (.md), Microsoft Word (.docx), Excel (.xlsx), and ZIP archives.
              </li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">4. Third-Party Services (Google APIs)</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              When using Google Drive synchronization, Writin interacts with Google APIs. Your use of Google Sign-In and Google Drive is also governed by Google&rsquo;s applicable Terms of Service and Privacy Policy. Writin accesses Google Drive only with the narrow <code className="rounded bg-muted px-1 text-xs">drive.file</code> scope, limiting access strictly to files created by or explicitly opened with Writin.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">5. Acceptable Use</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You agree to use the Service in compliance with all applicable laws and regulations. You agree not to:
            </p>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Attempt to reverse engineer, decompile, or tamper with any non-public authentication or security mechanisms of the Service.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service or its servers.</li>
              <li>Transmit any malicious code, viruses, or harmful payloads through the Service.</li>
            </ul>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">6. Disclaimer of Warranties</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Writin is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. While Writin is architected with robust local persistence and automatic backups, we advise users to maintain independent backups of critical data.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">7. Limitation of Liability</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              To the fullest extent permitted by applicable law, in no event shall Writin, its developers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, profits, or goodwill, arising out of or related to your use of or inability to use the Service.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">8. Modifications to Terms</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide reasonable notice by updating the &ldquo;Last Updated&rdquo; date on this page. Your continued use of the Service following any changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className="mt-8 space-y-4">
            <h2 className="text-xl">9. Contact Information</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              For questions regarding these Terms of Service, please contact:
            </p>
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Writin Legal &amp; Support</p>
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
              <Link to="/terms" className="font-semibold text-foreground">Terms of Service</Link>
              <Link to="/privacy" className="hover:text-foreground hover:underline">Privacy Policy</Link>
              <Link to="/login" className="hover:text-foreground hover:underline">Sign In</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}
