import * as React from "react"

import { cn } from "@/lib/utils"
import { Glass } from "@/components/glass/glass"

type AuroraProps = React.ComponentProps<"div"> & {
  colors?: readonly [string, string, string]
  animated?: boolean
}

function Aurora({ className, colors, animated = true, ...props }: AuroraProps) {
  const palette = colors ?? ["var(--aurora-1)", "var(--aurora-2)", "var(--aurora-3)"]
  return (
    <div aria-hidden="true" data-slot="aurora" data-animated={animated || undefined} className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)} {...props}>
      {palette.map((color, index) => (
        <span key={index} className={cn("glass-aurora-blob absolute block size-[min(58vw,42rem)] rounded-full blur-[90px]", animated && "glass-aurora-animated")} style={{ backgroundColor: color, opacity: 0.35, left: `${index === 1 ? 54 : index === 2 ? 24 : -16}%`, top: `${index === 2 ? 58 : index === 1 ? 4 : -18}%`, animationDelay: `${index * -7}s` }} />
      ))}
    </div>
  )
}

type BackdropProps = React.ComponentProps<"div"> & {
  variant?: "mesh" | "noise" | "image" | "video"
  src?: string
  scrim?: boolean
  alt?: string
}

function Backdrop({ className, variant = "mesh", src, scrim = false, alt, children, ...props }: BackdropProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  React.useEffect(() => {
    if (variant !== "video") return
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => {
      if (!videoRef.current) return
      if (media.matches) videoRef.current.pause()
      else videoRef.current.play().catch(() => undefined)
    }
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [variant, src])

  return (
    <div data-slot="backdrop" data-variant={variant} role={!children && alt ? "img" : undefined} aria-label={!children ? alt : undefined} className={cn("relative isolate overflow-hidden", variant === "mesh" && "bg-[radial-gradient(ellipse_at_15%_10%,var(--aurora-1),transparent_42%),radial-gradient(ellipse_at_85%_82%,var(--aurora-3),transparent_45%),var(--background)]", variant === "noise" && "bg-[radial-gradient(var(--app-border)_0.55px,transparent_0.55px)] bg-[size:5px_5px]", className)} {...props}>
      {variant === "image" && src ? <div aria-hidden="true" className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url("${src.replaceAll('"', '')}")` }} /> : null}
      {variant === "video" && src ? <video ref={videoRef} aria-hidden="true" className="absolute inset-0 -z-10 size-full object-cover" src={src} autoPlay muted loop playsInline preload="metadata" /> : null}
      {scrim ? <div aria-hidden="true" className="absolute inset-0 -z-10 bg-black/20" /> : null}
      {children}
    </div>
  )
}

type LiquidGlassProps = Omit<React.ComponentProps<typeof Glass>, "variant" | "intensity"> & { variant?: "regular" | "clear"; clear?: boolean; optics?: boolean; followLight?: boolean; interactive?: boolean }

function LiquidGlass({ clear = false, variant = "regular", optics = true, followLight = false, interactive = false, className, ...props }: LiquidGlassProps) {
  const isClear = clear || variant === "clear"
  return <Glass {...props} data-liquid-surface="" data-glass-optics={optics ? "on" : "off"} data-glass-follow-light={followLight || undefined} data-interactive={interactive || undefined} variant={isClear ? "liquid-clear" : "liquid"} className={cn("glass-liquid-surface", interactive && "active:scale-[0.98]", className)} />
}

type ThemeScopeProps = React.ComponentProps<"div"> & {
  variables?: Partial<Record<"--primary" | "--primary-foreground" | "--ring" | "--glass-tint" | "--glass-clarity", string>>
}

function ThemeScope({ className, variables, style, ...props }: ThemeScopeProps) {
  return <div data-slot="theme-scope" className={cn("[color-scheme:light] dark:[color-scheme:dark]", className)} style={{ ...variables, ...style } as React.CSSProperties} {...props} />
}

type BackgroundExtensionProps = React.ComponentProps<"div"> & {
  src: string
  edge?: "top" | "bottom" | "both"
}

function BackgroundExtension({ className, src, edge = "both", children, ...props }: BackgroundExtensionProps) {
  return (
    <div data-slot="background-extension" className={cn("relative isolate", className)} {...props}>
      {(edge === "top" || edge === "both") && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-8 -z-10 h-24 overflow-hidden"><img src={src} alt="" className="size-full scale-110 object-cover blur-2xl" /></div>}
      {children}
      {(edge === "bottom" || edge === "both") && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-8 -z-10 h-24 overflow-hidden"><img src={src} alt="" className="size-full scale-110 object-cover blur-2xl" /></div>}
    </div>
  )
}

type HeadingProps = React.ComponentProps<"h2"> & { level?: 1 | 2 | 3 | 4 | 5 | 6 }

function Heading({ className, level = 2, ...props }: HeadingProps) {
  const classes = cn("font-heading text-balance font-semibold tracking-[-0.025em] text-foreground", level === 1 ? "text-4xl sm:text-5xl" : level === 2 ? "text-3xl" : level === 3 ? "text-2xl" : level === 4 ? "text-xl" : "text-lg", className)
  if (level === 1) return <h1 data-slot="glass-heading" className={classes} {...props} />
  if (level === 2) return <h2 data-slot="glass-heading" className={classes} {...props} />
  if (level === 3) return <h3 data-slot="glass-heading" className={classes} {...props} />
  if (level === 4) return <h4 data-slot="glass-heading" className={classes} {...props} />
  if (level === 5) return <h5 data-slot="glass-heading" className={classes} {...props} />
  return <h6 data-slot="glass-heading" className={classes} {...props} />
}

function Display({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="glass-display" className={cn("font-heading text-5xl leading-[0.98] font-semibold tracking-[-0.055em] text-foreground sm:text-7xl", className)} {...props} />
}

function Text({ className, size = "default", ...props }: React.ComponentProps<"p"> & { size?: "sm" | "default" | "lg" }) {
  return <p data-slot="glass-text" data-size={size} className={cn("leading-relaxed text-foreground", size === "sm" ? "text-sm" : size === "lg" ? "text-lg" : "text-base", className)} {...props} />
}

function Blockquote({ className, ...props }: React.ComponentProps<"blockquote">) {
  return <blockquote data-slot="glass-blockquote" className={cn("border-l-2 border-primary/40 pl-4 text-lg leading-relaxed text-muted-foreground", className)} {...props} />
}

function InlineCode({ className, ...props }: React.ComponentProps<"code">) {
  return <code data-slot="glass-inline-code" className={cn("rounded-md border border-[var(--glass-rim)] bg-primary/5 px-1.5 py-0.5 font-mono text-[0.9em] text-foreground", className)} {...props} />
}

type ListProps =
  | (React.ComponentProps<"ul"> & { ordered?: false })
  | (React.ComponentProps<"ol"> & { ordered: true })

function List(props: ListProps) {
  if (props.ordered) {
    const { className, ...orderedProps } = props
    return <ol data-slot="glass-list" className={cn("my-3 space-y-1.5 pl-5 marker:text-primary list-decimal", className)} {...orderedProps} />
  }
  const { className, ...unorderedProps } = props
  return <ul data-slot="glass-list" className={cn("my-3 space-y-1.5 pl-5 marker:text-primary list-disc", className)} {...unorderedProps} />
}

function TextLink({ className, ...props }: React.ComponentProps<"a">) {
  return <a data-slot="glass-text-link" className={cn("text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40", className)} {...props} />
}

function Prose({ className, ...props }: React.ComponentProps<"article">) {
  return <article data-slot="glass-prose" className={cn("glass-prose max-w-prose text-[1rem] leading-7 text-foreground [&_h1]:font-heading [&_h1]:text-4xl [&_h1]:font-semibold [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:font-heading [&_h3]:text-xl [&_a]:text-primary [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:bg-muted [&_pre]:p-4 [&_table]:w-full [&_ul]:list-disc [&_ol]:list-decimal", className)} {...props} />
}

export { Aurora, Backdrop, LiquidGlass, ThemeScope, BackgroundExtension, Heading, Display, Text, Blockquote, InlineCode, List, TextLink, Prose }
