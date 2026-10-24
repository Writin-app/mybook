// Mod is Cmd on Mac and Ctrl elsewhere.
export function matchesEditorMenuShortcut(
  event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'code'>,
  key: 'd' | 'm',
  isMacPlatform: boolean,
) {
  const hasMod = isMacPlatform
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
  return (
    hasMod &&
    event.shiftKey &&
    !event.altKey &&
    event.code === `Key${key.toUpperCase()}`
  )
}
