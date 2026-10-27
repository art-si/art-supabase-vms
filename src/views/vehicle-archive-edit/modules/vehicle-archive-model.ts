import { omitNonEditableFieldGroups, omitWriteMetadata } from '@/utils/field-permission'
import { normalizeNonNullableText, normalizeNullableText } from '@/utils/form/normalize'

export type VehicleArchive = Api.Vms.ArchiveManage.VehicleArchive

export type VehicleArchiveForm = VehicleArchive & {
  aiArtifactId?: string | null
  primaryDriverName: string
  primaryDriverPhone: string
  secondaryDriverName: string
  secondaryDriverPhone: string
  vehicleAgeDisplay: string
}

export type VehicleArchiveWritePayload = Record<string, unknown> & { id?: string }

const EDITABLE_FIELD_ACCESS: Api.Vms.ArchiveManage.VehicleArchiveFieldAccessMap = {
  vehicleIdentifiers: 'edit',
  ownerIdentity: 'edit',
  contactPhones: 'edit',
  mailingAddress: 'edit',
  operationRoute: 'edit',
  documents: 'edit',
  deviceIdentity: 'edit'
}

const SENSITIVE_PAYLOAD_KEYS: Record<Api.Vms.ArchiveManage.VehicleArchiveFieldKey, string[]> = {
  vehicleIdentifiers: [
    'vin',
    'operationCertNo',
    'purchaseCertNo',
    'registrationCertNo',
    'chassisNo',
    'gearboxSerialNo',
    'engineNo',
    'licensePlateCode'
  ],
  ownerIdentity: ['ownerId', 'ownerName', 'ownerGender', 'idCardNo'],
  contactPhones: ['ownerPhone'],
  mailingAddress: ['mailingAddress'],
  operationRoute: ['operationRoute'],
  documents: [
    'drivingLicenseFrontUrl',
    'drivingLicenseBackUrl',
    'drivingLicenseBackReverseUrl',
    'personVehiclePhotoUrl',
    'vehicleHeadPhotoUrl',
    'operationLicenseUrl',
    'attachments'
  ],
  deviceIdentity: ['acCode', 'terminalPhone']
}

const NON_NULLABLE_TEXT_FIELDS = new Set([
  'plateNo',
  'vehicleType',
  'operationStatus',
  'vehicleOwnership'
])

export function requiresVehicleArchiveResubmission(
  auditStatus: VehicleArchive['auditStatus']
): boolean {
  return auditStatus === 'rejected'
}

export function createInitialVehicleArchiveForm(): VehicleArchiveForm {
  return {
    id: undefined,
    plateNo: '',
    carrierId: null,
    carrier: null,
    companyName: '',
    selfNo: '',
    vehicleType: '',
    vehicleTypeProfileId: null,
    vehicleOwnership: 'self_operated',
    specLengthM: null,
    volumeM3: null,
    loadTons: null,
    originType: 'domestic',
    vin: '',
    manufacturer: '',
    brandModel: '',
    operationCertNo: '',
    purchaseCertNo: '',
    registrationCertNo: '',
    vehicleColor: '',
    chassisNo: '',
    acCode: '',
    gearboxSerialNo: '',
    registerDate: '',
    issueDate: '',
    invoiceDate: '',
    startUseDate: '',
    serviceYears: null,
    approvedPassengerCount: null,
    seatCount: null,
    businessType: '',
    usageNature: 'freight',
    isAirConditioned: false,
    operationStatus: 'operating',
    operationStatusChangeDate: '',
    purchaseStatus: '',
    purchaseStatusChangeDate: '',
    inspectionStartDate: '',
    vehicleLevel: '',
    isNewEnergy: false,
    threeGuaranteeMileage: null,
    threeGuaranteeDuration: null,
    warrantyMileage: null,
    warrantyDuration: null,
    remark: '',
    grossMass: null,
    curbWeight: null,
    approvedLoadMass: null,
    overallLength: null,
    overallWidth: null,
    overallHeight: null,
    platform: '',
    frontTrack: null,
    rearTrack: null,
    wheelbase: null,
    axleCount: null,
    tireCount: null,
    leafSpringCount: null,
    isDoubleDeck: false,
    engineNo: '',
    engineModel: '',
    fuelType: '',
    displacement: null,
    emissionStandard: '',
    enginePower: null,
    ratedTorqueSpeed: null,
    engineTorque: null,
    plateColor: '',
    purchaseDate: '',
    vehicleAgeDisplay: '',
    transportIndustry: '',
    operationType: '',
    ownerName: '',
    ownerPhone: '',
    terminalPhone: '',
    ownerGender: '',
    idCardNo: '',
    mailingAddress: '',
    tonnageOrSeat: '',
    primaryDriverId: null,
    primaryDriver: null,
    primaryDriverName: '',
    primaryDriverPhone: '',
    secondaryDriverId: null,
    secondaryDriver: null,
    backupDriverIds: [],
    backupDrivers: [],
    secondaryDriverName: '',
    secondaryDriverPhone: '',
    operationRoute: '',
    licensePlateCode: '',
    serviceStartTime: '',
    serviceEndTime: '',
    supportPhoto: false,
    vehiclePhotoUrl: '',
    drivingLicenseFrontUrl: '',
    drivingLicenseBackUrl: '',
    drivingLicenseBackReverseUrl: '',
    personVehiclePhotoUrl: '',
    vehicleHeadPhotoUrl: '',
    operationLicenseUrl: '',
    attachments: [],
    auditStatus: 'draft',
    auditRemark: '',
    fieldAccess: { ...EDITABLE_FIELD_ACCESS },
    isRecordOwner: false
  }
}

export function sanitizeVehicleArchivePayload(
  params: VehicleArchiveForm
): VehicleArchiveWritePayload {
  const { id, fieldAccess } = params
  const formPayload = omitWriteMetadata(params, [
    'id',
    'auditBy',
    'auditTime',
    'auditStatus',
    'auditRemark',
    'carrier',
    'primaryDriver',
    'secondaryDriver',
    'backupDrivers',
    'primaryDriverName',
    'primaryDriverPhone',
    'secondaryDriverName',
    'secondaryDriverPhone',
    'vehicleAgeDisplay',
    'ownerId',
    'specLengthM',
    'volumeM3',
    'loadTons',
    'driverOneName',
    'driverOnePhone',
    'driverTwoName',
    'driverTwoPhone'
  ])
  const payload: Record<string, unknown> = {
    ...formPayload,
    attachments: formPayload.attachments ?? [],
    isAirConditioned: formPayload.isAirConditioned ?? false,
    isNewEnergy: formPayload.isNewEnergy ?? false,
    isDoubleDeck: formPayload.isDoubleDeck ?? false,
    supportPhoto: formPayload.supportPhoto ?? false
  }

  const editablePayload = id
    ? omitNonEditableFieldGroups(payload, fieldAccess, SENSITIVE_PAYLOAD_KEYS)
    : payload

  return {
    ...(id ? { id } : {}),
    ...Object.fromEntries(
      Object.entries(editablePayload).map(([key, value]) => [
        key,
        typeof value === 'string'
          ? NON_NULLABLE_TEXT_FIELDS.has(key)
            ? normalizeNonNullableText(value)
            : normalizeNullableText(value)
          : value
      ])
    )
  }
}
