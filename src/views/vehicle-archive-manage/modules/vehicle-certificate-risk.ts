import type { CertificateType } from '../../../types/certificate'
import { certificateTypeLabel } from '../../certificate-center/modules/certificate-policy'

export type VehicleCertificateRisk = 'expired' | 'renewal_due' | 'valid' | 'none'

export interface VehicleCertificateRiskSummary {
  certificateRisk?: VehicleCertificateRisk
  certificateRiskType?: CertificateType | null
  certificateRiskExpiresOn?: string | null
}

export function vehicleCertificateRiskNeedsAttention(risk?: VehicleCertificateRisk): boolean {
  return risk === 'expired' || risk === 'renewal_due'
}

export function vehicleCertificateRiskDisplay(summary: VehicleCertificateRiskSummary): {
  label: string
  detail: string
  tone: 'danger' | 'warning' | 'success' | 'info'
} {
  const risk = summary.certificateRisk ?? 'none'
  const detail = summary.certificateRiskType
    ? `${certificateTypeLabel(summary.certificateRiskType)}${summary.certificateRiskExpiresOn ? ` · ${summary.certificateRiskExpiresOn}` : ''}`
    : '尚未登记车辆证件'

  if (risk === 'expired') return { label: '已过期', detail, tone: 'danger' }
  if (risk === 'renewal_due') return { label: '待换证', detail, tone: 'warning' }
  if (risk === 'valid') return { label: '有效', detail, tone: 'success' }
  return { label: '未登记', detail, tone: 'info' }
}
