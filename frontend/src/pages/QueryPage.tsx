import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, ExternalLink, LoaderCircle, MessageSquareDashed, SendHorizonal, Trash2 } from 'lucide-react'
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
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

const pageTransition = { duration: 0.3 }

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
    <div className="text-sm text-(--ink)">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 leading-relaxed last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 marker:text-(--brand-ink)">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-(--brand-ink)">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-(--ink)">{children}</strong>,
          em: ({ children }) => <em className="text-(--ink)">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 rounded-r-lg border-l-4 border-amber-300 bg-amber-50 px-3 py-2 text-(--ink)">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-(--brand-ink) underline decoration-amber-300 underline-offset-2 hover:decoration-amber-500"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-(--line) bg-white">
              <table className="min-w-full border-collapse text-left text-xs sm:text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-50 text-(--muted)">{children}</thead>,
          th: ({ children }) => <th className="border-b border-(--line) px-3 py-2 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-(--line) px-3 py-2 align-top">{children}</td>,
          hr: () => <hr className="my-3 border-(--line)" />,
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
        content: 'I could not process that query right now. Please try again in a moment.',
      })
      setHistory((prev) => [...prev, assistantError])
      toast.error('Query failed. Please retry.')
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
    toast.success('Session chat history cleared')
  }

  return (
    <div className="relative">
      <QueryScene />
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="space-y-6"
      >
        <PageShell
          title="Ask ReconLedger"
          description="Run conversational analytics, view answer evidence, and jump to source invoices instantly."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3.5 py-2">
              <p className="text-xs text-(--muted)">
                History persists for this browser session and clears when the session ends.
              </p>
              <button
                type="button"
                onClick={clearSessionHistory}
                className="inline-flex items-center gap-1.5 rounded-lg border border-(--line) bg-white px-2.5 py-1 text-xs font-semibold text-(--ink) hover:bg-slate-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Session History
              </button>
            </div>

            {!hasHistory && !askMutation.isPending && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-(--line) bg-white p-4"
              >
                <div className="flex items-start gap-2.5">
                  <MessageSquareDashed className="mt-0.5 h-4 w-4 text-(--brand-ink)" />
                  <div>
                    <p className="text-sm font-semibold text-(--ink)">Suggested prompts</p>
                    <p className="mt-1 text-xs text-(--muted)">
                      Start with one of these and refine based on the answer.
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <motion.button
                      key={prompt}
                      type="button"
                      whileHover={{ y: -1.5 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => submitQuestion(prompt)}
                      className="rounded-xl border border-(--line) bg-slate-50 p-3 text-left text-xs text-(--ink) hover:bg-amber-50"
                    >
                      {prompt}
                    </motion.button>
                  ))}
                </div>
              </motion.section>
            )}

            <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-2xl border border-(--line) bg-white p-3">
              <AnimatePresence>
                {history.map((message) => (
                  <motion.article
                    key={message.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-2xl border p-3 ${
                      message.role === 'user'
                        ? 'ml-auto max-w-[92%] border-amber-200 bg-amber-50'
                        : 'mr-auto max-w-[95%] border-(--line) bg-slate-50'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--muted)">
                      {message.role === 'assistant' ? <Bot className="h-3.5 w-3.5" /> : null}
                      {message.role === 'assistant' ? 'ReconLedger' : 'You'}
                    </div>
                    {message.role === 'assistant' ? (
                      <AssistantMarkdown content={message.content} />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-(--ink)">{message.content}</p>
                    )}

                    {message.role === 'assistant' && (message.sources?.length ?? 0) > 0 && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-(--ink)">Source Invoices</p>
                          <span className="text-[11px] text-(--muted)">
                            Retrieved: {message.numDocumentsRetrieved ?? message.sources?.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {message.sources?.map((source) => (
                            <Link
                              key={`${message.id}-${source}`}
                              to={`/invoices/${encodeURIComponent(source)}`}
                              className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                            >
                              {source}
                              <ExternalLink className="h-3 w-3" />
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
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mr-auto inline-flex items-center gap-2 rounded-2xl border border-(--line) bg-slate-50 px-3 py-2 text-sm text-(--muted)"
                >
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  ReconLedger is analyzing your request...
                </motion.div>
              )}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                submitQuestion()
              }}
              className="flex items-end gap-2"
            >
              <label className="block flex-1">
                <span className="sr-only">Ask ReconLedger a question</span>
                <textarea
                  value={questionInput}
                  onChange={(event) => setQuestionInput(event.target.value)}
                  rows={2}
                  placeholder="Ask about flagged trends, vendor risk, high-value invoices, or review summaries..."
                  className="w-full resize-none rounded-2xl border border-(--line) bg-white px-3 py-2.5 text-sm text-(--ink) outline-none ring-(--brand)/25 transition focus:ring"
                />
              </label>

              <motion.button
                type="submit"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                disabled={isSendDisabled}
                className="inline-flex items-center gap-2 rounded-xl bg-(--brand) px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {askMutation.isPending ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Asking...
                  </>
                ) : (
                  <>
                    <SendHorizonal className="h-4 w-4" />
                    Ask
                  </>
                )}
              </motion.button>
            </form>
          </div>
        </PageShell>
      </motion.div>
    </div>
  )
}
