import type { Key, ReactNode } from 'react'
import { createContext, useContext } from 'react'

import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

type Placement = 'bottom end' | 'bottom start' | 'bottom' | 'top end' | 'top start' | 'top'

const DropdownActionContext = createContext<((key: Key) => void) | null>(null)

function getPlacement(placement: Placement = 'bottom start') {
  const [side, align] = placement.split(' ')
  return {
    side: side === 'top' ? 'top' as const : 'bottom' as const,
    align: align === 'end' ? 'end' as const : 'start' as const,
  }
}

function Root({ children }: { children: ReactNode }) {
  return <DropdownMenu>{children}</DropdownMenu>
}

function Trigger({
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuTrigger>) {
  return <DropdownMenuTrigger {...props}>{children}</DropdownMenuTrigger>
}

export interface DropdownPopoverProps {
  children: ReactNode
  placement?: Placement
  bottomSheet?: boolean
  mobileBottomSheet?: boolean
  className?: string
  style?: React.CSSProperties
}

function Popover({
  children,
  placement = 'bottom start',
  bottomSheet,
  mobileBottomSheet = true,
  className,
  style,
}: DropdownPopoverProps) {
  const isMobile = useIsMobile()
  const effectiveBottomSheet = bottomSheet ?? (mobileBottomSheet ? isMobile : false)
  const { side, align } = getPlacement(placement)
  return (
    <DropdownMenuContent
      side={side}
      align={align}
      bottomSheet={effectiveBottomSheet}
      className={cn(!effectiveBottomSheet && 'w-auto min-w-48', className)}
      style={style}
    >
      {children}
    </DropdownMenuContent>
  )
}

function Menu({
  children,
  onAction,
}: {
  children: ReactNode
  'aria-label'?: string
  onAction?: (key: Key) => void
}) {
  return (
    <DropdownActionContext.Provider value={onAction ?? null}>
      {children}
    </DropdownActionContext.Provider>
  )
}

export interface DropdownItemProps
  extends Omit<React.ComponentProps<typeof DropdownMenuItem>, 'id' | 'disabled' | 'variant'> {
  children: ReactNode
  id: Key
  isDisabled?: boolean
  variant?: 'default' | 'danger'
}

function Item({
  children,
  id,
  isDisabled = false,
  variant = 'default',
  ...props
}: DropdownItemProps) {
  const onAction = useContext(DropdownActionContext)

  return (
    <DropdownMenuItem
      disabled={isDisabled}
      variant={variant === 'danger' ? 'destructive' : 'default'}
      onClick={() => onAction?.(id)}
      {...props}
    >
      {children}
    </DropdownMenuItem>
  )
}

export const Dropdown = Object.assign(Root, {
  Trigger,
  Popover,
  Menu,
  Item,
})
