import assert from 'node:assert/strict'
import test from 'node:test'
import {
  vehicleCertificateRiskDisplay,
  vehicleCertificateRiskNeedsAttention
} from '../../src/views/vehicle-archive-manage/modules/vehicle-certificate-risk'

test('vehicle certificate risk makes an expired document visible without treating it as a renewal reminder', () => {
  assert.deepEqual(
    vehicleCertificateRiskDisplay({
      certificateRisk: 'expired',
      certificateRiskType: 'compulsory_insurance',
      certificateRiskExpiresOn: '2026-10-01'
    }),
    { label: '已过期', detail: '交强险保单 · 2026-10-01', tone: 'danger' }
  )
})

test('vehicle certificate risk distinguishes due renewal, valid, and no record', () => {
  assert.equal(vehicleCertificateRiskDisplay({ certificateRisk: 'renewal_due' }).label, '待换证')
  assert.equal(vehicleCertificateRiskDisplay({ certificateRisk: 'valid' }).label, '有效')
  assert.deepEqual(vehicleCertificateRiskDisplay({}), {
    label: '未登记',
    detail: '尚未登记车辆证件',
    tone: 'info'
  })
})

test('identity cell highlights only risks that need action within the visible first columns', () => {
  assert.equal(vehicleCertificateRiskNeedsAttention('expired'), true)
  assert.equal(vehicleCertificateRiskNeedsAttention('renewal_due'), true)
  assert.equal(vehicleCertificateRiskNeedsAttention('valid'), false)
  assert.equal(vehicleCertificateRiskNeedsAttention('none'), false)
  assert.equal(vehicleCertificateRiskNeedsAttention(undefined), false)
})
