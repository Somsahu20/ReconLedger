import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { toast } from 'sonner'
import { QueryPage } from './QueryPage'
import { askInvoiceQuery } from '../api/query'

vi.mock('../components/three/QueryScene', () => ({
  QueryScene: () => <div data-testid="query-scene" />,
}))

vi.mock('../api/query', () => ({
  askInvoiceQuery: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function renderPage() {
  const queryClient = makeQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <QueryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('QueryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()

    vi.mocked(askInvoiceQuery).mockResolvedValue({
      question: 'List flagged invoices',
      answer: 'Found 2 flagged invoices.',
      source_invoices: ['INV 001/A', 'INV-002'],
      num_documents_retrieved: 2,
    })
  })

  it('shows suggested prompts when chat history is empty', () => {
    renderPage()

    expect(screen.getByText('Suggested prompts')).toBeInTheDocument()
    expect(screen.getByText('Which invoices above INR 1,00,000 are currently flagged?')).toBeInTheDocument()
  })

  it('submits a question and renders source invoice deep links', async () => {
    renderPage()

    fireEvent.change(screen.getByPlaceholderText(/Ask about flagged trends/i), {
      target: { value: 'List flagged invoices' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^Ask$/i }))

    await waitFor(() => {
      expect(vi.mocked(askInvoiceQuery).mock.calls[0]?.[0]).toBe('List flagged invoices')
    })

    expect(await screen.findByText('Found 2 flagged invoices.')).toBeInTheDocument()
    const encodedSourceLink = screen.getByRole('link', { name: /INV 001\/A/i })
    expect(encodedSourceLink).toHaveAttribute('href', '/invoices/INV%20001%2FA')
  })

  it('loads history from session storage and can clear it', async () => {
    sessionStorage.setItem(
      'reconledger-query-chat-v1',
      JSON.stringify([
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Loaded from previous session.',
          createdAt: '2026-03-23T00:00:00.000Z',
        },
      ]),
    )

    renderPage()

    expect(await screen.findByText('Loaded from previous session.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Clear Session History/i }))

    await waitFor(() => {
      expect(screen.queryByText('Loaded from previous session.')).not.toBeInTheDocument()
    })

    expect(sessionStorage.getItem('reconledger-query-chat-v1')).toBe('[]')
    expect(toast.success).toHaveBeenCalledWith('Session chat history cleared')
  })
})
