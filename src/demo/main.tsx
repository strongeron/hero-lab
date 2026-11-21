// Deliberately does not import ../index.css: no lab fonts, no Tailwind.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import DitherBackgroundDemo from './DitherBackgroundDemo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DitherBackgroundDemo />
  </StrictMode>,
)
