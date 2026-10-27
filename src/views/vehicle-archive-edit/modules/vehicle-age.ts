import dayjs from 'dayjs'

/** Vehicle age is display-only and always derived from the purchase date. */
export function formatVehicleAge(purchaseDate?: string | null, asOf = new Date()): string {
  if (!purchaseDate) return ''
  const purchased = dayjs(purchaseDate)
  const today = dayjs(asOf)
  if (!purchased.isValid() || purchased.isAfter(today)) return ''

  const months = today.diff(purchased, 'month')
  if (months < 12) return `${months} 个月`
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12
  return `${years} 年${remainingMonths ? ` ${remainingMonths} 个月` : ''}`
}
