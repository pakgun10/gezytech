import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return (
    <div style={{ padding: 40, fontFamily: 'system-ui' }}>
      <h1>GezyTech Public</h1>
      <p>PUB-00: Scaffolding berhasil ✅</p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
