/**
 * Run this file from the terminal to test opening and closing the panel independently.
 *
 * Usage:
 *   npx tsx trigger-panel.ts open
 *   npx tsx trigger-panel.ts close
 */

const action = process.argv[2] || 'open'
const isOpen = action.toLowerCase() === 'open' || action.toLowerCase() === 'true'

fetch('http://127.0.0.1:3210/toggle-panel', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ isOpen })
})
  .then((res) => res.json())
  .then((data) => {
    console.log('✅ Successfully triggered panel:', data)
  })
  .catch((err) => {
    console.error('❌ Failed to trigger panel. Make sure the Electron app is running!')
    console.error(err.message)
  })
