import { createContext, useContext } from 'react'

interface WorkspacePaneContextValue {
  paneId: string
}

const WorkspacePaneContext = createContext<WorkspacePaneContextValue>({ paneId: 'primary' })

export const WorkspacePaneProvider = WorkspacePaneContext.Provider

export function useWorkspacePane(): WorkspacePaneContextValue {
  return useContext(WorkspacePaneContext)
}
