import { useState } from 'react'

export function useRegisterSW() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const updateServiceWorker = async () => undefined
  return {
    needRefresh: [needRefresh, setNeedRefresh] as [boolean, React.Dispatch<React.SetStateAction<boolean>>],
    offlineReady: [offlineReady, setOfflineReady] as [boolean, React.Dispatch<React.SetStateAction<boolean>>],
    updateServiceWorker,
  }
}
