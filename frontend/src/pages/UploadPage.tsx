import { useEffect, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import type { FileRejection } from 'react-dropzone'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, FileUp, LoaderCircle, X } from 'lucide-react'
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
    <div className="relative">
      <UploadScene />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="space-y-6"
      >
        <PageShell
          title="Upload Invoice"
          description="Drop a PDF invoice, process it with AI validation, and review detailed extraction results."
        >
          <div className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-2xl border-2 border-dashed transition ${
                  isDragActive
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-(--line) bg-white/85 hover:border-teal-300 hover:bg-teal-50/40'
                }`}
              >
                <input {...getInputProps()} />
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="p-8 text-center"
                >
                  <FileUp className="mx-auto h-10 w-10 text-(--brand-ink)" />
                  <h3 className="mt-3 text-lg font-semibold text-(--ink)">Drop PDF here</h3>
                  <p className="mt-1 text-sm text-(--muted)">or click to browse files</p>
                  <p className="mt-1 text-xs text-(--muted)">1 file only, max {(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)}MB</p>
                </motion.div>
              </div>

              {fileDropErrors.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <ul className="space-y-1">
                    {fileDropErrors.map((errorMessage) => (
                      <li key={errorMessage}>- {errorMessage}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedFile && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between rounded-xl border border-(--line) bg-white p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-(--ink)">{selectedFile.name}</p>
                    <p className="text-xs text-(--muted)">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-full border border-(--line) p-1.5 text-(--muted) hover:bg-slate-50"
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
                onClick={() => {
                  void handleProcessInvoice()
                }}
                disabled={!selectedFile || isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-(--brand) px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Processing Invoice...
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4" />
                    Process Invoice
                  </>
                )}
              </motion.button>
            </div>

            <div className="rounded-2xl border border-(--line) bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-(--ink)">Processing Progress</h3>
              <div className="mt-3 space-y-2.5">
                {PROCESS_STAGES.map((stage, index) => {
                  const state = stageState(index, currentStage)
                  return (
                    <div key={stage} className="flex items-center gap-2.5 text-sm">
                      {state === 'complete' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : state === 'active' && isPending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin text-sky-600" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border border-(--line)" />
                      )}
                      <span
                        className={`${
                          state === 'active' ? 'font-semibold text-(--ink)' : 'text-(--muted)'
                        }`}
                      >
                        {stage}
                      </span>
                    </div>
                  )
                })}
              </div>

              {processingError && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {processingError}
                </div>
              )}
            </div>
          </div>
        </PageShell>

        {result && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="space-y-5 rounded-2xl border border-(--line) bg-white p-6 shadow-sm"
          >
            <div
              className={`rounded-xl p-3 text-sm font-semibold ${
                isFlagged
                  ? 'border border-amber-200 bg-amber-50 text-amber-800'
                  : 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {isFlagged ? (
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Issues Found - Invoice flagged for review
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> All Checks Passed - Invoice processed successfully
                </span>
              )}
            </div>

            <div className="grid gap-3 rounded-xl border border-(--line) bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-(--muted)">Vendor</p>
                <p className="font-semibold text-(--ink)">{result.invoice.vendor_name}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-(--muted)">Invoice #</p>
                <p className="font-semibold text-(--ink)">{result.invoice.invoice_number}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-(--muted)">Date</p>
                <p className="font-semibold text-(--ink)">{formatDate(result.invoice.date)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-(--muted)">Due Date</p>
                <p className="font-semibold text-(--ink)">{formatDate(result.invoice.due_date)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-(--muted)">Currency</p>
                <p className="font-semibold text-(--ink)">{result.invoice.currency}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-(--muted)">Status</p>
                <p className="font-semibold text-(--ink)">{result.status}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-(--line)">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-(--muted)">
                  <tr>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Unit Price</th>
                    <th className="px-4 py-3">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.invoice.line_items.map((item) => (
                    <tr key={item.id} className="border-t border-(--line)">
                      <td className="px-4 py-3 text-(--ink)">{item.description}</td>
                      <td className="px-4 py-3 text-(--ink)">{item.quantity}</td>
                      <td className="px-4 py-3 text-(--ink)">
                        {formatCurrency(item.unit_price, result.invoice.currency)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-(--ink)">
                        {formatCurrency(item.line_total, result.invoice.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto w-full max-w-md space-y-1 rounded-xl border border-(--line) bg-slate-50 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-(--muted)">Subtotal</span>
                <span className="font-semibold text-(--ink)">
                  {formatCurrency(result.invoice.subtotal, result.invoice.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-(--muted)">Tax ({result.invoice.tax_rate}%)</span>
                <span className="font-semibold text-(--ink)">
                  {formatCurrency(result.invoice.tax_amount, result.invoice.currency)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-(--line) pt-2">
                <span className="font-semibold text-(--ink)">Grand Total</span>
                <span className="text-base font-extrabold text-(--ink)">
                  {formatCurrency(result.invoice.grand_total, result.invoice.currency)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-(--line) bg-white p-4">
              <h3 className="text-sm font-semibold text-(--ink)">Validation Checks</h3>
              <div className="mt-3 space-y-2 text-sm">
                {result.validation.checks.map((check) => (
                  <motion.div
                    key={check.check_name}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-lg border px-3 py-2 ${
                      check.passed
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <p className="font-medium">{check.check_name}</p>
                    {!check.passed && (
                      <p className="mt-1 text-xs">
                        Expected: {check.expected_value} | Actual: {check.actual_value} | Discrepancy: {check.discrepancy}
                      </p>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {isFlagged && result.validation.audit_report && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-amber-200 bg-amber-50 p-4"
              >
                <h3 className="text-sm font-semibold text-amber-900">AI Audit Report</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-amber-800">{result.validation.audit_report}</p>
              </motion.div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-xl border border-(--line) px-4 py-2 text-sm font-semibold text-(--ink) hover:bg-slate-50"
              >
                Upload Another
              </button>

              <Link
                to={`/invoices/${encodeURIComponent(result.invoice.invoice_number)}`}
                className="rounded-xl border border-(--line) px-4 py-2 text-sm font-semibold text-(--ink) hover:bg-slate-50"
              >
                Open Invoice Detail
              </Link>

              <Link
                to="/invoices"
                className="rounded-xl border border-(--line) px-4 py-2 text-sm font-semibold text-(--ink) hover:bg-slate-50"
              >
                View in Explorer
              </Link>

              {isFlagged && (
                <Link
                  to="/review"
                  className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                >
                  Go to Review Queue
                </Link>
              )}
            </div>
          </motion.section>
        )}
      </motion.div>
    </div>
  )
}
