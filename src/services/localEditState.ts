type UnsavedEditsProbe = () => boolean
type UnsavedEditsFlush = () => Promise<void> | void

const probes = new Map<string, UnsavedEditsProbe>()
const flushHandlers = new Map<string, UnsavedEditsFlush>()

// The open editor registers a probe so the sync layer can ask, without timing
// heuristics, whether the user holds edits that are not persisted yet.
export function registerUnsavedEditsProbe(fileId: string, probe: UnsavedEditsProbe) {
  probes.set(fileId, probe)
  return () => {
    if (probes.get(fileId) === probe) probes.delete(fileId)
  }
}

export function registerUnsavedEditsFlush(fileId: string, flush: UnsavedEditsFlush) {
  flushHandlers.set(fileId, flush)
  return () => {
    if (flushHandlers.get(fileId) === flush) flushHandlers.delete(fileId)
  }
}

export function hasUnsavedLocalEdits(fileId: string) {
  return probes.get(fileId)?.() ?? false
}

export function hasAnyUnsavedLocalEdits() {
  for (const probe of probes.values()) {
    try {
      if (probe()) return true
    } catch {
      // Ignore probe evaluation errors
    }
  }
  return false
}

export async function flushAllUnsavedEdits() {
  const tasks = Array.from(flushHandlers.values()).map(async (flush) => {
    try {
      await flush()
    } catch {
      // Catch individual flush errors to allow other editors to persist
    }
  })
  await Promise.all(tasks)
}
