import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  RefreshCcw,
  SearchCheck,
  FolderOpen
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  getReconciliationItems,
  getReconciliationReport,
  listReconciliationSessions,
  resolveReconciliationItem,
  uploadReconciliationListing,
} from '../api/reconciliation'
import { formatCurrency, formatDate } from '../lib/formatters'
import type {
  ReconciliationFilteredItem,
  ReconciliationReportItem,
  ReconciliationSessionListItem,
} from '../types/reconciliation'
import { PageShell } from './PageShell'

type ReviewQueueMode = 'all' | 'needs_review'

const GREEN_STATUSES = new Set(['matched', 'ai_match'])
const ORANGE_STATUSES = new Set(['ai_matched_with_discrepancies'])
const STRICT_RED_STATUSES = new Set(['amount_mismatch', 'po_mismatch', 'duplicate_billing'])
const RESOLVED_GREEN_STATUSES = new Set(['manually_approved', 'resolved'])

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
}

const pageTransition = { duration: 0.28 }

function normalizeStatus(status: string) {
  return status.toLowerCase()
}

function toStatusLabel(status: string) {
  return normalizeStatus(status).replaceAll('_', ' ')
}

function isNeedsReviewStatus(status: string) {
  const normalized = normalizeStatus(status)
  if (RESOLVED_GREEN_STATUSES.has(normalized)) return false
  if (GREEN_STATUSES.has(normalized)) return false
  return true
}

function isReviewableStatus(status: string) {
  const normalized = normalizeStatus(status)
  if (ORANGE_STATUSES.has(normalized)) return true
  if (STRICT_RED_STATUSES.has(normalized)) return true
  return normalized.includes('mismatch') || normalized === 'missing'
}

function statusClasses(status: string) {
  const normalized = normalizeStatus(status)
  if (GREEN_STATUSES.has(normalized)) {
    return 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
  }
  if (RESOLVED_GREEN_STATUSES.has(normalized)) {
    return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30 shadow-[0_0_14px_rgba(16,185,129,0.14)]'
  }
  if (ORANGE_STATUSES.has(normalized)) {
    return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
  }
  if (STRICT_RED_STATUSES.has(normalized) || normalized.includes('mismatch')) {
    return 'bg-red-500/10 text-red-300 ring-1 ring-red-500/25 shadow-[0_0_10px_rgba(239,68,68,0.12)]'
  }
  if (normalized === 'missing') {
    return 'bg-red-500/10 text-red-300 ring-1 ring-red-500/25 shadow-[0_0_10px_rgba(239,68,68,0.12)]'
  }
  if (normalized === 'pending') {
    return 'bg-slate-500/10 text-slate-300 ring-1 ring-slate-500/30'
  }
  if (normalized === 'complete') {
    return 'bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20 shadow-[0_0_10px_rgba(14,165,233,0.1)]'
  }
  if (normalized === 'failed') {
    return 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
  }
  return 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]'
}

type ReconciliationRowItem = ReconciliationFilteredItem | ReconciliationReportItem

type ResolutionState = {
  action: 'accepted' | 'rejected'
  note: string
  resolvedAt: string
}

function getRowKey(item: ReconciliationRowItem, index: number) {
  const resolvedId = getItemId(item)
  if (resolvedId) return resolvedId
  return `${item.invoice_number}-${item.vendor}-${item.status}-${index}`
}

