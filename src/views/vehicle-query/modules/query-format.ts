import dayjs from 'dayjs'
import { isEmpty, isNil, maxBy } from 'lodash-es'
import { createDateTimeFormatter, formatNumberValue } from '@/utils/ui/format'
import type { ArtDescriptionItem } from '@/components/core/base/art-descriptions/types'
import type { InfoItem } from './types'

export const EMPTY_TEXT = '--'

export const formatValue = (value?: unknown, suffix = ''): string => {
  if (isNil(value) || value === '') return EMPTY_TEXT
  if (Array.isArray(value) && isEmpty(value)) return EMPTY_TEXT
  return `${value}${suffix}`
}

export const formatDate = createDateTimeFormatter({
  format: 'YYYY-MM-DD',
  invalidText: EMPTY_TEXT,
  allowTimeOnly: false
})

export const formatDateTime = createDateTimeFormatter({
  invalidText: EMPTY_TEXT,
  allowTimeOnly: false
})

export const formatMileage = (value?: number | null): string => {
  if (isNil(value)) return EMPTY_TEXT
  return `${formatNumberValue(value)}公里`
}

export const createDescriptionItems = (items: InfoItem[]): ArtDescriptionItem[] =>
  items.map((item, index) => ({
    key: `${item.label}-${index}`,
    label: item.label,
    value: item.value,
    dictCode: item.dictCode,
    render: item.render,
    formatter: item.dictCode || item.render ? undefined : () => formatValue(item.value, item.suffix)
  }))

export const getLatestByDate = <TRecord>(
  records: TRecord[],
  getDate: (record: TRecord) => string | null | undefined
): TRecord | undefined =>
  maxBy(records, (record) => {
    const value = getDate(record)
    const date = value ? dayjs(value) : null
    return date?.isValid() ? date.valueOf() : 0
  })

export const getExpireDateByYears = (
  startDate?: string | null,
  years?: number | null
): string | null => {
  if (isNil(startDate) || startDate === '' || isNil(years)) return null
  if (!dayjs(startDate).isValid()) return null
  return dayjs(startDate).add(years, 'year').format('YYYY-MM-DD')
}
