import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { TaskProvider } from './contexts/TaskContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './components/Toast'
import App from './App'
import './index.css'

// Phase 3.1 — react-query cache layer.
// One client for the whole app. Defaults tuned for an admin dashboard:
//   * `staleTime: 30s` — most data doesn't change within a page-to-page
//     navigation, so re-visits should hit the cache instead of refetching.
//   * `gcTime: 5min` — keep data around for a while after the last
//     observer unmounts, so quick back-navigation is instant.
//   * `refetchOnWindowFocus: false` — dashboards that refetch on every
//     alt-tab feel busy; we rely on explicit invalidation after mutations.
//   * `retry: 1` — one retry on transient failures, then surface the error.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Phase 4.4 — derive the router basename from Vite's BASE_URL so it
// can't drift from `vite.config.ts`'s `base`. BASE_URL always has a
// trailing slash; BrowserRouter's basename must not, so strip it.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={BASENAME}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <TaskProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </TaskProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
