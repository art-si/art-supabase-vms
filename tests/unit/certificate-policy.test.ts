import assert from 'node:assert/strict'
import test from 'node:test'
import type { CertificateRecord } from '../../src/types/certificate'
import {
  CERTIFICATE_TYPE_OPTIONS,
  canMarkCertificateHandled,
  certificateStatusLabel,
  certificateStatusTableLabel,
  certificateRiskCounts,
  certificateTypeLabel,
  isLegacyCertificateRecord
} from '../../src/views/certificate-center/modules/certificate-policy'

const base = {
  tenantId: 'tenant-a',
  subjectType: 'vehicle' as const,
  subjectId: 'vehicle-a',
  subjectLabel: '苏B8891挂',
  certificateNo: 'CERT-001',
  issueDate: '2026-01-01',
  validFrom: '2026-01-01',
  expiresOn: '2026-12-31',
  attachments: [],
  responsibleUserId: 'user-a',
  responsibleName: '车管员',
  renewalOfId: null,
  handledAt: null,
  handledBy: null
} satisfies Omit<CertificateRecord, 'id' | 'certificateType' | 'status'>

const compulsory: CertificateRecord = {
  ...base,
  id: 'certificate-compulsory',
  certificateType: 'compulsory_insurance',
  expiresOn: '2026-10-20',
  status: 'expired'
}

const commercial: CertificateRecord = {
  ...base,
  id: 'certificate-commercial',
  certificateType: 'commercial_insurance',
  expiresOn: '2026-11-06',
  status: 'due_15'
}

test('交强险和商业险为同车独立证件，分别保留到期状态', () => {
  assert.notEqual(compulsory.certificateType, commercial.certificateType)
  assert.notEqual(compulsory.expiresOn, commercial.expiresOn)
  assert.deepEqual(certificateRiskCounts([compulsory, commercial]), {
    expired: 1,
    dueSoon: 1,
    handled: 0
  })
  assert.equal(certificateTypeLabel(compulsory.certificateType), '交强险保单')
  assert.equal(certificateTypeLabel(commercial.certificateType), '商业险保单')
  assert.equal(certificateStatusLabel(commercial.status), '待换证（15 天）')
})

test('司机证件与车辆证件共用风险范围，已处理记录不再重复处置', () => {
  const driver: CertificateRecord = {
    ...base,
    id: 'driver-license',
    subjectType: 'driver',
    subjectId: 'driver-a',
    subjectLabel: '张师傅',
    certificateType: 'driver_license',
    status: 'handled',
    handledAt: '2026-10-26T08:00:00Z',
    handledBy: 'user-a'
  }
  assert.deepEqual(certificateRiskCounts([compulsory, commercial, driver]), {
    expired: 1,
    dueSoon: 1,
    handled: 1
  })
  assert.equal(canMarkCertificateHandled(driver), false)
  assert.equal(canMarkCertificateHandled(compulsory), true)
  assert.ok(CERTIFICATE_TYPE_OPTIONS.driver.some((option) => option.value === 'driver_license'))
  assert.equal(certificateTypeLabel('identity_card'), '身份证')
})

test('司机三个月临期计入预警，车辆原有 30 天状态保持独立', () => {
  const driver: CertificateRecord = {
    ...base,
    id: 'driver-qualification',
    subjectType: 'driver',
    subjectId: 'driver-b',
    subjectLabel: '李师傅',
    certificateType: 'professional_qualification',
    expiresOn: '2027-01-27',
    status: 'due_3_months'
  }
  assert.equal(certificateStatusLabel(driver.status), '待换证（3 个月）')
  assert.equal(certificateStatusTableLabel(driver.status), '3 个月内')
  assert.deepEqual(certificateRiskCounts([driver, commercial]), {
    expired: 0,
    dueSoon: 2,
    handled: 0
  })
  assert.equal(certificateStatusLabel('due_30'), '待换证（30 天）')
})

test('旧保险台账仅作回退风险，不允许直接标记已处理', () => {
  const fallback: CertificateRecord = {
    ...commercial,
    id: 'legacy_insurance:insurance-1:commercial_insurance',
    sourceKind: 'legacy_insurance',
    responsibleUserId: '',
    responsibleName: '待指定'
  }
  assert.equal(isLegacyCertificateRecord(fallback), true)
  assert.equal(canMarkCertificateHandled(fallback), false)
})
