import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { ReviewPage } from './ReviewPage'
import {
  getFlaggedInvoices,
  getReviewHistory,
  getReviewedInvoices,
  resolveFlaggedInvoice,
} from '../api/reviews'

vi.mock('../components/three/ReviewScene', () => ({
  ReviewScene: () => <div data-testid="review-scene" />,
}))

vi.mock('../api/reviews', () => ({
  getFlaggedInvoices: vi.fn(),
  getReviewHistory: vi.fn(),
  getReviewedInvoices: vi.fn(),
  resolveFlaggedInvoice: vi.fn(),
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
        <ReviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function makeAxiosError(status: number, detail?: string) {
  const error = new AxiosError('request failed')
  error.response = {
    status,
    statusText: 'error',
    headers: {},
    config: {} as never,
    data: detail ? { detail } : {},
  }
  return error
}

describe('ReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(getFlaggedInvoices).mockResolvedValue([
      {
        id: 'inv-1',
        invoice_number: 'INV 001/A',
        vendor_name: 'Globex',
        grand_total: 1299.5,
        currency: 'USD',
        status: 'FLAGGED',
        processed_at: '2026-03-20T10:00:00Z',
        audit_report: 'Mismatch detected in tax amount',
      },
    ])

    vi.mocked(getReviewedInvoices).mockResolvedValue({
      total: 1,
      page: 1,
      per_page: 15,
      total_pages: 1,
      invoices: [
        {
          id: 'inv-reviewed',
          invoice_number: 'INV-REV-2',
          vendor_name: 'Initech',
          date: '2026-03-19',
          grand_total: 999,
          currency: 'USD',
          status: 'REVIEWED',
          processed_at: '2026-03-19T10:00:00Z',
        },
      ],
    })

    vi.mocked(getReviewHistory).mockResolvedValue([
      {
        id: 'hist-1',
        invoice_id: 'inv-reviewed',
        reviewed_by: { id: 'user-1', full_name: 'Asha Auditor' },
        review_note: 'Approved after checking tax breakdown.',
        reviewed_at: '2026-03-19T11:00:00Z',
      },
    ])
  })

  it('submits reviewer note and transitions from pending to reviewed', async () => {
    vi.mocked(resolveFlaggedInvoice).mockResolvedValue({
      invoice_id: 'inv-1',
      invoice_number: 'INV 001/A',
      status: 'REVIEWED',
      reviewed_by: { id: 'user-1', full_name: 'Asha Auditor' },
      review_note: '  Looks good after review  ',
      reviewed_at: '2026-03-20T11:20:00Z',
    })

    renderPage()

    expect(await screen.findByText('INV 001/A')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    fireEvent.change(screen.getByPlaceholderText('Add context for this decision...'), {
      target: { value: '  Looks good after review  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Reviewed' }))

    await waitFor(() => {
      expect(resolveFlaggedInvoice).toHaveBeenCalledWith('inv-1', { note: 'Looks good after review' })
    })

    await waitFor(() => {
      expect(screen.getByText('Recent Review Notes')).toBeInTheDocument()
    })

    expect(toast.success).toHaveBeenCalledWith('Invoice INV 001/A moved to reviewed')
  })

  it.each([
    [400, 'Invoice is not flagged', 'Invoice is not flagged'],
    [404, undefined, 'Invoice was not found. Refresh queue and try again.'],
    [500, undefined, 'Server error while resolving invoice. Please retry.'],
  ])('handles resolve error branch for status %s', async (statusCode, detail, expectedMessage) => {
    vi.mocked(resolveFlaggedInvoice).mockRejectedValue(makeAxiosError(statusCode as number, detail as string | undefined))

    renderPage()

    expect(await screen.findByText('INV 001/A')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Reviewed' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expectedMessage)
    })
  })

  it('renders review history in reviewed flow', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Reviewed/i }))

    await screen.findByText('Recent Review Notes')
    const reviewerName = screen.getByText('Asha Auditor')
    const noteCard = reviewerName.closest('div')

    expect(noteCard).toBeTruthy()

    const scoped = within(noteCard as HTMLElement)
    expect(scoped.getByText('Approved after checking tax breakdown.')).toBeInTheDocument()
  })
})
