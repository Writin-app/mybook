export function matchesEditorMenuShortcut(
  event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'code'>,
  key: 'd' | 'm',
  isMacPlatform: boolean,
) {
  const hasRequiredModifiers = isMacPlatform
    ? event.metaKey && event.ctrlKey && !event.altKey
    : event.ctrlKey && event.altKey && !event.metaKey
  return (
    hasRequiredModifiers &&
    !event.shiftKey &&
    event.code === `Key${key.toUpperCase()}`
  )
}
