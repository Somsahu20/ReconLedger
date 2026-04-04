import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuId = 'mobile-primary-nav'

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
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

      <header className="sticky top-0 z-50 border-b border-white/5 bg-white/[0.02] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-gradient-to-br from-(--brand) to-indigo-500 shadow-[0_0_10px_var(--brand)]" />
            Recon<span className="font-light text-(--muted)">Ledger</span>
          </div>

          <nav aria-label="Primary" className="hidden lg:flex items-center gap-1 xl:gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand) focus-visible:ring-offset-2 ${
                    isActive
                      ? 'text-white bg-white/10 shadow-inner ring-1 ring-white/10'
                      : 'text-(--muted) hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            className="inline-flex rounded-lg border border-white/10 bg-white/5 p-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand) lg:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls={mobileMenuId}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="hidden items-center gap-4 lg:flex">
            <span className="max-w-32 truncate text-[13px] font-medium text-(--muted)">
              {user?.full_name}
            </span>
            <button
              type="button"
              onClick={() => { void handleLogout() }}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand)"
            >
              Logout
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-0 top-full border-b border-white/10 bg-[#070d1f]/95 backdrop-blur-2xl px-4 py-4 lg:hidden shadow-2xl"
            >
              <nav id={mobileMenuId} aria-label="Mobile" className="grid gap-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `rounded-xl px-4 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand) ${
                        isActive
                          ? 'bg-white/10 text-white ring-1 ring-white/10'
                          : 'text-(--muted) hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="truncate text-sm font-medium text-white">{user?.full_name}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { void handleLogout() }}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand)"
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
