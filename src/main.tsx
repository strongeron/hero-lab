// First: wraps getContext and starts the buffered perf observers before any
// shader mounts. See src/lab/perfMonitor.ts.
import './lab/perfMonitor'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import HeroLab from './lab/HeroLab'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HeroLab />
  </StrictMode>,
)
