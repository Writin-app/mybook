// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { rowGripMenuTop, tableMenuTop } from './tableMenuPosition'

describe('tableMenuTop', () => {
  it('uses the measured menu height when opening above a bottom row grip', () => {
    expect(tableMenuTop(700, 718, 300)).toBe(392)
  })

  it('flips above when constrained by a keyboard-reduced viewportHeight', () => {
    // 400px visible height (e.g. mobile with keyboard open)
    expect(tableMenuTop(232, 250, 150, 8, 8, 400)).toBe(74)
  })

  it('clamps to minTop when neither above nor below fits', () => {
    expect(tableMenuTop(20, 38, 380, 8, 8, 300)).toBe(8)
  })
})

describe('rowGripMenuTop', () => {
  it('anchors directly to the grip icon top when there is room below', () => {
    expect(rowGripMenuTop(200, 218, 250)).toBe(200)
  })

  it('anchors to the grip icon bottom when near the bottom of the viewport', () => {
    expect(rowGripMenuTop(700, 718, 300)).toBe(418)
  })

  it('anchors above when constrained by a smaller viewportHeight with keyboard open', () => {
    // gripTop 220, gripBottom 238, menuHeight 180, viewportHeight 380 -> 220 + 180 = 400 > 380 - 8 (372)
    // 238 - 180 = 58 >= 8 -> returns 58
    expect(rowGripMenuTop(220, 238, 180, 8, 8, 380)).toBe(58)
  })
})