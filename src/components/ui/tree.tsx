import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

function Tree({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="tree"
      data-slot="tree"
      className={cn('flex flex-col gap-1', className)}
      {...props}
    />
  )
}

function TreeItem({
  className,
  selected = false,
  ...props
}: ComponentProps<'div'> & { selected?: boolean }) {
  return (
    <div
      role="treeitem"
      aria-selected={selected}
      data-slot="tree-item"
      data-selected={selected || undefined}
      className={cn(
        'min-w-0 rounded-lg px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      {...props}
    />
  )
}

export { Tree, TreeItem }
