import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeTrailerRelationIds } from '../../src/api/providers/supabase/vehicle/trailer-write-payload'
import type { TrailerWritePayload } from '../../src/types/trailer'

const payload: TrailerWritePayload = {
  plateNo: '冀D8A11挂',
  plateColor: 'blue',
  vehicleTypeProfileId: '6af89524-ded6-47fa-aeec-f973fc59430e',
  trailerType: '半挂车',
  vin: null,
  ownerName: '武安市子成物流有限公司（演示）',
  brandModel: null,
  archiveNo: null,
  curbWeightKg: null,
  approvedLoadKg: null,
  lengthMm: null,
  widthMm: null,
  heightMm: null,
  inspectionValidUntil: null,
  mandatoryScrapDate: null,
  ownership: 'carrier',
  defaultTractorId: null,
  companyOrganizationId: null,
  source: null,
  remark: null,
  licenseFrontUrl: null,
  licenseBackUrl: null,
  licenseBackReverseUrl: null,
  rearPhotoUrl: null
}

test('trailer write converts cleared optional UUID selections to null', () => {
  const result = normalizeTrailerRelationIds({
    ...payload,
    defaultTractorId: '',
    companyOrganizationId: '   '
  })

  assert.equal(result.defaultTractorId, null)
  assert.equal(result.companyOrganizationId, null)
  assert.equal(result.vehicleTypeProfileId, payload.vehicleTypeProfileId)
})

test('trailer write preserves selected relation IDs without mutating the form', () => {
  const input = {
    ...payload,
    defaultTractorId: ' 226057d8-b018-4c96-a06a-d4d16bbd5d0f ',
    companyOrganizationId: '8fbc1836-d0ea-4afd-98c6-f557ab40fe4f'
  }
  const result = normalizeTrailerRelationIds(input)

  assert.equal(result.defaultTractorId, '226057d8-b018-4c96-a06a-d4d16bbd5d0f')
  assert.equal(result.companyOrganizationId, input.companyOrganizationId)
  assert.equal(input.defaultTractorId, ' 226057d8-b018-4c96-a06a-d4d16bbd5d0f ')
})
