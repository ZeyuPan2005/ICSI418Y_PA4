// Vite loads this entry point from index.html to start React in the browser.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// createRoot gives React control of the root HTML element; render displays the component tree.
// <App /> is our top-level component, and StrictMode adds development checks.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
