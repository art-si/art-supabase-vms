import type {
  CertificateRecord,
  CertificateStatus,
  CertificateSubjectType,
  CertificateType
} from '../../../types/certificate'

export const CERTIFICATE_TYPE_OPTIONS: Record<
  CertificateSubjectType,
  { value: CertificateType }[]
> = {
  vehicle: [
    { value: 'vehicle_registration' },
    { value: 'road_transport' },
    { value: 'compulsory_insurance' },
    { value: 'commercial_insurance' },
    { value: 'vehicle_tax' },
    { value: 'annual_inspection' }
  ],
  driver: [
    { value: 'identity_card' },
    { value: 'driver_license' },
    { value: 'professional_qualification' }
  ]
}

export const CERTIFICATE_STATUS_OPTIONS: { value: CertificateStatus }[] = [
  { value: 'valid' },
  { value: 'due_3_months' },
  { value: 'due_30' },
  { value: 'due_15' },
  { value: 'due_today' },
  { value: 'expired' },
  { value: 'handled' },
  { value: 'revoked' }
]

export interface CertificateDictionaryOption {
  value: string
  label?: string
  name?: string
}

export function certificateTypeLabel(
  type: CertificateType,
  options: readonly CertificateDictionaryOption[]
): string {
  const option = options.find((item) => item.value === type)
  return option?.label || option?.name || '其他证件'
}

export function certificateStatusLabel(
  status: CertificateStatus,
  options: readonly CertificateDictionaryOption[]
): string {
  const option = options.find((item) => item.value === status)
  return option?.label || option?.name || '未知状态'
}

export function certificateStatusTableLabel(
  status: CertificateStatus,
  options: readonly CertificateDictionaryOption[]
): string {
  if (status === 'due_3_months') return '3 个月内'
  if (status === 'due_30') return '30 天内'
  if (status === 'due_15') return '15 天内'
  return certificateStatusLabel(status, options)
}

export function certificateStatusTone(
  status: CertificateStatus
): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'expired') return 'danger'
  if (
    status === 'due_today' ||
    status === 'due_15' ||
    status === 'due_30' ||
    status === 'due_3_months'
  )
    return 'warning'
  if (status === 'handled' || status === 'revoked') return 'info'
  return 'success'
}

export function certificateRiskCounts(rows: CertificateRecord[]): {
  expired: number
  dueSoon: number
  handled: number
  revoked: number
} {
  return rows.reduce(
    (counts, row) => {
      const isCurrent = row.isCurrent !== false
      if (isCurrent && row.status === 'expired') counts.expired += 1
      if (isCurrent && row.status === 'revoked') counts.revoked += 1
      if (isCurrent && ['due_today', 'due_15', 'due_30', 'due_3_months'].includes(row.status))
        counts.dueSoon += 1
      if (row.status === 'handled') counts.handled += 1
      return counts
    },
    { expired: 0, dueSoon: 0, handled: 0, revoked: 0 }
  )
}

export function canMarkCertificateHandled(row: CertificateRecord): boolean {
  return !isLegacyCertificateRecord(row) && row.status !== 'handled' && row.status !== 'revoked'
}

export function canRenewCertificate(row: CertificateRecord): boolean {
  return !isLegacyCertificateRecord(row) && row.isCurrent !== false
}

export function isLegacyCertificateRecord(row: CertificateRecord): boolean {
  return row.sourceKind === 'legacy_insurance' || row.sourceKind === 'legacy_inspection'
}
