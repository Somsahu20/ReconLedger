import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'

const navItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Upload', to: '/upload' },
  { label: 'Invoices', to: '/invoices' },
  { label: 'Review', to: '/review' },
  { label: 'Ask ReconLedger', to: '/query' },
  { label: 'Reconciliation', to: '/reconciliation' },
  { label: 'Profile', to: '/profile' },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme(user?.id)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuId = 'mobile-primary-nav'

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    window.addEventListener('keydown', onEscape)
    return () => {
      window.removeEventListener('keydown', onEscape)
    }
  }, [])

  async function handleLogout() {
    await logout()
    toast.success('You have been logged out')
    setMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-(--brand) px-3 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-20 border-b border-(--line) bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="text-lg font-extrabold tracking-tight text-(--brand-ink)">
            ReconLedger
          </div>

          <nav aria-label="Primary" className="hidden gap-2 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand) focus-visible:ring-offset-2 ${
                    isActive
                      ? 'bg-(--brand) text-white'
                      : 'text-(--muted) hover:bg-(--surface-soft) hover:text-(--ink)'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            className="inline-flex rounded-full border border-(--line) p-2 text-(--ink) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand) focus-visible:ring-offset-2 md:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls={mobileMenuId}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 rounded-full border border-(--line) px-3 py-1.5 text-sm font-semibold text-(--ink) transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand) focus-visible:ring-offset-2"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <span className="max-w-48 truncate text-sm font-medium text-(--muted)">
              {user?.full_name}
            </span>
            <button
              type="button"
              onClick={() => {
                void handleLogout()
              }}
              className="rounded-full border border-(--line) px-3 py-1.5 text-sm font-semibold text-(--ink) transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand) focus-visible:ring-offset-2"
            >
              Logout
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="border-t border-(--line) bg-white px-4 py-3 md:hidden"
            >
              <nav id={mobileMenuId} aria-label="Mobile" className="grid gap-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand) focus-visible:ring-offset-2 ${
                        isActive
                          ? 'bg-(--brand) text-white'
                          : 'text-(--muted) hover:bg-(--surface-soft) hover:text-(--ink)'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-(--line) bg-slate-50 px-3 py-2">
                <span className="truncate text-sm font-medium text-(--muted)">{user?.full_name}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="inline-flex items-center gap-1 rounded-md border border-(--line) bg-white px-2 py-1 text-xs font-semibold text-(--ink) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand) focus-visible:ring-offset-2"
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    {theme === 'dark' ? 'Light' : 'Dark'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleLogout()
                    }}
                    className="rounded-md border border-(--line) bg-white px-2.5 py-1 text-xs font-semibold text-(--ink) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand) focus-visible:ring-offset-2"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
