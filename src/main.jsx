import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import DesktopOnlyGate from './components/DesktopOnlyGate'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DesktopOnlyGate>
      <App />
    </DesktopOnlyGate>
  </React.StrictMode>
)
