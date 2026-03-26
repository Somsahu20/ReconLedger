import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CalendarRange, ChevronLeft, ChevronRight, SlidersHorizontal, Search, FileText, LoaderCircle } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { listInvoices } from '../api/invoices'
import { InvoicesScene } from '../components/three/InvoicesScene'
import { formatCurrency, formatDate, toStatusLabel } from '../lib/formatters'
import { PageShell } from './PageShell'

const listContainer = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
}

function normalizeStatus(status: string) {
  const lower = status.toLowerCase()
  if (lower === 'clean') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
  if (lower === 'reviewed') return 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-[0_0_10px_rgba(14,165,233,0.1)]'
  return 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
}

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return parsed
}

export function InvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('q') ?? ''
  const status = searchParams.get('status') ?? 'all'
  const page = parsePositiveInt(searchParams.get('page'), 1)
  const perPage = parsePositiveInt(searchParams.get('perPage'), 10)

  const [searchInput, setSearchInput] = useState(search)
  const [dateRangeUi, setDateRangeUi] = useState('all')
  const [sortUi, setSortUi] = useState('processed_desc')

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput === search) return
      const nextParams = new URLSearchParams(searchParams)
      if (searchInput.trim()) {
        nextParams.set('q', searchInput.trim())
      } else {
        nextParams.delete('q')
      }
      nextParams.set('page', '1')
      setSearchParams(nextParams)
    }, 320)

    return () => clearTimeout(timeout)
  }, [search, searchInput, searchParams, setSearchParams])

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['invoices', 'list', search, status, page, perPage],
    queryFn: () =>
      listInvoices({
        search,
        status,
        page,
        perPage,
      }),
  })

  const totalPages = useMemo(() => {
    const fromServer = data?.total_pages ?? 1
    return fromServer > 0 ? fromServer : 1
  }, [data?.total_pages])

  const totalInvoices = data?.total ?? 0

  function updateParam(key: string, value: string | null) {
    const nextParams = new URLSearchParams(searchParams)
    if (value && value.length > 0) nextParams.set(key, value)
    else nextParams.delete(key)
    setSearchParams(nextParams)
  }

  function updateStatus(nextStatus: string) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('status', nextStatus)
    nextParams.set('page', '1')
    setSearchParams(nextParams)
  }

  function updatePerPage(nextPerPage: number) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('perPage', String(nextPerPage))
    nextParams.set('page', '1')
    setSearchParams(nextParams)
  }

  function goToPage(nextPage: number) {
    const boundedPage = Math.min(Math.max(1, nextPage), totalPages)
    updateParam('page', String(boundedPage))
  }

  const hasRows = (data?.invoices.length ?? 0) > 0

  const selectClasses = "w-full appearance-none rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white/90 outline-none ring-1 ring-transparent focus:ring-(--brand)/50 transition-all cursor-pointer hover:bg-white/10 backdrop-blur-md"
  
  return (
    <div className="relative min-h-[calc(100vh-(--spacing(16)))] pb-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-indigo-900/10 via-[#070d1f] to-[#070d1f]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-900/10 blur-[120px]" />
      <InvoicesScene />
      
      <motion.div
        initial="initial"
        animate="animate"
        variants={listContainer}
        transition={{ duration: 0.26 }}
        className="space-y-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8"
      >
        <PageShell
          title="Ledger Explorer"
          description="Search and filter invoices, browse paginated results, and open full invoice details for deeper review."
        >
          <div className="space-y-6">
            <div className="grid gap-4 rounded-[2rem] border border-white/5 bg-white/[0.02] shadow-[0_8px_32px_rgba(0,0,0,0.2)] p-5 md:grid-cols-2 xl:grid-cols-5 backdrop-blur-2xl relative overflow-hidden">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent" />
              
              <div className="relative z-10 xl:col-span-2">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-(--muted)">Search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--muted)" />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Vendor name, invoice #, etc"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white outline-none ring-1 ring-transparent transition-all placeholder:text-white/30 focus:bg-white/10 focus:ring-(--brand)/50"
                  />
                </div>
              </div>

              <div className="relative z-10">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-(--muted)">Status Filter</span>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-slate-400" />
                  </div>
                  <select
                    value={status}
                    onChange={(event) => updateStatus(event.target.value)}
                    className={selectClasses}
                  >
                    <option value="all" className="bg-[#0f172a] text-white">All Signals</option>
                    <option value="CLEAN" className="bg-[#0f172a] text-emerald-400">Clean</option>
                    <option value="FLAGGED" className="bg-[#0f172a] text-amber-400">Flagged</option>
                    <option value="REVIEWED" className="bg-[#0f172a] text-sky-400">Reviewed</option>
                  </select>
                </div>
              </div>

              <div className="relative z-10">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-(--muted)">Timeframe</span>
                <div className="relative">
                  <CalendarRange className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--muted)" />
                  <select
                    value={dateRangeUi}
                    onChange={(event) => setDateRangeUi(event.target.value)}
                    className={selectClasses}
                    title="UI placeholder for future backend date filtering"
                  >
                    <option value="all" className="bg-[#0f172a]">All Time</option>
                    <option value="7d" className="bg-[#0f172a]">Trailing 7 Days</option>
                    <option value="30d" className="bg-[#0f172a]">Trailing 30 Days</option>
                    <option value="quarter" className="bg-[#0f172a]">Current Quarter</option>
                  </select>
                </div>
              </div>

              <div className="relative z-10">
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-(--muted)">Sort Vector</span>
                <div className="relative">
                  <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--muted)" />
                  <select
                    value={sortUi}
                    onChange={(event) => setSortUi(event.target.value)}
                    className={selectClasses}
                    title="UI placeholder for future backend sort controls"
                  >
                    <option value="processed_desc" className="bg-[#0f172a]">Latest Intake</option>
                    <option value="date_desc" className="bg-[#0f172a]">Date (Newest)</option>
                    <option value="date_asc" className="bg-[#0f172a]">Date (Oldest)</option>
                    <option value="amount_desc" className="bg-[#0f172a]">Value (High-Low)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-[13px] text-white/50">
              <p className="font-medium tracking-wide">
                {isFetching ? (
                  <span className="flex items-center gap-2"><LoaderCircle className="h-3.5 w-3.5 animate-spin text-(--brand)" /> Syncing data...</span>
                ) : (
                  <>Showing {data?.invoices.length ?? 0} of <span className="text-white/80">{totalInvoices}</span> unified records</>
                )}
              </p>
              <div className="flex items-center gap-3">
                <span>Density</span>
                <select
                  value={perPage}
                  onChange={(event) => updatePerPage(Number(event.target.value))}
                  className="rounded-lg border border-white/10 bg-white/5 py-1 pl-2 pr-6 text-xs text-white outline-none ring-1 ring-transparent focus:ring-(--brand)/50 appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em' }}
                >
                  <option value={10} className="bg-[#0f172a]">10 rows</option>
                  <option value={20} className="bg-[#0f172a]">20 rows</option>
                  <option value={50} className="bg-[#0f172a]">50 rows</option>
                </select>
              </div>
            </div>

            {isLoading && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <div key={index} className="h-32 animate-pulse rounded-[1.5rem] bg-white/5 ring-1 ring-white/10" />
                ))}
              </div>
            )}

            {isError && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200 backdrop-blur-md">
                <p className="font-semibold mb-2">Network Error: Could not synchronize ledger data.</p>
                <button
                  type="button"
                  onClick={() => {
                    void refetch()
                  }}
                  className="rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors px-4 py-2 text-xs font-semibold text-white"
                >
                  Re-attempt Connection
                </button>
              </div>
            )}

            {!isLoading && !isError && !hasRows && (
              <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-12 text-center ring-1 ring-white/5 shadow-inner backdrop-blur-xl">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-(--muted) mb-5">
                  <FileText className="h-8 w-8" />
                </div>
                <p className="text-xl font-light tracking-tight text-white">Data lake is empty</p>
                <p className="mt-2 text-sm text-(--muted) max-w-sm mx-auto">Upload an invoice definition or clear active search vectors to view data.</p>
                <Link
                  to="/upload"
                  className="mt-6 inline-flex rounded-xl bg-(--brand) px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all"
                >
                  Ingest Invoice
                </Link>
              </div>
            )}

            {!isLoading && !isError && hasRows && (
              <>
                <div className="hidden overflow-hidden rounded-[2rem] bg-white/[0.02] ring-1 ring-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-2xl md:block">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-white/[0.02] text-[11px] font-bold uppercase tracking-widest text-(--muted) border-b border-white/10">
                        <tr>
                          <th className="px-5 py-4 font-medium">Invoice Reference</th>
                          <th className="px-5 py-4 font-medium">Vendor Target</th>
                          <th className="px-5 py-4 font-medium">Document Date</th>
                          <th className="px-5 py-4 font-medium">Recorded Value</th>
                          <th className="px-5 py-4 font-medium">System State</th>
                          <th className="px-5 py-4 font-medium">Intake Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {data?.invoices.map((invoice) => {
                          const statusLabel = toStatusLabel(invoice.status)
                          return (
                            <motion.tr
                              key={invoice.id}
                              whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
                              className="transition-colors group"
                            >
                              <td className="px-5 py-4">
                                <Link 
                                  to={`/invoices/${encodeURIComponent(invoice.invoice_number)}`} 
                                  className="font-medium text-white transition-colors hover:text-(--brand)"
                                >
                                  {invoice.invoice_number}
                                </Link>
                              </td>
                              <td className="px-5 py-4 text-white/90 group-hover:text-white transition-colors">
                                {invoice.vendor_name}
                              </td>
                              <td className="px-5 py-4 text-(--muted) text-[13px]">
                                {formatDate(invoice.date)}
                              </td>
                              <td className="px-5 py-4 font-mono text-[13px] text-white">
                                {formatCurrency(invoice.grand_total, invoice.currency)}
                              </td>
                              <td className="px-5 py-4">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ${normalizeStatus(statusLabel)}`}>
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-(--muted) text-[13px]">
                                {formatDate(invoice.processed_at)}
                              </td>
                            </motion.tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid gap-3 md:hidden">
                  {data?.invoices.map((invoice) => {
                    const statusLabel = toStatusLabel(invoice.status)
                    return (
                      <motion.div
                        key={invoice.id}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className="rounded-[1.5rem] bg-white/[0.03] p-5 ring-1 ring-white/10 backdrop-blur-md"
                      >
                        <div className="flex items-start justify-between gap-2 mb-4">
                          <div>
                            <Link
                              to={`/invoices/${encodeURIComponent(invoice.invoice_number)}`}
                              className="text-base font-medium text-white transition-colors hover:text-(--brand)"
                            >
                              {invoice.invoice_number}
                            </Link>
                            <p className="mt-1 text-[13px] text-(--muted)">{invoice.vendor_name}</p>
                          </div>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ${normalizeStatus(statusLabel)}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[13px] border-t border-white/5 pt-3">
                          <span className="text-(--muted)">{formatDate(invoice.date)}</span>
                          <span className="font-mono text-white text-sm">{formatCurrency(invoice.grand_total, invoice.currency)}</span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/[0.02] ring-1 ring-white/10 px-5 py-3.5 text-sm backdrop-blur-md">
                  <p className="text-(--muted) text-[13px] font-medium tracking-wide">
                    Vector Range <span className="text-white mx-1">{page}</span> of <span className="text-white mx-1">{totalPages}</span>
                  </p>
                  <div className="inline-flex items-center gap-2">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => goToPage(page - 1)}
                      disabled={page <= 1}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors px-3 py-1.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white/5"
                    >
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </motion.button>

                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => goToPage(page + 1)}
                      disabled={page >= totalPages}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors px-3 py-1.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white/5"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </motion.button>
                  </div>
                </div>
              </>
            )}
          </div>
        </PageShell>
      </motion.div>
    </div>
  )
}
