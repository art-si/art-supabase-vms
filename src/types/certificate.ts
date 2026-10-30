export type CertificateSubjectType = 'vehicle' | 'driver'

export type CertificateType =
  | 'vehicle_registration'
  | 'road_transport'
  | 'compulsory_insurance'
  | 'commercial_insurance'
  | 'vehicle_tax'
  | 'annual_inspection'
  | 'identity_card'
  | 'driver_license'
  | 'professional_qualification'

export type CertificateStatus =
  'valid' | 'due_3_months' | 'due_30' | 'due_15' | 'due_today' | 'expired' | 'handled' | 'revoked'

export interface CertificateAttachment {
  name: string
  url: string
  fileType?: string
  fileSize?: string
}

export interface CertificateRecord {
  id: string
  sourceKind?: 'certificate' | 'legacy_insurance' | 'legacy_inspection'
  isCurrent?: boolean
  tenantId: string
  subjectType: CertificateSubjectType
  subjectId: string
  subjectLabel: string
  certificateType: CertificateType
  certificateNo: string
  issueDate: string | null
  validFrom: string | null
  expiresOn: string
  attachments: CertificateAttachment[]
  responsibleUserId: string
  responsibleName: string
  renewalOfId: string | null
  handledAt: string | null
  handledBy: string | null
  revokedAt: string | null
  revokedOn: string | null
  revokedBy: string | null
  revokedReason: string | null
  status: CertificateStatus
}

export interface CertificateSubjectOption {
  id: string
  label: string
  tenantId: string
}

export interface CertificateResponsibleOption {
  id: string
  userName?: string | null
  nickName?: string | null
  userEmail?: string | null
  avatar?: string | null
}

export interface CertificateSearchParams {
  from?: number
  to?: number
  subjectType?: CertificateSubjectType | ''
  subjectId?: string
  status?: CertificateStatus | ''
  keyword?: string
}

export interface CertificateWritePayload {
  subjectType: CertificateSubjectType
  subjectId: string
  certificateType: CertificateType
  certificateNo: string
  issueDate: string | null
  validFrom: string | null
  expiresOn: string
  attachments: CertificateAttachment[]
  responsibleUserId: string
  renewalOfId: string | null
}
