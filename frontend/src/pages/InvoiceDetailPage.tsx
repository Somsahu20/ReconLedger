import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, AlertTriangle, CheckCircle2, FileSearch, RefreshCw } from 'lucide-react'
import { AxiosError } from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getInvoiceByNumber } from '../api/invoices'
import { formatCurrency, formatDate, toStatusLabel } from '../lib/formatters'
import { PageShell } from './PageShell'

function statusClasses(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === 'clean') return 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
  if (normalized === 'reviewed') return 'bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20 shadow-[0_0_15px_rgba(14,165,233,0.15)]'
  return 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
}

export function InvoiceDetailPage() {
  const { invoiceNumber } = useParams()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['invoice', 'detail', invoiceNumber],
    queryFn: () => getInvoiceByNumber(invoiceNumber ?? ''),
    enabled: Boolean(invoiceNumber),
  })

  const notFound =
    error instanceof AxiosError &&
    (error.response?.status === 404 || error.response?.data?.detail === 'Invoice not found')

  const statusLabel = data ? toStatusLabel(data.status) : null
  const isFlagged = statusLabel === 'flagged'

  return (
    <div className="relative min-h-[calc(100vh-(--spacing(16)))] pb-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-indigo-900/10 via-[#070d1f] to-[#070d1f]" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="space-y-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8"
      >
        <PageShell
          title={`Invoice ${invoiceNumber ?? ''}`}
          description="Review extracted details, line-item arithmetic, and audit insights for this invoice in the ledger."
        >
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <Link
                to="/invoices"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/10 ring-1 ring-transparent hover:ring-white/5"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Explorer
              </Link>
            </div>

            {isLoading && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <div key={index} className="h-28 animate-pulse rounded-[1.5rem] bg-white/5 ring-1 ring-white/10" />
                ))}
              </div>
            )}

            {isError && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200 backdrop-blur-md">
                <p className="font-semibold text-red-300 text-base">{notFound ? 'Invoice not found' : 'Failed to load invoice details'}</p>
                <p className="mt-1 text-xs text-red-200/80 mb-4 max-w-md">
                  {notFound
                    ? 'This invoice number does not exist or is not associated with your account.'
                    : 'A network error occurred while fetching the ledger detail. Please retry the request.'}
                </p>
                {!notFound && (
                  <button
                    type="button"
                    onClick={() => {
                      void refetch()
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors px-4 py-2 text-[13px] font-semibold text-white"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry Connection
                  </button>
                )}
              </div>
            )}

            {data && (
              <>
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="grid gap-4 rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-2xl"
                >
                  <div className="col-span-1 xl:col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--muted) mb-1.5 flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-(--brand)" />Vendor Target
                    </p>
                    <p className="font-medium text-white text-base truncate pr-2">{data.vendor_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--muted) mb-1.5">Reference #</p>
                    <p className="font-mono text-sm text-white/90 bg-white/5 px-2 py-0.5 rounded w-fit">{data.invoice_number}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--muted) mb-1.5">System State</p>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ${statusClasses(statusLabel ?? 'flagged')}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--muted) mb-1.5">Issue Date</p>
                    <p className="text-sm font-medium text-white/90">{formatDate(data.date)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--muted) mb-1.5">Maturity Date</p>
                    <p className="text-sm font-medium text-white/90">{formatDate(data.due_date)}</p>
                  </div>
                </motion.div>

                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: 0.1 }}
                    className="overflow-hidden rounded-[1.5rem] bg-white/[0.02] ring-1 ring-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] backdrop-blur-xl flex flex-col"
                  >
                    <div className="border-b border-white/5 bg-white/[0.01] px-5 py-4">
                      <h2 className="text-[13px] font-bold uppercase tracking-widest text-white/80">Entity Line Items</h2>
                    </div>

                    {data.line_items.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white/[0.01]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-(--muted) mb-4">
                          <FileSearch className="h-5 w-5" />
                        </div>
                        <p className="text-sm text-(--muted)">No granular line items extracted for this document.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto flex-1 bg-white/[0.01]">
                        <table className="min-w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-white/[0.02] text-[10px] font-bold uppercase tracking-widest text-(--muted) border-b border-white/5">
                            <tr>
                              <th className="px-5 py-3">Description Vector</th>
                              <th className="px-5 py-3">Count</th>
                              <th className="px-5 py-3">Unit Allocation</th>
                              <th className="px-5 py-3">Total Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {data.line_items.map((item) => (
                              <tr key={item.id} className="transition-colors hover:bg-white/[0.02]">
                                <td className="px-5 py-3.5 text-white/90 max-w-[200px] truncate">{item.description}</td>
                                <td className="px-5 py-3.5 text-white/90 font-mono text-[13px]">{item.quantity}</td>
                                <td className="px-5 py-3.5 text-white/80 font-mono text-[13px]">
                                  {formatCurrency(item.unit_price, data.currency)}
                                </td>
                                <td className="px-5 py-3.5 font-medium text-white font-mono text-[13px]">
                                  {formatCurrency(item.line_total, data.currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </motion.div>

                  <div className="space-y-6 flex flex-col h-full">
                    <motion.section
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: 0.15 }}
                      className="rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] backdrop-blur-xl"
                    >
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-(--muted) mb-4 pb-3 border-b border-white/5">Ledger Settlement</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="text-(--muted)">Computed Subtotal</span>
                          <span className="font-mono text-white/90">{formatCurrency(data.subtotal, data.currency)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="text-(--muted)">Tax Liability ({data.tax_rate}%)</span>
                          <span className="font-mono text-white/90">{formatCurrency(data.tax_amount, data.currency)}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-3">
                          <span className="text-sm font-medium text-white">Gross Amount</span>
                          <span className="text-lg font-light tracking-tight text-(--brand)">
                            {formatCurrency(data.grand_total, data.currency)}
                          </span>
                        </div>
                      </div>
                    </motion.section>

                    <motion.section
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: 0.2 }}
                      className="rounded-[1.5rem] border border-white/5 bg-white/[0.01] p-5 backdrop-blur-md flex-1"
                    >
                      <h3 className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-(--muted) mb-3">
                        <FileSearch className="h-3.5 w-3.5" />
                        Intake Telemetry
                      </h3>
                      <p className="text-[13px] text-white/50 leading-relaxed">
                        Data is strictly extracted and verified against algorithmic integrity checks. Full context provided below if flagged.
                      </p>
                    </motion.section>
                  </div>
                </div>

                {data.audit_report && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: 0.25 }}
                    className={`rounded-[1.5rem] border p-6 backdrop-blur-xl relative overflow-hidden ${
                      isFlagged
                        ? 'border-amber-500/20 bg-amber-500/5 text-amber-200'
                        : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200'
                    }`}
                  >
                    <div className={`absolute top-0 right-0 p-8 opacity-10 ${isFlagged ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {isFlagged ? <AlertTriangle className="h-32 w-32" /> : <CheckCircle2 className="h-32 w-32" />}
                    </div>
                    
                    <div className="relative z-10">
                      <h3 className={`inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-widest mb-4 ${isFlagged ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {isFlagged ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        AI Processing Diagnostic
                      </h3>
                      <div className={`text-[13px] leading-relaxed max-w-4xl prose prose-invert prose-sm ${isFlagged ? 'prose-amber' : 'prose-emerald'}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
                            h1: ({ children }) => <h1 className="text-lg font-semibold text-white mt-4 mb-2">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-semibold text-white mt-4 mb-2">{children}</h2>,
                            h3: ({ children }) => <h3 className={`text-sm font-bold mt-4 mb-2 ${isFlagged ? 'text-amber-300' : 'text-emerald-300'}`}>{children}</h3>,
                            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                            ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-5">{children}</ul>,
                            ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-5">{children}</ol>,
                            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                            hr: () => <hr className={`my-4 border-0 border-t ${isFlagged ? 'border-amber-500/20' : 'border-emerald-500/20'}`} />,
                          }}
                        >
                          {data.audit_report}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </PageShell>
      </motion.div>
    </div>
  )
}
