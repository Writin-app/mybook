import type { Decorator, Preview } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'

import { Toaster } from '../src/components/ui/toast'
import { TooltipProvider } from '../src/components/ui/tooltip'
import '../src/styles/globals.css'
import './storybook.css'

const withAppShell: Decorator = (Story, context) => {
  const theme = context.globals.theme === 'dark' ? 'dark' : 'light'

  document.documentElement.dataset.theme = theme
  document.documentElement.classList.toggle('dark', theme === 'dark')

  const fullWidth = context.parameters.fullWidth === true

  return (
    <MemoryRouter initialEntries={['/home']}>
      <TooltipProvider>
        <main className={fullWidth ? "min-h-screen bg-background text-foreground" : "min-h-screen overflow-auto bg-background p-6 text-foreground"}>
          <div className={fullWidth ? "w-full min-w-0" : "mx-auto w-full max-w-5xl"}>
            <Story />
          </div>
        </main>
        <Toaster />
      </TooltipProvider>
    </MemoryRouter>
  )
}

const preview: Preview = {
  decorators: [withAppShell],
  globalTypes: {
    theme: {
      description: 'Application theme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    a11y: {
      test: 'todo',
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'fullscreen',
  },
}

export default preview
