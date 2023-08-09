import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

import path from 'path'

const executablePath = path.resolve(__dirname, "..", "node_modules", ".bin", "electron")

test('electron app', async () => {
  const electronApp = await electron.launch({
    args: ['.'],
    cwd: __dirname,
    executablePath
  })

  const window = await electronApp.firstWindow()

  // Compare screenshots of the start screen
  expect(await window.screenshot()).toMatchSnapshot({name: 'landing.png'})

  // close app
  await electronApp.close()
})
