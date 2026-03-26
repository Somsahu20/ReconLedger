import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, ExternalLink, LoaderCircle, MessageSquareDashed, SendHorizonal, Trash2, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Link } from 'react-router-dom'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { askInvoiceQuery } from '../api/query'
import { QueryScene } from '../components/three/QueryScene'
import type { ChatMessage } from '../types/query'
import { PageShell } from './PageShell'

const CHAT_HISTORY_KEY = 'reconledger-query-chat-v1'

const SUGGESTED_PROMPTS = [
  'Which invoices above INR 1,00,000 are currently flagged?',
  'Summarize total reviewed invoice value for this month.',
  'Show invoices where tax amount seems unusually high.',
  'List vendors with multiple flagged invoices in the last 30 days.',
]

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
}

const pageTransition = { duration: 0.28 }

function buildMessage(message: Omit<ChatMessage, 'id' | 'createdAt'>): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...message,
  }
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(CHAT_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatMessage[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm text-white/90">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-2 pl-5 marker:text-(--brand)">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal space-y-2 pl-5 marker:text-(--brand)">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
          em: ({ children }) => <em className="text-white/80">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 rounded-r-xl border-l-4 border-(--brand) bg-(--brand)/10 px-4 py-3 text-white/90">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-(--brand) underline decoration-(--brand)/30 underline-offset-4 hover:decoration-(--brand) transition-colors"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
              <table className="min-w-full border-collapse text-left text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-(--muted) border-b border-white/10">{children}</thead>,
          th: ({ children }) => <th className="px-4 py-3 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-white/5 px-4 py-3 align-top">{children}</td>,
          hr: () => <hr className="my-4 border-white/10" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export function QueryPage() {
  const [history, setHistory] = useState<ChatMessage[]>(() => loadHistory())
  const [questionInput, setQuestionInput] = useState('')

  useEffect(() => {
    sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history))
  }, [history])

  const askMutation = useMutation({
    mutationFn: askInvoiceQuery,
    onSuccess: (response) => {
      const assistantMessage = buildMessage({
        role: 'assistant',
        content: response.answer,
        sources: response.source_invoices,
        numDocumentsRetrieved: response.num_documents_retrieved,
      })
      setHistory((prev) => [...prev, assistantMessage])
    },
    onError: () => {
      const assistantError = buildMessage({
        role: 'assistant',
        content: 'I could not process that query right now. Please try again in a moment or refine your request parameters.',
      })
      setHistory((prev) => [...prev, assistantError])
      toast.error('Query execution failed. System retrying.')
    },
  })

  const hasHistory = history.length > 0

  const isSendDisabled = useMemo(
    () => askMutation.isPending || questionInput.trim().length < 3,
    [askMutation.isPending, questionInput],
  )

  function submitQuestion(nextQuestion?: string) {
    const question = (nextQuestion ?? questionInput).trim()
    if (question.length < 3) {
      toast.error('Please enter at least 3 characters.')
      return
    }

    const userMessage = buildMessage({
      role: 'user',
      content: question,
    })

    setHistory((prev) => [...prev, userMessage])
    setQuestionInput('')
    askMutation.mutate(question)
  }

  function clearSessionHistory() {
    setHistory([])
    sessionStorage.removeItem(CHAT_HISTORY_KEY)
    toast.success('Session memory purged')
  }

  return (
    <div className="relative min-h-[calc(100vh-(--spacing(16)))] pb-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-indigo-900/10 via-[#070d1f] to-[#070d1f]" />
      <QueryScene />

      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="space-y-6 mx-auto max-w-5xl px-4 sm:px-6 mt-8"
      >
        <PageShell
          title="Neural Ledger Inquiry"
          description="Execute natural language analytical queries against ingested ledger vectors with cryptographic evidence mapping."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.02] ring-1 ring-white/10 px-4 py-3 backdrop-blur-md">
              <p className="text-xs text-(--muted) flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-(--brand)" />
                Context window persists for the current temporal session.
              </p>
              <button
                type="button"
                onClick={clearSessionHistory}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Purge Memory
              </button>
            </div>

            {!hasHistory && !askMutation.isPending && (
              <motion.section
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6 sm:p-8 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
              >
                <div className="flex items-center justify-center mb-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--brand)/10 text-(--brand) ring-1 ring-(--brand)/20 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                    <MessageSquareDashed className="h-8 w-8" />
                  </div>
                </div>
                <div className="text-center mb-8">
                  <p className="text-xl font-light tracking-tight text-white">Suggested Vector Operations</p>
                  <p className="mt-2 text-[13px] text-(--muted) max-w-sm mx-auto">
                    Initiate neural analysis using these predefined operational prompts. System will map answers back to the source ledger.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <motion.button
                      key={prompt}
                      type="button"
                      whileHover={{ y: -2, backgroundColor: 'rgba(255,255,255,0.06)' }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => submitQuestion(prompt)}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-[13px] text-white/90 transition-all font-medium leading-relaxed hover:border-white/20"
                    >
                      {prompt}
                    </motion.button>
                  ))}
                </div>
              </motion.section>
            )}

            <div className="flex flex-col gap-4 max-h-[55vh] overflow-y-auto custom-scrollbar pr-2 pb-4">
              <AnimatePresence initial={false}>
                {history.map((message) => (
                  <motion.article
                    key={message.id}
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className={`rounded-[1.5rem] p-5 backdrop-blur-md shadow-sm border ${
                      message.role === 'user'
                        ? 'ml-auto max-w-[85%] border-(--brand)/30 bg-(--brand)/10 text-white rounded-br-sm'
                        : 'mr-auto max-w-[90%] border-white/10 bg-white/[0.03] text-white/90 rounded-bl-sm'
                    }`}
                  >
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/50 border-b border-white/10 pb-2">
                      {message.role === 'assistant' ? <Bot className="h-3.5 w-3.5 text-(--brand)" /> : <span className="h-2 w-2 rounded-full bg-(--brand) shrink-0" />}
                      {message.role === 'assistant' ? 'System Intel' : 'Operator'}
                    </div>
                    {message.role === 'assistant' ? (
                      <AssistantMarkdown content={message.content} />
                    ) : (
                      <p className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed">{message.content}</p>
                    )}

                    {message.role === 'assistant' && (message.sources?.length ?? 0) > 0 && (
                      <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 relative overflow-hidden">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent" />
                        <div className="relative z-10 mb-3 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-(--brand)">Evidence Vectors</p>
                          <span className="text-[10px] text-(--muted) font-mono bg-[#0f172a] px-2 py-0.5 rounded-full ring-1 ring-white/10">
                            NODE_COUNT: {message.numDocumentsRetrieved ?? message.sources?.length}
                          </span>
                        </div>
                        <div className="relative z-10 flex flex-wrap gap-2">
                          {message.sources?.map((source) => (
                            <Link
                              key={`${message.id}-${source}`}
                              to={`/invoices/${encodeURIComponent(source)}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-(--brand)/20 bg-(--brand)/5 px-3 py-1.5 text-xs font-semibold text-(--brand) hover:bg-(--brand)/15 transition-colors ring-1 ring-transparent hover:ring-(--brand)/30"
                            >
                              {source}
                              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.article>
                ))}
              </AnimatePresence>

              {askMutation.isPending && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mr-auto inline-flex items-center gap-3 rounded-[1.5rem] rounded-bl-sm border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-(--muted) backdrop-blur-md"
                >
                  <LoaderCircle className="h-5 w-5 animate-spin text-(--brand)" />
                  <span className="font-mono text-[13px]">Processing neural operation...</span>
                </motion.div>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                submitQuestion()
              }}
              className="flex items-end gap-3 rounded-[2rem] border border-white/10 bg-white/[0.02] p-2 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] focus-within:ring-1 focus-within:ring-(--brand)/50 focus-within:border-(--brand)/50 transition-all duration-300"
            >
              <label className="block flex-1 pl-4">
                <span className="sr-only">Ask ReconLedger a question</span>
                <textarea
                  value={questionInput}
                  onChange={(event) => setQuestionInput(event.target.value)}
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (!isSendDisabled) submitQuestion()
                    }
                  }}
                  placeholder="Execute query string (e.g. identify fiscal anomalies...)"
                  className="w-full resize-none bg-transparent py-3 text-sm text-white placeholder:text-white/30 outline-none custom-scrollbar font-medium"
                />
              </label>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                disabled={isSendDisabled}
                className="inline-flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-gradient-to-br from-(--brand) to-(--brand-ink) text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:brightness-110 mb-1 mr-1"
                aria-label="Execute query"
              >
                {askMutation.isPending ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <SendHorizonal className="h-5 w-5 -ml-0.5" />
                )}
              </motion.button>
            </form>
          </div>
        </PageShell>
      </motion.div>
    </div>
  )
}
