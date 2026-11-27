import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreHorizontalSquare01Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

export type FolderSize = "xs" | "sm" | "md" | "lg"
export type FolderStyle = "grey" | "yellow" | "green" | "violet" | "blue" | "orange" | "pink" | "red"
export type FolderType = "empty" | "filled"
export type FolderVariant = "subtle" | "strong"

// ─── Token helpers ─────────────────────────────────────────────────────────────

function tok(style: FolderStyle, key: string, inverse: boolean) {
  const suffix = inverse ? "-inverse" : ""
  return `var(--token-folders-${style}-${key}${suffix})`
}

// ─── Small icon-sized folders (xs / sm / md) ──────────────────────────────────

type SmallFolderPaths = {
  size: number
  bg: string
  border: string
  occupiedBg: string
  bg2: string
  border2: string
}

const SMALL_FOLDER_PATHS: Record<Exclude<FolderSize, "lg">, SmallFolderPaths> = {
  xs: {
    size: 20,
    bg: "M6.83051 2.61108H4.65863C3.18644 2.61108 1.993 3.80549 1.993 5.27768V14.7221C1.993 16.1943 3.18644 17.3887 4.65863 17.3887H15.3235C16.7957 17.3887 17.9891 16.1952 17.9891 14.723V7.71452C17.9891 6.24233 16.7957 5.04888 15.3235 5.04888H11.4766C10.7696 5.04888 10.0916 4.76804 9.59166 4.26813L8.71541 3.39183C8.21549 2.89193 7.53748 2.61108 6.83051 2.61108Z",
    border:
      "M1.54867 14.7218V5.27752C1.54872 3.56022 2.94084 2.16675 4.65857 2.16675H6.83047C7.65526 2.16676 8.44602 2.49464 9.02927 3.07786L9.90569 3.95425C10.3222 4.37071 10.8873 4.6041 11.4762 4.60417H15.3237C17.041 4.60432 18.4334 5.99679 18.4336 7.71407V14.7226C18.4336 16.4401 17.0411 17.8324 15.3237 17.8325H4.65857C2.94081 17.8325 1.54867 16.4391 1.54867 14.7218ZM2.43721 14.7218C2.43721 15.9488 3.43196 16.944 4.65857 16.944H15.3237C16.5504 16.9439 17.545 15.9494 17.545 14.7226V7.71407C17.5449 6.48751 16.5503 5.49286 15.3237 5.49271H11.4762C10.6516 5.49264 9.86061 5.16556 9.27744 4.58248L8.40102 3.70608C7.98446 3.2895 7.4196 3.0553 6.83047 3.05529H4.65857C3.43198 3.05529 2.43726 4.05053 2.43721 5.27752V14.7218Z",
    occupiedBg:
      "M2.96375 9.25948L3.51853 13.2142C3.70317 14.5305 4.8292 15.5096 6.15831 15.5096H13.8695C15.2027 15.5096 16.3308 14.5247 16.5108 13.2036L17.0493 9.24882C17.2672 7.64848 16.0231 6.22355 14.408 6.22355L5.60353 6.22355C3.98408 6.22355 2.73878 7.65573 2.96375 9.25948Z",
    bg2: "M1.08875 11.1345L1.64353 15.0892C1.82817 16.4055 2.9542 17.3846 4.28331 17.3846H15.7445C17.0777 17.3846 18.2058 16.3997 18.3858 15.0786L18.9243 11.1238C19.1422 9.52348 17.8981 8.09855 16.283 8.09855H3.72853C2.10908 8.09855 0.863775 9.53073 1.08875 11.1345Z",
    border2:
      "M16.2829 7.65422C18.1672 7.65422 19.6192 9.31705 19.3651 11.1841L18.8262 15.1383C18.6163 16.6794 17.3002 17.829 15.7449 17.829H4.28322C2.73285 17.829 1.41924 16.6866 1.20369 15.1513L0.649213 11.1962C0.386744 9.32522 1.83939 7.65422 3.72874 7.65422H16.2829ZM3.72874 8.5428C2.37921 8.5428 1.3416 9.73655 1.52908 11.073L2.08355 15.0272C2.2374 16.124 3.17576 16.9404 4.28322 16.9405H15.7449C16.8558 16.9405 17.7956 16.1193 17.9455 15.0185L18.4843 11.0635C18.6657 9.72997 17.6287 8.5428 16.2829 8.5428H3.72874Z",
  },
  sm: {
    size: 24,
    bg: "M8.19673 3.1333H5.59048C3.82385 3.1333 2.39172 4.56659 2.39172 6.33322V17.6665C2.39172 19.4331 3.82385 20.8664 5.59048 20.8664H18.3883C20.1549 20.8664 21.587 19.4342 21.587 17.6676V9.25742C21.587 7.49079 20.1549 6.05866 18.3883 6.05866H13.772C12.9236 6.05866 12.11 5.72165 11.5101 5.12176L10.4586 4.0702C9.85871 3.47031 9.04509 3.1333 8.19673 3.1333Z",
    border:
      "M1.85852 17.6662V6.33303C1.85858 4.27227 3.52913 2.6001 5.5904 2.6001H8.19668C9.18643 2.60011 10.1354 2.99357 10.8353 3.69343L11.887 4.7451C12.3868 5.24485 13.0649 5.52492 13.7716 5.52501H18.3885C20.4494 5.52519 22.1202 7.19615 22.1205 9.25689V17.6672C22.1205 19.7282 20.4494 21.3989 18.3885 21.3991H5.5904C3.52909 21.3991 1.85852 19.727 1.85852 17.6662ZM2.92477 17.6662C2.92477 19.1386 4.11847 20.3328 5.5904 20.3328H18.3885C19.8605 20.3327 21.0542 19.1393 21.0542 17.6672V9.25689C21.054 7.78502 19.8605 6.59144 18.3885 6.59126H13.7716C12.7821 6.59117 11.8329 6.19868 11.1331 5.49898L10.0814 4.4473C9.58147 3.9474 8.90364 3.66636 8.19668 3.66635H5.5904C4.1185 3.66635 2.92483 4.86064 2.92477 6.33303V17.6662Z",
    occupiedBg:
      "M3.55638 11.1114L4.22211 15.8571C4.44368 17.4366 5.79492 18.6115 7.38985 18.6115H16.6433C18.2431 18.6115 19.5969 17.4296 19.8128 15.8443L20.459 11.0986C20.7205 9.17817 19.2276 7.46825 17.2895 7.46825L6.72412 7.46825C4.78078 7.46825 3.28641 9.18687 3.55638 11.1114Z",
    bg2: "M1.30638 13.3614L1.97211 18.1071C2.19368 19.6866 3.54492 20.8615 5.13985 20.8615H18.8933C20.4931 20.8615 21.8469 19.6796 22.0628 18.0943L22.709 13.3486C22.9705 11.4282 21.4776 9.71827 19.5395 9.71827H4.47412C2.53078 9.71827 1.03641 11.4369 1.30638 13.3614Z",
    border2:
      "M19.5392 9.18506C21.8004 9.18506 23.5428 11.1805 23.2378 13.421L22.5911 18.166C22.3393 20.0153 20.76 21.3948 18.8936 21.3949H5.13962C3.27918 21.3948 1.70284 20.024 1.44418 18.1816L0.778812 13.4355C0.463849 11.1903 2.20702 9.18507 4.47425 9.18506H19.5392ZM4.47425 10.2514C2.85481 10.2514 1.60968 11.6839 1.83465 13.2877L2.50002 18.0327C2.68464 19.3488 3.81067 20.3285 5.13962 20.3287H18.8936C20.2267 20.3286 21.3544 19.3432 21.5343 18.0223L22.1809 13.2762C22.3985 11.676 21.1542 10.2514 19.5392 10.2514H4.47425Z",
  },
  md: {
    size: 32,
    bg: "M10.9288 4.17773H7.45382C5.09831 4.17773 3.1888 6.08879 3.1888 8.44429V23.5554C3.1888 25.9108 5.09831 27.8219 7.45382 27.8219H24.5176C26.8731 27.8219 28.7825 25.9123 28.7825 23.5568V12.3432C28.7825 9.98772 26.8731 8.07821 24.5176 8.07821H18.3625C17.2313 8.07821 16.1465 7.62887 15.3467 6.82901L13.9447 5.42693C13.1448 4.62708 12.06 4.17773 10.9288 4.17773Z",
    border:
      "M2.47786 23.5549V8.44404C2.47794 5.69636 4.70534 3.4668 7.45371 3.4668H10.9287C12.2484 3.46681 13.5136 3.99142 14.4468 4.92457L15.8491 6.3268C16.5155 6.99313 17.4196 7.36656 18.3619 7.36668H24.5179C27.2656 7.36692 29.4934 9.59486 29.4938 12.3425V23.5562C29.4938 26.3042 27.2658 28.5318 24.5179 28.5321H7.45371C4.70529 28.5321 2.47786 26.3026 2.47786 23.5549ZM3.89953 23.5549C3.89953 25.5181 5.49113 27.1103 7.45371 27.1103H24.5179C26.4806 27.1102 28.072 25.519 28.072 23.5562V12.3425C28.0718 10.38 26.4804 8.78858 24.5179 8.78834H18.3619C17.0426 8.78822 15.777 8.2649 14.8439 7.33197L13.4416 5.92973C12.7751 5.2632 11.8714 4.88848 10.9287 4.88846H7.45371C5.49117 4.88846 3.89961 6.48085 3.89953 8.44404V23.5549Z",
    occupiedBg:
      "M4.74199 14.8152L5.62963 21.1428C5.92506 23.2488 7.72671 24.8153 9.85328 24.8153H22.1912C24.3243 24.8153 26.1293 23.2394 26.4172 21.1257L27.2788 14.7981C27.6275 12.2376 25.6369 9.95767 23.0528 9.95767L8.96564 9.95767C6.37452 9.95767 4.38203 12.2492 4.74199 14.8152Z",
    bg2: "M1.742 17.8152L2.62964 24.1428C2.92507 26.2488 4.72672 27.8153 6.85329 27.8153H25.1912C27.3243 27.8153 29.1293 26.2394 29.4172 24.1257L30.2788 17.7981C30.6275 15.2376 28.6369 12.9577 26.0528 12.9577H5.96565C3.37453 12.9577 1.38204 15.2492 1.742 17.8152Z",
    border2:
      "M26.0523 12.2467C29.0673 12.2467 31.3904 14.9073 30.9838 17.8946L30.1215 24.2213C29.7858 26.687 27.68 28.5263 25.1915 28.5265H6.85282C4.37224 28.5263 2.27045 26.6986 1.92557 24.2421L1.03842 17.9139C0.618465 14.9203 2.94269 12.2468 5.96566 12.2467H26.0523ZM5.96566 13.6685C3.80641 13.6685 2.14624 15.5785 2.4462 17.7169L3.33336 24.0435C3.57952 25.7983 5.08089 27.1046 6.85282 27.1049H25.1915C26.969 27.1047 28.4726 25.7909 28.7125 24.0297L29.5746 17.7015C29.8647 15.5679 28.2057 13.6685 26.0523 13.6685H5.96566Z",
  },
}

