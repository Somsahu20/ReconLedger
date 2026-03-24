import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CalendarRange, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
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
  if (lower === 'clean') return 'bg-emerald-100 text-emerald-800'
  if (lower === 'reviewed') return 'bg-sky-100 text-sky-800'
  return 'bg-amber-100 text-amber-800'
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

  return (
    <div className="relative">
      <InvoicesScene />
      <motion.div
        initial="initial"
        animate="animate"
        variants={listContainer}
        transition={{ duration: 0.26 }}
        className="space-y-6"
      >
        <PageShell
          title="Invoice Explorer"
          description="Search and filter invoices, browse paginated results, and open full invoice details for deeper review."
        >
          <div className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-(--line) bg-white/90 p-3.5 md:grid-cols-2 xl:grid-cols-5">
              <label className="xl:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-(--muted)">Search</span>
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Vendor or invoice number"
                  className="w-full rounded-xl border border-(--line) bg-white px-3 py-2 text-sm text-(--ink) outline-none ring-(--brand)/25 transition focus:ring"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-(--muted)">Status</span>
                <select
                  value={status}
                  onChange={(event) => updateStatus(event.target.value)}
                  className="w-full rounded-xl border border-(--line) bg-white px-3 py-2 text-sm text-(--ink)"
                >
                  <option value="all">All</option>
                  <option value="CLEAN">Clean</option>
                  <option value="FLAGGED">Flagged</option>
                  <option value="REVIEWED">Reviewed</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-(--muted)">Date Range</span>
                <div className="relative">
                  <CalendarRange className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-(--muted)" />
                  <select
                    value={dateRangeUi}
                    onChange={(event) => setDateRangeUi(event.target.value)}
                    className="w-full rounded-xl border border-(--line) bg-slate-50 py-2 pl-9 pr-3 text-sm text-(--muted)"
                    title="UI placeholder for future backend date filtering"
                  >
                    <option value="all">All time (UI only)</option>
                    <option value="7d">Last 7 days (UI only)</option>
                    <option value="30d">Last 30 days (UI only)</option>
                    <option value="quarter">This quarter (UI only)</option>
                  </select>
                </div>
              </label>

              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-(--muted)">Sort</span>
                <div className="relative">
                  <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-(--muted)" />
                  <select
                    value={sortUi}
                    onChange={(event) => setSortUi(event.target.value)}
                    className="w-full rounded-xl border border-(--line) bg-slate-50 py-2 pl-9 pr-3 text-sm text-(--muted)"
                    title="UI placeholder for future backend sort controls"
                  >
                    <option value="processed_desc">Latest processed (UI only)</option>
                    <option value="date_desc">Invoice date descending (UI only)</option>
                    <option value="date_asc">Invoice date ascending (UI only)</option>
                    <option value="amount_desc">Amount high to low (UI only)</option>
                  </select>
                </div>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2 text-xs text-(--muted)">
              <p>
                {isFetching ? 'Refreshing...' : `Showing ${data?.invoices.length ?? 0} of ${totalInvoices} invoices`}
              </p>
              <label className="inline-flex items-center gap-2">
                Rows per page
                <select
                  value={perPage}
                  onChange={(event) => updatePerPage(Number(event.target.value))}
                  className="rounded-lg border border-(--line) bg-white px-2 py-1 text-xs text-(--ink)"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                </select>
              </label>
            </div>

            {isLoading && (
              <div className="grid gap-3 md:grid-cols-2">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="h-22 animate-pulse rounded-2xl border border-(--line) bg-white/80" />
                ))}
              </div>
            )}

            {isError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p className="font-semibold">Could not fetch invoices.</p>
                <button
                  type="button"
                  onClick={() => {
                    void refetch()
                  }}
                  className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Retry
                </button>
              </div>
            )}

            {!isLoading && !isError && !hasRows && (
              <div className="rounded-2xl border border-(--line) bg-white p-6 text-center">
                <p className="text-lg font-semibold text-(--ink)">No invoices found</p>
                <p className="mt-1 text-sm text-(--muted)">Try clearing filters or upload a fresh invoice.</p>
                <Link
                  to="/upload"
                  className="mt-4 inline-flex rounded-xl bg-(--brand) px-4 py-2 text-sm font-semibold text-white"
                >
                  Go to Upload
                </Link>
              </div>
            )}

            {!isLoading && !isError && hasRows && (
              <>
                <div className="hidden overflow-hidden rounded-2xl border border-(--line) bg-white md:block">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-(--muted)">
                      <tr>
                        <th className="px-4 py-3">Invoice #</th>
                        <th className="px-4 py-3">Vendor</th>
                        <th className="px-4 py-3">Invoice Date</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Processed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.invoices.map((invoice) => {
                        const statusLabel = toStatusLabel(invoice.status)
                        return (
                          <motion.tr
                            key={invoice.id}
                            className="border-t border-(--line)"
                            whileHover={{ backgroundColor: 'rgba(248, 250, 252, 0.95)' }}
                            whileTap={{ backgroundColor: 'rgba(241, 245, 249, 0.95)' }}
                            transition={{ duration: 0.16 }}
                          >
                            <td className="px-4 py-3 font-semibold text-(--ink)">
                              <Link to={`/invoices/${encodeURIComponent(invoice.invoice_number)}`} className="hover:underline">
                                {invoice.invoice_number}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-(--ink)">{invoice.vendor_name}</td>
                            <td className="px-4 py-3 text-(--muted)">{formatDate(invoice.date)}</td>
                            <td className="px-4 py-3 font-semibold text-(--ink)">
                              {formatCurrency(invoice.grand_total, invoice.currency)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${normalizeStatus(statusLabel)}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-(--muted)">{formatDate(invoice.processed_at)}</td>
                          </motion.tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 md:hidden">
                  {data?.invoices.map((invoice) => {
                    const statusLabel = toStatusLabel(invoice.status)
                    return (
                      <motion.div
                        key={invoice.id}
                        whileHover={{ y: -1.5 }}
                        whileTap={{ scale: 0.99 }}
                        className="rounded-xl border border-(--line) bg-white p-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link
                              to={`/invoices/${encodeURIComponent(invoice.invoice_number)}`}
                              className="text-sm font-semibold text-(--ink) hover:underline"
                            >
                              {invoice.invoice_number}
                            </Link>
                            <p className="mt-1 text-xs text-(--muted)">{invoice.vendor_name}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${normalizeStatus(statusLabel)}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="text-(--muted)">{formatDate(invoice.date)}</span>
                          <span className="font-semibold text-(--ink)">{formatCurrency(invoice.grand_total, invoice.currency)}</span>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-(--line) bg-white px-3.5 py-3 text-sm">
                  <p className="text-(--muted)">
                    Page {page} of {totalPages}
                  </p>
                  <div className="inline-flex items-center gap-2">
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => goToPage(page - 1)}
                      disabled={page <= 1}
                      className="inline-flex items-center gap-1 rounded-lg border border-(--line) px-3 py-1.5 text-xs font-semibold text-(--ink) disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Prev
                    </motion.button>

                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => goToPage(page + 1)}
                      disabled={page >= totalPages}
                      className="inline-flex items-center gap-1 rounded-lg border border-(--line) px-3 py-1.5 text-xs font-semibold text-(--ink) disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Next <ChevronRight className="h-3.5 w-3.5" />
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
