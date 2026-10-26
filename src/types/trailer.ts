export interface TrailerRecord {
  id: string
  tenantId: string
  plateNo: string
  plateColor: string
  vehicleTypeProfileId: string | null
  trailerType: string
  vin: string | null
  ownerName: string | null
  brandModel: string | null
  archiveNo: string | null
  curbWeightKg: number | null
  approvedLoadKg: number | null
  lengthMm: number | null
  widthMm: number | null
  heightMm: number | null
  inspectionValidUntil: string | null
  mandatoryScrapDate: string | null
  ownership: string
  defaultTractorId: string | null
  defaultTractorPlateNo?: string | null
  companyOrganizationId: string | null
  companyName: string | null
  source: string | null
  remark: string | null
  licenseFrontUrl: string | null
  licenseBackUrl: string | null
  licenseBackReverseUrl: string | null
  rearPhotoUrl: string | null
  status: string
  createTime: string
  updateTime: string
}

export type TrailerWritePayload = Pick<
  TrailerRecord,
  | 'plateNo'
  | 'plateColor'
  | 'vehicleTypeProfileId'
  | 'trailerType'
  | 'vin'
  | 'ownerName'
  | 'brandModel'
  | 'archiveNo'
  | 'curbWeightKg'
  | 'approvedLoadKg'
  | 'lengthMm'
  | 'widthMm'
  | 'heightMm'
  | 'inspectionValidUntil'
  | 'mandatoryScrapDate'
  | 'ownership'
  | 'defaultTractorId'
  | 'companyOrganizationId'
  | 'source'
  | 'remark'
  | 'licenseFrontUrl'
  | 'licenseBackUrl'
  | 'licenseBackReverseUrl'
  | 'rearPhotoUrl'
>

export interface TrailerSearchParams {
  from: number
  to: number
  plateNo?: string
}

export interface TrailerCompanyOption {
  id: string
  label: string
  isDefault?: boolean
}
