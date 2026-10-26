import type {
  CertificateRecord,
  CertificateStatus,
  CertificateSubjectType,
  CertificateType
} from '../../../types/certificate'

export const CERTIFICATE_TYPE_OPTIONS: Record<
  CertificateSubjectType,
  { value: CertificateType; label: string }[]
> = {
  vehicle: [
    { value: 'vehicle_registration', label: '行驶证' },
    { value: 'road_transport', label: '道路运输证' },
    { value: 'compulsory_insurance', label: '交强险保单' },
    { value: 'commercial_insurance', label: '商业险保单' },
    { value: 'vehicle_tax', label: '车船税' },
    { value: 'annual_inspection', label: '审车检验' }
  ],
  driver: [
    { value: 'driver_license', label: '驾驶证' },
    { value: 'professional_qualification', label: '从业资格证' }
  ]
}

export const CERTIFICATE_STATUS_OPTIONS: { value: CertificateStatus; label: string }[] = [
  { value: 'valid', label: '有效' },
  { value: 'due_30', label: '30 天内到期' },
  { value: 'due_15', label: '15 天内到期' },
  { value: 'due_today', label: '今天到期' },
  { value: 'expired', label: '已过期' },
  { value: 'handled', label: '已处理' }
]

export function certificateTypeLabel(type: CertificateType): string {
  return (
    [...CERTIFICATE_TYPE_OPTIONS.vehicle, ...CERTIFICATE_TYPE_OPTIONS.driver].find(
      (item) => item.value === type
    )?.label ?? type
  )
}

export function certificateStatusLabel(status: CertificateStatus): string {
  return CERTIFICATE_STATUS_OPTIONS.find((item) => item.value === status)?.label ?? '未知状态'
}

export function certificateStatusTone(
  status: CertificateStatus
): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'expired') return 'danger'
  if (status === 'due_today' || status === 'due_15' || status === 'due_30') return 'warning'
  if (status === 'handled') return 'info'
  return 'success'
}

export function certificateRiskCounts(rows: CertificateRecord[]): {
  expired: number
  dueSoon: number
  handled: number
} {
  return rows.reduce(
    (counts, row) => {
      if (row.status === 'expired') counts.expired += 1
      if (['due_today', 'due_15', 'due_30'].includes(row.status)) counts.dueSoon += 1
      if (row.status === 'handled') counts.handled += 1
      return counts
    },
    { expired: 0, dueSoon: 0, handled: 0 }
  )
}

export function canMarkCertificateHandled(row: CertificateRecord): boolean {
  return row.status !== 'handled'
}
