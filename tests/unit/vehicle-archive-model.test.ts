import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInitialVehicleArchiveForm,
  requiresVehicleArchiveResubmission,
  sanitizeVehicleArchivePayload
} from '../../src/views/vehicle-archive-edit/modules/vehicle-archive-model'

test('vehicle archive payload removes display and audit-only fields', () => {
  const form = createInitialVehicleArchiveForm()
  Object.assign(form, {
    id: 'vehicle-1',
    plateNo: '沪A12345',
    carrierId: 'carrier-1',
    companyName: '',
    primaryDriverName: '司机甲',
    primaryDriverPhone: '13800000000',
    createBy: 'auditor',
    auditStatus: 'rejected',
    auditRemark: '请补充资料',
    attachments: undefined
  })

  const payload = sanitizeVehicleArchivePayload(form)

  assert.equal(payload.id, 'vehicle-1')
  assert.equal(payload.plateNo, '沪A12345')
  assert.equal(payload.companyName, null)
  assert.deepEqual(payload.attachments, [])
  assert.equal(payload.isAirConditioned, false)
  assert.equal('primaryDriverName' in payload, false)
  assert.equal('createBy' in payload, false)
  assert.equal('auditStatus' in payload, false)
  assert.equal('auditRemark' in payload, false)
})

test('vehicle archive payload omits sensitive fields without edit permission', () => {
  const form = createInitialVehicleArchiveForm()
  Object.assign(form, {
    id: 'vehicle-1',
    plateNo: '沪A12345',
    vin: 'LSVAU2189N2000001',
    ownerName: '车主甲',
    ownerPhone: '13800000000',
    mailingAddress: '上海市测试路 1 号',
    operationRoute: '上海—苏州',
    drivingLicenseFrontUrl: 'https://example.test/license-front.jpg',
    drivingLicenseBackReverseUrl: 'https://example.test/license-reverse.jpg',
    personVehiclePhotoUrl: 'https://example.test/person-vehicle.jpg',
    vehicleHeadPhotoUrl: 'https://example.test/vehicle-head.jpg',
    acCode: 'AC-001',
    fieldAccess: {
      vehicleIdentifiers: 'view',
      ownerIdentity: 'masked',
      contactPhones: 'hidden',
      mailingAddress: 'view',
      operationRoute: 'hidden',
      documents: 'masked',
      deviceIdentity: 'view'
    }
  })

  const payload = sanitizeVehicleArchivePayload(form)

  assert.equal(payload.plateNo, '沪A12345')
  assert.equal('vin' in payload, false)
  assert.equal('ownerName' in payload, false)
  assert.equal('ownerPhone' in payload, false)
  assert.equal('mailingAddress' in payload, false)
  assert.equal('operationRoute' in payload, false)
  assert.equal('drivingLicenseFrontUrl' in payload, false)
  assert.equal('drivingLicenseBackReverseUrl' in payload, false)
  assert.equal('personVehiclePhotoUrl' in payload, false)
  assert.equal('vehicleHeadPhotoUrl' in payload, false)
  assert.equal('attachments' in payload, false)
  assert.equal('acCode' in payload, false)
})

test('vehicle archive payload keeps sensitive fields with edit permission', () => {
  const form = createInitialVehicleArchiveForm()
  Object.assign(form, {
    id: 'vehicle-1',
    vin: 'LSVAU2189N2000001',
    ownerName: '车主甲',
    ownerPhone: '13800000000',
    mailingAddress: '上海市测试路 1 号',
    operationRoute: '上海—苏州',
    drivingLicenseFrontUrl: 'https://example.test/license-front.jpg',
    acCode: 'AC-001'
  })

  const payload = sanitizeVehicleArchivePayload(form)

  assert.equal(payload.vin, 'LSVAU2189N2000001')
  assert.equal(payload.ownerName, '车主甲')
  assert.equal(payload.ownerPhone, '13800000000')
  assert.equal(payload.mailingAddress, '上海市测试路 1 号')
  assert.equal(payload.operationRoute, '上海—苏州')
  assert.equal(payload.drivingLicenseFrontUrl, 'https://example.test/license-front.jpg')
  assert.equal(payload.acCode, 'AC-001')
})

test('vehicle archive payload keeps the OCR artifact marker on create and edit', () => {
  for (const id of [undefined, 'vehicle-1']) {
    const form = createInitialVehicleArchiveForm()
    form.id = id
    form.aiArtifactId = 'artifact-1'

    const payload = sanitizeVehicleArchivePayload(form)
    assert.equal(payload.aiArtifactId, 'artifact-1')
  }
})

test('vehicle archive keeps the selected type and ownership while server fills its metrics', () => {
  const form = createInitialVehicleArchiveForm()
  assert.equal(form.vehicleOwnership, 'self_operated')
  assert.equal(form.auditStatus, 'draft')

  Object.assign(form, {
    vehicleTypeProfileId: 'profile-1',
    vehicleType: '半挂车',
    vehicleOwnership: 'franchise',
    specLengthM: 13,
    volumeM3: 75,
    loadTons: 30,
    ownerId: 'legacy-owner'
  })
  form.vehicleAgeDisplay = '3 年 2 个月'
  form.purchaseDate = '2023-08-01'

  const payload = sanitizeVehicleArchivePayload(form)
  assert.equal(payload.vehicleTypeProfileId, 'profile-1')
  assert.equal(payload.vehicleOwnership, 'franchise')
  assert.equal('specLengthM' in payload, false)
  assert.equal('volumeM3' in payload, false)
  assert.equal('loadTons' in payload, false)
  assert.equal('ownerId' in payload, false)
  assert.equal('vehicleAgeDisplay' in payload, false)
  assert.equal(payload.purchaseDate, '2023-08-01')
})

test('vehicle archive payload respects required and nullable database fields', () => {
  const form = createInitialVehicleArchiveForm()
  Object.assign(form, {
    plateNo: '  沪A12345  ',
    vehicleType: '  厢式货车  ',
    operationStatus: '  ',
    vehicleOwnership: '',
    companyName: '  ',
    vin: '  LSVAU2189N2000001  ',
    registerDate: '',
    carrierId: ''
  })

  const payload = sanitizeVehicleArchivePayload(form)
  assert.equal(payload.plateNo, '沪A12345')
  assert.equal(payload.vehicleType, '厢式货车')
  assert.equal(payload.operationStatus, '')
  assert.equal(payload.vehicleOwnership, '')
  assert.equal(payload.companyName, null)
  assert.equal(payload.vin, 'LSVAU2189N2000001')
  assert.equal(payload.registerDate, null)
  assert.equal(payload.carrierId, null)
})

test('only rejected vehicle archives require resubmission after editing', () => {
  assert.equal(requiresVehicleArchiveResubmission('rejected'), true)
  assert.equal(requiresVehicleArchiveResubmission('pending'), false)
  assert.equal(requiresVehicleArchiveResubmission('approved'), false)
  assert.equal(requiresVehicleArchiveResubmission(undefined), false)
})
