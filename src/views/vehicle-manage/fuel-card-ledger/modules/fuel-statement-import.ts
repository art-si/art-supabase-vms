import type { FuelStatementImportRow } from '@/api/fuel-card-statement'

const HEADERS = {
  cardNo: ['油卡号', '卡号', 'cardNo', 'card_no'],
  occurredAt: ['消费时间', '交易时间', '发生时间', '时间', 'occurredAt', 'occurred_at'],
  amount: ['金额', '消费金额', '交易金额', 'amount'],
  liters: ['加油升数', '升数', '油量', 'liters'],
  stationName: ['加油站', '站点', 'stationName', 'station_name']
} as const

function findCell(row: Record<string, unknown>, aliases: readonly string[]): unknown {
  const key = Object.keys(row).find((name) => aliases.includes(name.trim()))
  return key ? row[key] : undefined
}

function requiredText(value: unknown, label: string, row: number): string {
  const text = value === null || value === undefined ? '' : String(value).trim()
  if (!text) throw new Error(`第 ${row} 行缺少${label}，请核对模板列名。`)
  return text
}

function numberValue(value: unknown, label: string, row: number): number {
  const parsed = Number(typeof value === 'string' ? value.replaceAll(',', '').trim() : value)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`第 ${row} 行${label}无效。`)
  return parsed
}

function parseOccurredAt(value: unknown, row: number): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1 || value > 2958465)
      throw new Error(`第 ${row} 行消费时间无效。`)
    const date = new Date(Math.round((value - 25569) * 86_400_000 - 8 * 3_600_000))
    if (!Number.isFinite(date.getTime())) throw new Error(`第 ${row} 行消费时间无效。`)
    return date.toISOString()
  }
  const text = requiredText(value, '消费时间', row).replaceAll('/', '-')
  const withTime = /^\d{4}-\d{1,2}-\d{1,2}$/.test(text) ? `${text} 12:00:00` : text
  const date = new Date(withTime)
  if (!Number.isFinite(date.getTime())) throw new Error(`第 ${row} 行消费时间无效。`)
  return date.toISOString()
}

/** Station statement headings remain the original evidence in rawRow. */
export function parseFuelStatementRows(
  records: Array<Record<string, unknown>>
): FuelStatementImportRow[] {
  if (!records.length) throw new Error('对账单没有可导入的明细。')
  if (records.length > 500) throw new Error('单次最多导入 500 行，请分批导入。')
  return records.map((rawRow, index) => {
    const sourceRow = index + 2
    const litersValue = findCell(rawRow, HEADERS.liters)
    const liters =
      litersValue === null || litersValue === undefined || String(litersValue).trim() === ''
        ? null
        : numberValue(litersValue, '加油升数', sourceRow)
    const amount = numberValue(findCell(rawRow, HEADERS.amount), '金额', sourceRow)
    return {
      sourceRow,
      cardNo: requiredText(findCell(rawRow, HEADERS.cardNo), '卡号', sourceRow),
      occurredAt: parseOccurredAt(findCell(rawRow, HEADERS.occurredAt), sourceRow),
      stationName: requiredText(findCell(rawRow, HEADERS.stationName), '加油站', sourceRow),
      liters,
      amount,
      rawRow
    }
  })
}

export async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
