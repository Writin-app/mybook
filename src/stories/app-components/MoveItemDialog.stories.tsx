import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { MoveItemDialog } from '@/components/files/MoveItemDialog'
import { Button } from '@/components/ui/button'
import type { MyBookFolder } from '@/types/files'

const folders: MyBookFolder[] = [
  {
    id: 'private',
    driveFolderId: null,
    name: 'Private',
    parentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isDeleted: false,
  },
  {
    id: 'projects',
    driveFolderId: null,
    name: 'Projects',
    parentId: 'private',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isDeleted: false,
  },
  {
    id: 'archive',
    driveFolderId: null,
    name: 'Archive',
    parentId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isDeleted: false,
  },
]

const meta = { title: 'App Components/Move Item Dialog' } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

function MoveItemDialogExample() {
  const [isOpen, setIsOpen] = useState(true)
  const [message, setMessage] = useState('')
  const [storyFolders, setStoryFolders] = useState(folders)

  return (
    <div className="grid gap-4">
      <Button type="button" onClick={() => setIsOpen(true)}>Open move dialog</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <MoveItemDialog
        isOpen={isOpen}
        itemKind="file"
        itemName="Meeting notes.md"
        folders={storyFolders}
        onClose={() => setIsOpen(false)}
        onMove={async (folderId) => {
          const destination = folderId ? storyFolders.find((folder) => folder.id === folderId)?.name ?? 'Folder' : 'Writin root'
          setMessage(`Moved to ${destination}`)
          return { success: true }
        }}
        onCreateFolder={async (name, parentId) => {
          const now = new Date().toISOString()
          const folder: MyBookFolder = {
            id: crypto.randomUUID(),
            driveFolderId: null,
            name: name.trim(),
            parentId,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
          }
          setStoryFolders((current) => [...current, folder])
          return { success: true, data: folder }
        }}
      />
    </div>
  )
}

export const Default: Story = { render: () => <MoveItemDialogExample /> }

export const MovingAFolder: Story = {
  render: () => (
    <MoveItemDialog
      isOpen
      itemKind="folder"
      itemName="Projects"
      folders={folders}
      disabledFolderIds={['private', 'projects']}
      onClose={() => undefined}
      onMove={async () => ({ success: true })}
      onCreateFolder={async () => ({ success: false, error: 'Not implemented in this example.' })}
    />
  ),
}
