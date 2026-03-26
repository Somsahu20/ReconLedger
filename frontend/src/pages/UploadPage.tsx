import { useEffect, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import type { FileRejection } from 'react-dropzone'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, FileUp, LoaderCircle, X, ExternalLink } from 'lucide-react'
import { AxiosError } from 'axios'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { uploadInvoice } from '../api/invoices'
import { UploadScene } from '../components/three/UploadScene'
import { formatCurrency, formatDate } from '../lib/formatters'
import type { InvoiceUploadResponse } from '../types/invoice'
import { PageShell } from './PageShell'

const PROCESS_STAGES = [
  'Converting PDF to images...',
  'AI is reading the invoice...',
  'Validating arithmetic...',
  'Generating report...',
]

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

function toDropzoneErrorMessage(code: string, maxSizeBytes: number) {
  if (code === 'file-invalid-type') return 'Only PDF files are allowed.'
  if (code === 'file-too-large') return `File is too large. Maximum size is ${(maxSizeBytes / 1024 / 1024).toFixed(0)}MB.`
  if (code === 'too-many-files') return 'Please upload only one PDF at a time.'
  return 'The selected file cannot be uploaded.'
}

function stageState(index: number, activeIndex: number) {
  if (index < activeIndex) return 'complete'
  if (index === activeIndex) return 'active'
  return 'pending'
}

