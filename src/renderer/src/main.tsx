import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './assets/main.css'

if (new URLSearchParams(window.location.search).get('view') !== 'control-centre') {
  document.body.classList.add('overlay')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