function SmallFolder({
  size,
  folderStyle,
  type,
  variant,
}: {
  size: Exclude<FolderSize, "lg">
  folderStyle: FolderStyle
  type: FolderType
  variant: FolderVariant
}) {
  const isStrong = variant === "strong"
  const paths = SMALL_FOLDER_PATHS[size]
  const outer = tok(folderStyle, "outer", isStrong)
  const inner = tok(folderStyle, "inner", isStrong)
  const outline = tok(folderStyle, "outline", isStrong)
  const files = tok(folderStyle, "files", isStrong)

  return (
    <svg
      width={paths.size}
      height={paths.size}
      viewBox={`0 0 ${paths.size} ${paths.size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="block shrink-0"
      aria-hidden="true"
    >
      <path d={paths.bg} fill={inner} />
      <path d={paths.border} fill={outline} />
      {type === "filled" && <path d={paths.occupiedBg} fill={files} />}
      <path d={paths.bg2} fill={outer} />
      <path d={paths.border2} fill={outline} />
    </svg>
  )
}

// ─── Large folder card (lg = 156 × 140px) ─────────────────────────────────────

const LARGE_TAB_PATH =
  "M16 35.1865C7.16344 35.1865 3.81321e-06 28.0231 2.61079e-06 19.1865L0 3.8147e-06L156 0V9.70556C156 18.5421 148.837 25.7056 140 25.7056H69.8875C67.7059 25.7056 65.5655 26.3003 63.6966 27.4259L53.667 33.4662C51.7981 34.5918 49.6577 35.1865 47.476 35.1865L16 35.1865Z"

const LARGE_TAB_STROKE_PATH =
  "M0 3.8147e-06L2.61079e-06 19.1865C3.81321e-06 28.0231 7.16344 35.1865 16 35.1865L47.476 35.1865C49.6577 35.1865 51.7981 34.5918 53.667 33.4662L63.6966 27.4259C65.5655 26.3003 67.7059 25.7056 69.8875 25.7056H140C148.837 25.7056 156 18.5421 156 9.70556V0L0 3.8147e-06Z"

const LARGE_FILES_PATH_1 =
  "M15.0773 1.72141C9.38955 0.788257 4.09252 4.84384 3.50957 10.5781L1.66735 28.6994C1.13283 33.9572 4.78186 38.7232 9.99708 39.5788L104.275 55.0464C109.963 55.9796 115.26 51.924 115.843 46.1898L117.685 28.0685C118.22 22.8106 114.571 18.0446 109.356 17.189L15.0773 1.72141Z"

const LARGE_FILES_STROKE_1 =
  "M117.685 28.0685L115.843 46.1898C115.26 51.924 109.963 55.9796 104.275 55.0464L9.99708 39.5788C4.78186 38.7232 1.13283 33.9572 1.66735 28.6994L3.50957 10.5781C4.09252 4.84384 9.38954 0.788257 15.0773 1.72141L109.356 17.189C114.571 18.0446 118.22 22.8106 117.685 28.0685Z"

const LARGE_FILES_PATH_2 =
  "M14.6374 6.18943C8.99371 5.46487 3.88366 9.58892 3.40019 15.2584L1.9583 32.167C1.5075 37.4534 5.26362 42.1716 10.5165 42.9174L105.344 56.3805C110.889 57.1677 115.999 53.2487 116.676 47.6897L118.882 29.5904C119.548 24.1329 115.682 19.162 110.229 18.4619L14.6374 6.18943Z"

const LARGE_FILES_STROKE_2 =
  "M118.882 29.5904L116.676 47.6897C115.999 53.2487 110.889 57.1677 105.344 56.3805L10.5165 42.9174C5.26362 42.1716 1.5075 37.4534 1.9583 32.167L3.40019 15.2584C3.88366 9.58892 8.99371 5.46487 14.6374 6.18943L110.229 18.4619C115.682 19.162 119.548 24.1329 118.882 29.5904Z"

function LargeFolder({
  folderStyle,
  type,
  variant,
  name,
  description,
  actions,
  className,
  style,
  ...props
}: {
  folderStyle: FolderStyle
  type: FolderType
  variant: FolderVariant
  name?: string
  description?: string
  actions?: React.ReactNode
  className?: string
  style?: React.CSSProperties
} & Omit<React.ComponentProps<"div">, "children">) {
  const uid = React.useId()
  const tabMaskId = `${uid}-tab-mask`
  const file1MaskId = `${uid}-file1-mask`
  const file2MaskId = `${uid}-file2-mask`

  const isStrong = variant === "strong"
  const outer = tok(folderStyle, "outer", isStrong)
  const inner = tok(folderStyle, "inner", isStrong)
  const outline = tok(folderStyle, "outline", isStrong)
  const files = tok(folderStyle, "files", isStrong)
  const fgPri = tok(folderStyle, "foreground-primary", isStrong)
  const fgSec = tok(folderStyle, "foreground-secondary", isStrong)

  return (
    <div
      data-slot="folder-illustration"
      data-size="lg"
      data-style={folderStyle}
      data-type={type}
      data-variant={variant}
      style={{ width: 156, height: 140, ...style }}
      className={cn(
        "relative flex items-end justify-end overflow-hidden pt-[16px]",
        className
      )}
      {...props}
    >
      {/* ── File opener - Before vector ── */}
      <div
        className="pointer-events-none absolute left-0 top-0 flex h-[35.187px] w-[156px] items-center justify-center"
        aria-hidden="true"
      >
        <div className="-scale-y-100 flex-none">
          <svg
            width={156}
            height={35.1865}
            viewBox="0 0 156 35.1865"
            fill="none"
            overflow="visible"
            className="block"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <mask id={tabMaskId} fill="white">
                <path d={LARGE_TAB_PATH} />
              </mask>
            </defs>
            <path d={LARGE_TAB_PATH} fill={inner} />
            <path
              d={LARGE_TAB_STROKE_PATH}
              strokeWidth={3}
              stroke={outline}
              mask={`url(#${tabMaskId})`}
            />
          </svg>
        </div>
      </div>

      {/* ── Occupied ── */}
      {type === "filled" && (
        <div
          className="pointer-events-none absolute right-[2px] top-[2px] flex h-[57.927px] w-[120.493px] items-center justify-center"
          aria-hidden="true"
        >
          <div className="-scale-y-100 rotate-180 flex-none">
            <svg
              width={120.493}
              height={57.9268}
              viewBox="0 0 120.493 57.9268"
              fill="none"
              overflow="visible"
              className="block"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <mask id={file1MaskId} fill="white">
                  <path d={LARGE_FILES_PATH_1} />
                </mask>
                <mask id={file2MaskId} fill="white">
                  <path d={LARGE_FILES_PATH_2} />
                </mask>
              </defs>
              <g>
                <path d={LARGE_FILES_PATH_1} fill={files} />
                <path
                  d={LARGE_FILES_STROKE_1}
                  strokeWidth={2}
                  stroke={outline}
                  mask={`url(#${file1MaskId})`}
                />
              </g>
              <g>
                <path d={LARGE_FILES_PATH_2} fill={files} />
                <path
                  d={LARGE_FILES_STROKE_2}
                  strokeWidth={2}
                  stroke={outline}
                  mask={`url(#${file2MaskId})`}
                />
              </g>
            </svg>
          </div>
        </div>
      )}

      {/* ── Container ── */}
      <div
        style={{
          backgroundColor: outer,
          borderColor: outline,
        }}
        className={cn(
          "relative flex h-full w-[156px] shrink-0 flex-col items-start justify-end",
          "border-[1.5px] border-solid",
          "rounded-[var(--token-dimension-radius-16,16px)]",
          "px-[var(--token-dimension-spacing-12,12px)]",
          "py-[var(--token-dimension-spacing-16,16px)]"
        )}
      >
        {/* ── action group ── */}
        <div className="flex w-full shrink-0 items-start justify-end">
          {actions ?? (
            <button
              type="button"
              aria-label="More options"
              className={cn(
                "flex size-[24px] shrink-0 items-center justify-center rounded-[var(--token-dimension-radius-full,99px)]",
                "transition-colors hover:bg-foreground/5"
              )}
            >
              <HugeiconsIcon
                icon={MoreHorizontalSquare01Icon}
                size={16}
                color={fgSec}
                strokeWidth={1.5}
              />
            </button>
          )}
        </div>

        {/* ── Content (Title + small text) ── */}
        <div className="flex min-h-px w-full flex-1 flex-col items-start justify-end gap-[var(--token-dimension-spacing-2,2px)]">
          {name && (
            <p
              className={cn(
                "w-full shrink-0 overflow-hidden text-ellipsis whitespace-nowrap",
                "font-[family-name:var(--token-typography-font-family-primary)]",
                "font-[number:var(--token-typography-font-weight-medium)]",
                "text-[14px] leading-[18px] tracking-[var(--token-typography-letter-spacing-normal,0px)] antialiased"
              )}
              style={{ color: fgPri }}
            >
              {name}
            </p>
          )}
          {description && (
            <p
              className={cn(
                "w-full shrink-0 overflow-hidden text-ellipsis whitespace-nowrap",
                "font-[family-name:var(--token-typography-font-family-primary)]",
                "font-[number:var(--token-typography-font-weight-regular)]",
                "text-[12px] leading-[16px] tracking-[var(--token-typography-letter-spacing-normal,0px)] antialiased"
              )}
              style={{ color: fgSec }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Public component ──────────────────────────────────────────────────────────

export interface FolderIllustrationProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  size?: FolderSize
  folderStyle?: FolderStyle
  type?: FolderType
  variant?: FolderVariant
  name?: string
  description?: string
  /** Custom actions node rendered instead of the default more-menu (lg only) */
  actions?: React.ReactNode
}

function FolderIllustration({
  size = "md",
  folderStyle = "grey",
  type = "empty",
  variant = "subtle",
  name,
  description,
  actions,
  className,
  style,
  ...props
}: FolderIllustrationProps) {
  if (size === "lg") {
    return (
      <LargeFolder
        folderStyle={folderStyle}
        type={type}
        variant={variant}
        name={name}
        description={description}
        actions={actions}
        className={className}
        style={style}
        {...props}
      />
    )
  }

  return (
    <span
      data-slot="folder-illustration"
      data-size={size}
      data-style={folderStyle}
      data-type={type}
      data-variant={variant}
      style={style}
      className={cn("inline-flex shrink-0", className)}
      aria-label="Folder"
      role="img"
    >
      <SmallFolder
        size={size}
        folderStyle={folderStyle}
        type={type}
        variant={variant}
      />
    </span>
  )
}

export { FolderIllustration }