function getItemId(item: ReconciliationRowItem) {
  const candidate = (item as { id?: unknown; item_id?: unknown; line_item_id?: unknown }).id
    ?? (item as { id?: unknown; item_id?: unknown; line_item_id?: unknown }).item_id
    ?? (item as { id?: unknown; item_id?: unknown; line_item_id?: unknown }).line_item_id
  if (typeof candidate !== 'string') return null
  const trimmed = candidate.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getDiscrepancyNote(item: ReconciliationRowItem) {
  if (!item.discrepancies || item.discrepancies.length === 0) {
    return 'No discrepancy note available from AI analysis.'
  }
  return item.discrepancies.join(' | ')
}

function toFiniteNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getResolvedAction(item: ReconciliationRowItem): 'MANUALLY_APPROVED' | 'REJECTED' | null {
  const resolved = normalizeStatus(item.resolved_status ?? '')
  if (resolved === 'manually_approved') return 'MANUALLY_APPROVED'
  if (resolved === 'rejected') return 'REJECTED'

  const status = normalizeStatus(item.status)
  if (status === 'manually_approved') return 'MANUALLY_APPROVED'
  if (status === 'rejected') return 'REJECTED'

  return null
}

function canOpenResolutionPanel(item: ReconciliationRowItem) {
  return isReviewableStatus(item.status) || Boolean(getResolvedAction(item))
}

export function ReconciliationPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { sessionId } = useParams<{ sessionId?: string }>()

  const [listingName, setListingName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [useAi, setUseAi] = useState(true)
  const [reviewQueueMode, setReviewQueueMode] = useState<ReviewQueueMode>('all')
  const [selectedItem, setSelectedItem] = useState<ReconciliationRowItem | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [resolvedRows, setResolvedRows] = useState<Record<string, ResolutionState>>({})

  const {
    data: sessions,
    isLoading: isSessionsLoading,
    isError: isSessionsError,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['reconciliation', 'sessions'],
    queryFn: listReconciliationSessions,
  })

  const selectedSession = useMemo(() => {
    if (!sessionId) return null
    return (sessions ?? []).find((session) => session.id === sessionId) ?? null
  }, [sessionId, sessions])

  useEffect(() => {
    if (!sessionId || !sessions || sessions.length === 0) return
    const exists = sessions.some((session) => session.id === sessionId)
    if (!exists) {
      navigate('/reconciliation', { replace: true })
    }
  }, [navigate, sessionId, sessions])

  const {
    data: report,
    isLoading: isReportLoading,
    isError: isReportError,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ['reconciliation', 'report', sessionId],
    queryFn: () => getReconciliationReport(sessionId ?? ''),
    enabled: Boolean(sessionId),
  })

  const {
    data: filteredItems,
    isLoading: isItemsLoading,
    isError: isItemsError,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['reconciliation', 'items', sessionId],
    queryFn: () => getReconciliationItems(sessionId ?? '', 'all'),
    enabled: Boolean(sessionId),
  })

  const uploadMutation = useMutation({
    mutationFn: uploadReconciliationListing,
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reconciliation', 'sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] }),
      ])
      toast.success(`Reconciliation complete: ${response.summary.match_rate}% match vector`)
      setSelectedFile(null)
      setListingName('')
      navigate(`/reconciliation/${response.session_id}`)
    },
    onError: () => {
      toast.error('Could not process ledger subset. Verify schema format and retry.')
    },
  })

  const resolveMutation = useMutation({
    mutationFn: (params: { itemId: string; action: 'MANUALLY_APPROVED' | 'REJECTED'; note?: string; mode?: 'resolve' | 'note_update' }) =>
      resolveReconciliationItem(params.itemId, {
        action: params.action,
        note: params.note,
      }),
    onSuccess: (_, variables) => {
      const key = selectedItem?.id
      if (key) {
        setResolvedRows((prev) => ({
          ...prev,
          [key]: {
            action: variables.action === 'MANUALLY_APPROVED' ? 'accepted' : 'rejected',
            note: variables.note ?? '',
            resolvedAt: new Date().toISOString(),
          },
        }))
      }
      if (variables.mode === 'note_update') {
        toast.success('Resolution note updated.')
      } else {
        const actionText = variables.action === 'MANUALLY_APPROVED' ? 'accepted' : 'rejected'
        toast.success(`Invoice discrepancy ${actionText}.`)
      }
      setSelectedItem(null)
      setResolutionNote('')
    },
    onError: () => {
      toast.error('Could not resolve this discrepancy. Please retry.')
    },
  })

  function selectSession(session: ReconciliationSessionListItem) {
    navigate(`/reconciliation/${session.id}`)
    setReviewQueueMode('all')
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedFile) {
      toast.error('Please inject a CSV or Excel artifact.')
      return
    }
    if (!listingName.trim()) {
      toast.error('Please assign a session identifier.')
      return
    }
    uploadMutation.mutate({
      name: listingName.trim(),
      file: selectedFile,
      useAi,
    })
  }

  function openResolutionPanel(item: ReconciliationRowItem) {
    const itemId = getItemId(item)
    if (!itemId) {
      toast.error('Resolution id missing for this row. Refresh session and retry.')
      return
    }
    if (!canOpenResolutionPanel(item)) {
      return
    }
    setSelectedItem({ ...item, id: itemId })
    setResolutionNote(item.resolution_note ?? '')
  }

  function closeResolutionPanel() {
    if (resolveMutation.isPending) return
    setSelectedItem(null)
    setResolutionNote('')
  }

  function submitResolution(action: 'MANUALLY_APPROVED' | 'REJECTED') {
    const itemId = selectedItem ? getItemId(selectedItem) : null
    if (!itemId) {
      toast.error('Missing line-item identifier.')
      return
    }
    resolveMutation.mutate({
      itemId,
      action,
      note: resolutionNote.trim() || undefined,
      mode: 'resolve',
    })
  }

  function submitResolutionNoteUpdate() {
    if (!selectedItem) return
    const itemId = getItemId(selectedItem)
    if (!itemId) {
      toast.error('Missing line-item identifier.')
      return
    }

    const existingAction = getResolvedAction(selectedItem)
    if (!existingAction) {
      toast.error('Resolve this discrepancy first before editing note only.')
      return
    }

    resolveMutation.mutate({
      itemId,
      action: existingAction,
      note: resolutionNote.trim() || undefined,
      mode: 'note_update',
    })
  }

  const drilldownItems = useMemo(
    () => filteredItems?.items ?? report?.items ?? [],
    [filteredItems?.items, report?.items],
  )
  const hydratedItems = useMemo(() => {
    return drilldownItems.map((item) => {
      const itemId = getItemId(item)
      const resolution = itemId ? resolvedRows[itemId] : undefined
      if (!resolution) return item
      if (resolution.action === 'accepted') {
        return {
          ...item,
          status: 'MANUALLY_APPROVED',
          resolved_status: 'MANUALLY_APPROVED',
          resolution_note: resolution.note,
          resolution_date: resolution.resolvedAt,
        }
      }
      return {
        ...item,
        status: 'REJECTED',
        resolved_status: 'REJECTED',
        resolution_note: resolution.note,
        resolution_date: resolution.resolvedAt,
      }
    })
  }, [drilldownItems, resolvedRows])
  const visibleItems = useMemo(() => {
    if (reviewQueueMode === 'all') return hydratedItems
    return hydratedItems.filter((item) => isNeedsReviewStatus(item.status))
  }, [hydratedItems, reviewQueueMode])

  const totalProcessed = report?.summary.total ?? 0
  const exactMatches = report?.summary.matched ?? 0
  const discrepancyValue = toFiniteNumber((report?.summary as { net_difference?: unknown } | undefined)?.net_difference)
  const aiRiskSummary =
    report?.ai_analysis?.executive_summary?.trim() ||
    report?.risk_summary?.trim() ||
    'Gemini risk summary is not available for this session yet.'

  const inputClass = "w-full max-w-full min-w-0 box-border rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none ring-1 ring-transparent transition-all focus:bg-white/10 focus:ring-(--brand)/50 backdrop-blur-md"

  return (
    <div className="relative min-h-[calc(100vh-(--spacing(16)))] pb-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-indigo-900/10 via-[#070d1f] to-[#070d1f]" />
      <div className="pointer-events-none absolute top-40 -left-40 h-96 w-96 rounded-full bg-emerald-900/10 blur-[120px]" />

      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="space-y-6 mx-auto max-w-[1400px] px-4 sm:px-6 mt-8"
      >
        <PageShell
          title="Consensus Reconciliation"
          description="Cross-examine external auditor listings against the verified central ledger using neural pattern matching."
        >
          <div className="space-y-8">
            <form onSubmit={submitUpload} className="grid gap-4 rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.2)] backdrop-blur-2xl lg:grid-cols-[1.5fr_1.5fr_auto] lg:items-end relative overflow-hidden isolate [contain:paint]">
              
              <label className="relative z-10 block w-full min-w-0">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-(--muted)">
                  Operation Identifier
                </span>
                <input
                  value={listingName}
                  onChange={(event) => setListingName(event.target.value)}
                  placeholder="e.g. Q1 2026 Audit Subset"
                  className={inputClass}
                />
              </label>

              <label className="relative z-10 block w-full min-w-0">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-(--muted)">
                  Listing Artifact (.csv, .xlsx)
                </span>
                <div className="relative w-full min-w-0">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className={`${inputClass} flex items-center justify-between pointer-events-none font-mono overflow-hidden ${selectedFile ? 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5' : 'text-white/40 border-dashed border-white/20'}`}>
                    <span className="truncate pr-4 min-w-0">{selectedFile ? selectedFile.name : 'Select or drop target file...'}</span>
                    <FolderOpen className={`h-4 w-4 shrink-0 ${selectedFile ? 'text-emerald-400' : 'text-(--muted)'}`} />
                  </div>
                </div>
              </label>

              <div className="flex flex-col justify-end gap-3 relative z-10 min-w-0 lg:min-w-[220px] w-full">
                <label className="inline-flex items-center gap-2.5 text-[11px] font-semibold text-white/70 uppercase tracking-widest cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={useAi}
                      onChange={(event) => setUseAi(event.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="h-4 w-4 rounded bg-white/10 ring-1 ring-white/20 peer-checked:bg-(--brand) peer-checked:ring-transparent transition-all" />
                    {useAi && <CheckCircle2 className="h-3 w-3 absolute text-white pointer-events-none" />}
                  </div>
                  System Neural Matching
                </label>

                <motion.button
                  type="submit"
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  disabled={uploadMutation.isPending}
                  className="inline-flex h-12 w-full max-w-full min-w-0 box-border items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 px-6 text-sm font-semibold text-white disabled:opacity-50 disabled:grayscale transition-all hover:brightness-110 overflow-hidden"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Cross-Checking...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-4 w-4" />
                      Initialize Consensus
                    </>
                  )}
                </motion.button>
              </div>
            </form>

            <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
              <section className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl h-fit max-h-[80vh] flex flex-col">
                <div className="mb-5 flex items-center justify-between gap-2 border-b border-white/5 pb-4">
                  <h2 className="text-[12px] font-bold uppercase tracking-widest text-white/80">Active Sessions</h2>
                  <button
                    type="button"
                    onClick={() => void refetchSessions()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-colors ring-1 ring-white/10"
                  >
                    <RefreshCcw className="h-3 w-3" /> Sync
                  </button>
                </div>

                <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2">
                  {isSessionsLoading && (
                    [0, 1, 2].map((index) => (
                      <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10" />
                    ))
                  )}

                  {isSessionsError && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300">
                      Datastream failure. Could not load session context.
                    </div>
                  )}

                  {!isSessionsLoading && !isSessionsError && (sessions?.length ?? 0) === 0 && (
                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center text-xs text-(--muted) italic py-8">
                      No consensus vectors exist. Initialize a new session.
                    </div>
                  )}

                  {sessions?.map((session) => {
                    const isActive = session.id === sessionId
                    return (
                      <motion.button
                        key={session.id}
                        type="button"
                        whileHover={{ y: -1, backgroundColor: isActive ? '' : 'rgba(255,255,255,0.04)' }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => selectSession(session)}
                        className={`w-full rounded-2xl p-4 text-left transition-all duration-300 ring-1 backdrop-blur-md ${
                          isActive
                            ? 'ring-indigo-500/50 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                            : 'ring-white/10 bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className={`text-[13px] font-semibold tracking-wide truncate ${isActive ? 'text-indigo-200' : 'text-white'}`}>{session.name}</p>
                          <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest rounded flex-shrink-0 ${statusClasses(session.status)}`}>
                            {normalizeStatus(session.status)}
                          </span>
                        </div>
                        <p className="font-mono text-[10px] text-(--muted)">{formatDate(session.created_at)}</p>
                      </motion.button>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/5 bg-white/[0.01] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-xl flex flex-col min-w-0 overflow-hidden">
                {!sessionId && (
                  <div className="rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-12 text-center shadow-inner h-full flex flex-col items-center justify-center min-h-[400px]">
                    <div className="flex bg-white/5 h-20 w-20 rounded-[2rem] items-center justify-center mb-6 ring-1 ring-white/10">
                      <SearchCheck className="mx-auto h-10 w-10 text-(--muted)" />
                    </div>
                    <p className="mt-2 text-xl font-light tracking-tight text-white mb-2">Await Target Lock</p>
                    <p className="mt-1 text-[13px] text-(--muted) max-w-sm">
                      Select a consensus session from the operational log to review structural discrepancies and compliance rates.
                    </p>
                  </div>
                )}

                {sessionId && (
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/5 pb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-white tracking-tight">{selectedSession?.name ?? 'Session Report'}</h2>
                        <p className="text-[11px] text-(--muted) font-mono mt-1 bg-white/5 px-2 py-0.5 rounded-sm inline-block">ID: {sessionId}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void refetchReport()
                          void refetchItems()
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-2 text-[11px] font-semibold tracking-widest uppercase text-white hover:bg-white/10 transition-colors ring-1 ring-white/10"
                      >
                        <RefreshCcw className="h-3.5 w-3.5" /> Force Sync
                      </button>
                    </div>

                    {isReportLoading && (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[0, 1, 2, 3].map((index) => (
                          <div key={index} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                        ))}
                      </div>
                    )}

                    {isReportError && (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
                        Datastream error. Diagnostic summary unavailable.
                      </div>
                    )}

                    {report && (
                      <>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-inner">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-(--muted)">Total Processed</p>
                            <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{totalProcessed.toLocaleString('en-IN')}</p>
                          </div>
                          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 shadow-inner">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/80">Exact Matches</p>
                            <p className="mt-2 text-2xl font-semibold tracking-tight text-emerald-300">{exactMatches.toLocaleString('en-IN')}</p>
                          </div>
                          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 shadow-inner">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-100/80">Total Discrepancy Value</p>
                            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-amber-300">
                              {discrepancyValue != null
                                ? formatCurrency(discrepancyValue, report.items[0]?.currency ?? 'INR')
                                : '--'}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-5 py-4 flex items-center justify-between backdrop-blur-md shadow-inner">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <CheckCircle2 className="h-4 w-4" />
                              </div>
                              <span className="text-sm font-semibold text-indigo-100 uppercase tracking-widest">Consensus Rate</span>
                            </div>
                            <span className="text-2xl font-light tracking-tight text-indigo-400">{report.summary.match_rate}%</span>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-rose-200/80">Gemini Risk Summary</p>
                          <p className="mt-2 text-sm leading-relaxed text-rose-100/90">{aiRiskSummary}</p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                          <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.02] p-1">
                            <button
                              type="button"
                              onClick={() => setReviewQueueMode('all')}
                              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                                reviewQueueMode === 'all'
                                  ? 'bg-white/10 text-white'
                                  : 'text-(--muted) hover:text-white/80'
                              }`}
                            >
                              Show All
                            </button>
                            <button
                              type="button"
                              onClick={() => setReviewQueueMode('needs_review')}
                              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                                reviewQueueMode === 'needs_review'
                                  ? 'bg-amber-500/15 text-amber-300'
                                  : 'text-(--muted) hover:text-white/80'
                              }`}
                            >
                              Needs Review
                            </button>
                          </div>
                          <p className="text-[11px] font-semibold uppercase tracking-widest text-(--muted)">
                            {visibleItems.length} records
                          </p>
                        </div>

                        {(isItemsLoading || isReportLoading) && (
                          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center text-[13px] text-(--muted)">
                            <LoaderCircle className="h-5 w-5 animate-spin mx-auto mb-3" />
                            Fetching structural schema view...
                          </div>
                        )}

                        {isItemsError && (
                          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">
                            Failure isolating subset vectors.
                          </div>
                        )}

                        {!isItemsLoading && !isItemsError && visibleItems.length === 0 && (
                          <div className="rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-12 text-center shadow-inner backdrop-blur-xl">
                            <p className="text-sm font-medium text-white/50">Anomaly matrix empty for current parameters.</p>
                          </div>
                        )}

                        {!isItemsLoading && !isItemsError && visibleItems.length > 0 && (
                          <div className="overflow-hidden rounded-[1.5rem] border border-white/5 bg-white/[0.02] ring-1 ring-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-2xl">
                            <div className="max-h-[580px] overflow-auto">
                              <table className="min-w-full text-left text-sm whitespace-nowrap">
                                <thead className="sticky top-0 z-10 bg-[#0f1527] text-[10px] font-bold uppercase tracking-widest text-(--muted) border-b border-white/10">
                                  <tr>
                                    <th className="px-5 py-4">Structure ID</th>
                                    <th className="px-5 py-4">Source Origin</th>
                                    <th className="px-5 py-4">Listing Date</th>
                                    <th className="px-5 py-4">Asserted Value</th>
                                    <th className="px-5 py-4">Outcome</th>
                                    <th className="px-5 py-4">Resolution</th>
                                    <th className="px-5 py-4 min-w-[120px]">Review Date</th>
                                    <th className="px-5 py-4 min-w-[150px]">Note</th>
                                    <th className="px-5 py-4 w-1/4">Diagnostic Notes</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {visibleItems.map((item, index) => {
                                    const rowKey = getRowKey(item, index)
                                    const isReviewable = canOpenResolutionPanel(item)
                                    return (
                                    <motion.tr
                                      key={rowKey}
                                      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                                      onClick={() => openResolutionPanel(item)}
                                      className={`transition-colors group ${isReviewable ? 'cursor-pointer' : 'cursor-default'}`}
                                    >
                                      <td className="px-5 py-4 font-semibold text-white">
                                        <Link to={`/invoices/${item.invoice_number}`} className="hover:text-(--brand) transition-colors">
                                          {item.invoice_number}
                                        </Link>
                                      </td>
                                      <td className="px-5 py-4 text-white/80 group-hover:text-white transition-colors">
                                        {item.vendor}
                                      </td>
                                      <td className="px-5 py-4 text-(--muted) text-[13px]">
                                        {formatDate(item.listing_date ?? null)}
                                      </td>
                                      <td className="px-5 py-4 text-white/90 font-mono text-[13px]">
                                        {formatCurrency(item.listing_amount, item.currency ?? 'INR')}
                                      </td>
                                      <td className="px-5 py-4">
                                        <span className={`inline-flex rounded-sm px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest ${statusClasses(item.status)}`}>
                                          {toStatusLabel(item.status)}
                                        </span>
                                      </td>
                                      <td className="px-5 py-4">
                                        {item.resolved_status ? (
                                          <span className={`inline-flex items-center gap-1 rounded-sm px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${
                                            item.resolved_status === 'MANUALLY_APPROVED' 
                                              ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25' 
                                              : 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25'
                                          }`}>
                                            <CheckCircle2 className="h-3 w-3 shrink-0" />
                                            {item.resolved_status === 'MANUALLY_APPROVED' ? 'Approved' : 'Rejected'}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Unreviewed</span>
                                        )}
                                      </td>
                                      <td className="px-5 py-4 font-mono text-[11px] text-(--muted)">
                                        {item.resolution_date ? formatDate(item.resolution_date) : '--'}
                                      </td>
                                      <td className="px-5 py-4 max-w-[180px]">
                                        {item.resolution_note ? (
                                          <button
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation()
                                              openResolutionPanel(item)
                                            }}
                                            className="truncate text-left text-[11px] text-emerald-200 underline decoration-emerald-400/40 underline-offset-2 hover:text-emerald-100"
                                            title={item.resolution_note}
                                          >
                                            {item.resolution_note}
                                          </button>
                                        ) : (
                                          <p className="truncate text-[11px] text-white/70" title={item.resolution_note ?? ''}>
                                            --
                                          </p>
                                        )}
                                      </td>
                                      <td className="px-5 py-4 text-xs">
                                        {item.discrepancies.length > 0 ? (
                                          <div className="space-y-1.5 max-w-[300px]">
                                            {item.discrepancies.slice(0, 2).map((discrepancy, index) => (
                                              <div key={index} className="flex items-start gap-2 bg-amber-500/5 ring-1 ring-amber-500/20 p-2 rounded-lg backdrop-blur-sm">
                                                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 translate-y-0.5" />
                                                <span className="text-[11px] text-amber-200/90 whitespace-normal leading-relaxed">{discrepancy}</span>
                                              </div>
                                            ))}
                                            {item.discrepancies.length > 2 && (
                                              <p className="text-[10px] text-(--muted) font-semibold ml-2">+ {item.discrepancies.length - 2} more flags</p>
                                            )}
                                          </div>
                                        ) : (
                                          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-lg ring-1 ring-emerald-500/20 text-[11px] uppercase tracking-wide">
                                            <CheckCircle2 className="h-3 w-3" /> System Verified
                                          </span>
                                        )}
                                      </td>
                                    </motion.tr>
                                  )})}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        </PageShell>
      </motion.div>

      {selectedItem && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-[#050814]/80 backdrop-blur-sm"
            onClick={closeResolutionPanel}
            aria-label="Close resolution panel"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.22 }}
            className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#0a1020] p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-label="Resolve reconciliation discrepancy"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-amber-300">Needs Review</p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">{selectedItem.invoice_number}</h3>
                <p className="mt-1 text-[12px] text-(--muted)">{selectedItem.vendor}</p>
                <p className="mt-1 text-[10px] font-mono text-(--muted)">Resolution ID: {getItemId(selectedItem) ?? 'N/A'}</p>
              </div>
              <button
                type="button"
                onClick={closeResolutionPanel}
                disabled={resolveMutation.isPending}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">AI Note</p>
              <p className="mt-2 text-sm leading-relaxed text-amber-100">{getDiscrepancyNote(selectedItem)}</p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">Ledger Data</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-(--muted)">Invoice</dt><dd className="text-white">{selectedItem.invoice_number || '-'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-(--muted)">Vendor</dt><dd className="text-white text-right">{selectedItem.vendor || '-'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-(--muted)">Date</dt><dd className="text-white">{formatDate(selectedItem.listing_date ?? null)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-(--muted)">Amount</dt><dd className="font-mono text-white">{formatCurrency(selectedItem.listing_amount, selectedItem.currency ?? 'INR')}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-(--muted)">Tax</dt><dd className="font-mono text-white">{formatCurrency(selectedItem.listing_tax ?? selectedItem.matched_invoice_tax ?? 0, selectedItem.currency ?? 'INR')}</dd></div>
                </dl>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-300">System Invoice</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-(--muted)">Invoice</dt><dd className="text-white">{selectedItem.matched_invoice_number ?? '-'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-(--muted)">Vendor</dt><dd className="text-white text-right">{selectedItem.matched_vendor_name ?? '-'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-(--muted)">Date</dt><dd className="text-white">{formatDate(selectedItem.matched_invoice_date ?? null)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-(--muted)">Amount</dt><dd className="font-mono text-white">{selectedItem.matched_invoice_amount != null ? formatCurrency(selectedItem.matched_invoice_amount, selectedItem.matched_invoice_currency ?? selectedItem.currency ?? 'INR') : '-'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-(--muted)">Tax</dt><dd className="font-mono text-white">{selectedItem.matched_invoice_tax != null ? formatCurrency(selectedItem.matched_invoice_tax, selectedItem.matched_invoice_currency ?? selectedItem.currency ?? 'INR') : '-'}</dd></div>
                </dl>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <label htmlFor="resolution-note" className="block text-[10px] font-bold uppercase tracking-widest text-white/70">
                Resolution Note
              </label>
              <textarea
                id="resolution-note"
                value={resolutionNote}
                onChange={(event) => setResolutionNote(event.target.value)}
                placeholder="Why are you approving or rejecting this discrepancy?"
                className="mt-2 min-h-[110px] w-full rounded-xl border border-white/10 bg-[#0a1226] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-indigo-400/70"
              />
            </div>

            {selectedItem && getResolvedAction(selectedItem) && (
              <button
                type="button"
                onClick={submitResolutionNoteUpdate}
                disabled={resolveMutation.isPending || !getItemId(selectedItem)}
                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-4 text-sm font-bold text-indigo-100 transition-colors hover:bg-indigo-500/25 disabled:opacity-50"
              >
                {resolveMutation.isPending ? 'Saving note...' : 'Save Note Only'}
              </button>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => submitResolution('MANUALLY_APPROVED')}
                disabled={resolveMutation.isPending || !getItemId(selectedItem)}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {resolveMutation.isPending ? 'Saving...' : 'Accept Discrepancy'}
              </button>
              <button
                type="button"
                onClick={() => submitResolution('REJECTED')}
                disabled={resolveMutation.isPending || !getItemId(selectedItem)}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {resolveMutation.isPending ? 'Saving...' : 'Reject Invoice'}
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </div>
  )
}
