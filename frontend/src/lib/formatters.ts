export function formatCurrency(value: number | string, currency = 'INR') {
  const amount = Number(value)
  const currencyCode = String(currency || 'INR').trim().toUpperCase()

  if (!Number.isFinite(amount)) {
    return `${currencyCode} 0.00`
  }

  const formattedAmount = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  return `${currencyCode} ${formattedAmount}`
}

export function formatDate(dateValue: string | null) {
  if (!dateValue) return 'N/A'

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return 'N/A'

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function toStatusLabel(status: unknown) {
  if (typeof status !== 'string') {
    return 'unknown'
  }

  const normalized = status.trim().toLowerCase()
  return normalized || 'unknown'
}
