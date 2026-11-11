import { expect, test, type Page } from '@playwright/test'

async function openNewDocument(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('mybook-auth', JSON.stringify({
      state: {
        isAuthenticated: true,
        email: 'tester@example.com',
        accessToken: 'test-token',
        accessTokenExpiresAt: Date.now() + 3_600_000,
      },
      version: 0,
    }))
  })
  await page.route('https://www.googleapis.com/**', async (route) => {
    const request = route.request()
    const root = { id: 'test-drive-root', name: 'Writin', mimeType: 'application/vnd.google-apps.folder', trashed: false }
    if (request.method() === 'GET') {
      const data = new URL(request.url()).pathname.endsWith('/test-drive-root') ? root : { files: [] }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(root) })
    }
  })
  await page.goto('/home')
  await page.getByRole('button', { name: 'Add new' }).click()
  await page.getByRole('menuitem', { name: 'Document', exact: true }).click()
}

test('desktop counts update in More menu and More has no Writing Assistant or Proofread entry', async ({ page }) => {
  await openNewDocument(page)
  const editor = page.locator('.tiptap[contenteditable="true"]')
  await editor.fill('Quick sample text for rewrite.')

  await page.getByRole('button', { name: 'More actions' }).click()
  await expect(page.getByRole('menu', { name: 'More actions' })).toBeVisible()

  await expect(page.getByRole('status', { name: 'Document word and character count' }))
    .toContainText('5 words')
  await expect(page.getByRole('status', { name: 'Document word and character count' }))
    .toContainText('30 characters')

  await expect(page.getByRole('menu').getByText('Writing Assistant')).toHaveCount(0)
  await expect(page.getByRole('menu').getByText('Proofread')).toHaveCount(0)
})

test.describe('mobile AI toolbar', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  test('opens the same selection actions from the action toolbar and selection pill', async ({ page }) => {
    await openNewDocument(page)
    const editor = page.locator('.tiptap[contenteditable="true"]')
    await editor.fill('Quick sample text for rewrite.')
    const paragraph = editor.locator('p')
    await paragraph.click()
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+End')

    const selectionPill = page.getByRole('button', { name: 'Writin Assist', exact: true })
    const actionToolbar = page.getByRole('button', { name: 'Writin Assist', exact: true })
    await expect(selectionPill).toBeVisible()
    await expect(actionToolbar).toBeVisible()

    await actionToolbar.click()
    await expect(page.getByRole('dialog', { name: 'Writin Assist' })).toBeVisible()
    for (const label of ['Rewrite', 'Summarize', 'Adjust…', 'Write with Writin Assist…', 'Translate']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }

    await page.keyboard.press('Escape')
    await selectionPill.click()
    await expect(page.getByRole('dialog', { name: 'Writin Assist' })).toBeVisible()
  })
})