export function UploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [currentStage, setCurrentStage] = useState(0)
  const [fileDropErrors, setFileDropErrors] = useState<string[]>([])

  const {
    mutateAsync: uploadInvoiceMutation,
    data: uploadResult,
    isPending,
    error,
    reset,
  } = useMutation({
    mutationFn: uploadInvoice,
  })

  useEffect(() => {
    if (!isPending) return

    const interval = setInterval(() => {
      setCurrentStage((prev) => {
        if (prev >= PROCESS_STAGES.length - 1) return prev
        return prev + 1
      })
    }, 900)

    return () => clearInterval(interval)
  }, [isPending])

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    setSelectedFile(file ?? null)
    setFileDropErrors([])
    reset()
    setCurrentStage(0)
  }

  const onDropRejected = (rejections: FileRejection[]) => {
    setSelectedFile(null)
    reset()
    setCurrentStage(0)

    const messages = rejections.flatMap((rejection) =>
      rejection.errors.map((errorItem) => toDropzoneErrorMessage(errorItem.code, MAX_UPLOAD_BYTES)),
    )

    const uniqueMessages = Array.from(new Set(messages))
    setFileDropErrors(uniqueMessages)

    if (uniqueMessages[0]) {
      toast.error(uniqueMessages[0])
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: MAX_UPLOAD_BYTES,
  })

  const processingError = useMemo(() => {
    if (!error) return null
    if (error instanceof AxiosError) {
      const statusCode = error.response?.status
      const detail = error.response?.data?.detail
      if (statusCode === 400) {
        if (typeof detail === 'string') return detail
        return 'Invoice file is invalid or could not be processed.'
      }

      if (statusCode === 401) return 'Your session expired. Please sign in again.'
      if (statusCode === 413) return 'File exceeds upload limit. Please choose a smaller PDF.'
      if (statusCode === 429) return 'Upload rate limit reached. Please wait and try again.'
      if (typeof statusCode === 'number' && statusCode >= 500) {
        return 'Server error while processing invoice. Please retry in a moment.'
      }

      if (typeof detail === 'string') return detail
    }

    return 'Something went wrong while processing the invoice.'
  }, [error])

  async function handleProcessInvoice() {
    if (!selectedFile) {
      toast.error('Please choose a PDF file first.')
      return
    }

    setCurrentStage(0)
    reset()

    try {
      const result = await uploadInvoiceMutation(selectedFile)
      toast.success(result.message)
      setCurrentStage(PROCESS_STAGES.length - 1)
    } catch {
      toast.error('Invoice processing failed')
    }
  }

  function clearSelection() {
    setSelectedFile(null)
    setFileDropErrors([])
    setCurrentStage(0)
    reset()
  }

  const result = uploadResult as InvoiceUploadResponse | undefined
  const isFlagged = result?.status?.toUpperCase() === 'FLAGGED'

  return (
    <div className="relative min-h-[calc(100vh-(--spacing(16)))] pb-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-indigo-900/10 via-[#070d1f] to-[#070d1f]" />
      <UploadScene />
      
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="space-y-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8"
      >
        <PageShell
          title="Upload Invoice"
          description="Drop a PDF invoice, process it with AI validation, and review detailed extraction results."
        >
          <div className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
            <div className="space-y-6">
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-[2rem] border-2 border-dashed p-1.5 transition-all duration-300 ${
                  isDragActive
                    ? 'border-(--brand) bg-(--brand)/10 shadow-[0_0_30px_rgba(59,130,246,0.2)]'
                    : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                }`}
              >
                <input {...getInputProps()} />
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="rounded-3xl p-10 text-center backdrop-blur-sm"
                >
                  <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl mb-5 transition-colors duration-300 ${isDragActive ? 'bg-(--brand)/20 text-(--brand)' : 'bg-white/5 text-(--muted)'}`}>
                    <FileUp className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-light tracking-tight text-white mb-2">Drop PDF here</h3>
                  <p className="text-sm font-medium text-(--muted)">or click to browse files</p>
                  <p className="mt-3 text-xs uppercase tracking-widest text-white/30">1 file only • MAX {(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)}MB</p>
                </motion.div>
              </div>

              {fileDropErrors.length > 0 && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 backdrop-blur-md">
                  <ul className="space-y-1.5">
                    {fileDropErrors.map((errorMessage) => (
                      <li key={errorMessage} className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                        {errorMessage}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedFile && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-between rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 backdrop-blur-md"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--brand)/20 text-(--brand)">
                      <FileUp className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white truncate max-w-[200px] sm:max-w-xs">{selectedFile.name}</p>
                      <p className="text-xs text-(--muted)">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      clearSelection()
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-(--muted) transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              )}

              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={(e) => {
                  e.stopPropagation()
                  void handleProcessInvoice()
                }}
                disabled={!selectedFile || isPending}
                className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-(--brand) to-(--brand-ink) px-6 py-4 text-[14px] font-semibold text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {isPending ? (
                  <>
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    Processing with AI...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-5 w-5 text-white/80 transition-transform group-hover:scale-110" />
                    Process Invoice
                  </>
                )}
              </motion.button>
            </div>

            <div className="rounded-[2rem] bg-white/[0.02] p-6 sm:p-8 ring-1 ring-white/5 shadow-inner backdrop-blur-xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-medium text-white border-b border-white/10 pb-4 mb-6">Processing Trajectory</h3>
                <div className="space-y-6">
                  {PROCESS_STAGES.map((stage, index) => {
                    const state = stageState(index, currentStage)
                    return (
                      <div key={stage} className="relative flex items-center gap-4 text-sm">
                        {/* Connecting Line */}
                        {index < PROCESS_STAGES.length - 1 && (
                          <div className={`absolute left-3.5 top-8 h-8 w-px -ml-[0.5px] ${state === 'complete' ? 'bg-(--brand)/50' : 'bg-white/10'}`} />
                        )}
                        
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                          state === 'complete' ? 'border-(--brand) bg-(--brand)/20 text-(--brand)' : 
                          state === 'active' && isPending ? 'border-sky-400 bg-sky-400/20 text-sky-400' : 
                          'border-white/10 bg-white/5 text-transparent'
                        }`}>
                          {state === 'complete' ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : state === 'active' && isPending ? (
                            <div className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                          ) : (
                            <div className="h-1.5 w-1.5 rounded-full bg-white/20" />
                          )}
                        </div>
                        <span
                          className={`transition-colors duration-300 ${
                            state === 'active' && isPending ? 'font-medium text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 
                            state === 'complete' ? 'text-white/80' : 'text-(--muted)'
                          }`}
                        >
                          {stage}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {processingError && (
                <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 backdrop-blur-md">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <span className="font-semibold text-red-300">Processing Error</span>
                  </div>
                  <p className="text-red-200/80 text-xs">{processingError}</p>
                </div>
              )}
            </div>
          </div>
        </PageShell>

        {result && (
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="overflow-hidden rounded-[2rem] bg-white/[0.02] ring-1 ring-white/5 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] backdrop-blur-2xl"
          >
            <div className="border-b border-white/5 bg-white/[0.01] p-6 sm:p-8">
              <div
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold tracking-wide uppercase shadow-inner ${
                  isFlagged
                    ? 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                }`}
              >
                {isFlagged ? (
                  <><AlertTriangle className="h-4 w-4" /> Issues Found - Flagged</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> All Checks Passed</>
                )}
              </div>
            </div>

            <div className="grid lg:grid-cols-2">
              {/* Header Info */}
              <div className="p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-white/5 space-y-6">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-(--muted)">Parsed Document Entity</h4>
                
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-(--muted) mb-1">Vendor</p>
                    <p className="text-base font-medium text-white">{result.invoice.vendor_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-(--muted) mb-1">Invoice Number</p>
                    <p className="text-sm font-mono text-white/90 bg-white/5 px-2 py-0.5 rounded w-fit">{result.invoice.invoice_number}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-(--muted) mb-1">Date</p>
                    <p className="text-sm text-white/80">{formatDate(result.invoice.date)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-(--muted) mb-1">Due Date</p>
                    <p className="text-sm text-white/80">{formatDate(result.invoice.due_date)}</p>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-(--muted)">Subtotal</span>
                      <span className="text-sm text-white">
                        {formatCurrency(result.invoice.subtotal, result.invoice.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-(--muted)">Tax ({result.invoice.tax_rate}%)</span>
                      <span className="text-sm text-white">
                        {formatCurrency(result.invoice.tax_amount, result.invoice.currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <span className="text-sm font-medium text-white">Grand Total</span>
                      <span className="text-xl font-light tracking-tight text-(--brand)">
                        {formatCurrency(result.invoice.grand_total, result.invoice.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation & Line Items Preview */}
              <div className="p-6 sm:p-8 bg-white/[0.01]">
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-(--muted) mb-4">Integrity Checks</h4>
                
                <div className="space-y-3 mb-8">
                  {result.validation.checks.map((check) => (
                    <div
                      key={check.check_name}
                      className={`rounded-xl px-4 py-3 backdrop-blur-sm ${
                        check.passed
                          ? 'bg-emerald-500/5 ring-1 ring-emerald-500/10'
                          : 'bg-amber-500/10 ring-1 ring-amber-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-1">
                        {check.passed ? 
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : 
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                        }
                        <p className={`text-sm font-medium ${check.passed ? 'text-emerald-200/90' : 'text-amber-300'}`}>
                          {check.check_name}
                        </p>
                      </div>
                      {!check.passed && (
                        <p className="text-[11px] text-amber-200/70 ml-7 leading-relaxed flex flex-col sm:flex-row sm:gap-4">
                          <span><strong className="text-amber-200/90 font-medium">Expected:</strong> {check.expected_value}</span>
                          <span><strong className="text-amber-200/90 font-medium">Actual:</strong> {check.actual_value}</span>
                          <span className="text-amber-300/90 font-semibold">{check.discrepancy}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {isFlagged && result.validation.audit_report && (
                  <div className="mb-8 overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 ring-1 ring-amber-500/20 p-5">
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-amber-500 mb-3 flex items-center gap-2">
                      <SparklesIcon className="h-3.5 w-3.5" /> AI Audit Diagnostic
                    </h4>
                    <p className="text-sm font-medium text-amber-200/90 leading-relaxed whitespace-pre-wrap">
                      {result.validation.audit_report}
                    </p>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-lg bg-white/5 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-white/10 ring-1 ring-white/10"
                  >
                    Upload Another
                  </button>

                  <Link
                    to={`/invoices/${encodeURIComponent(result.invoice.invoice_number)}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-white/10 ring-1 ring-white/10"
                  >
                    Deep Dive <ExternalLink className="h-3.5 w-3.5 text-(--muted)" />
                  </Link>

                  {isFlagged && (
                    <Link
                      to="/review"
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-4 py-2.5 text-[13px] font-medium text-amber-300 transition hover:bg-amber-500/30 ring-1 ring-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)] ml-auto"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" /> Start Review
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </motion.div>
    </div>
  )
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4.318 6.318a4.5 4.5 0 0 0 0 6.364L12 20.364l7.682-7.682a4.5 4.5 0 0 0-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 0 0-6.364 0z" />
    </svg>
  );
}
