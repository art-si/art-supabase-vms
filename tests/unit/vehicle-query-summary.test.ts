import assert from 'node:assert/strict'
import test from 'node:test'
import type { VehicleQuerySummaryRecords } from '../../src/api/providers/supabase/vehicle/types'
import { buildVehicleQuerySummary } from '../../src/views/vehicle-query/modules/vehicle-query-summary'

test('vehicle query summary uses the latest secure records for one vehicle', () => {
  const records: VehicleQuerySummaryRecords = {
    insurance: [
      {
        createTime: '2025-01-01',
        commercialExpireDate: '2025-12-31',
        compulsoryExpireDate: '2025-11-30'
      },
      {
        createTime: '2026-01-01',
        commercialExpireDate: '2026-12-31',
        compulsoryExpireDate: '2026-11-30'
      }
    ],
    inspection: [{ expireDate: '2026-06-01' }, { expireDate: '2027-06-01' }],
    maintenance: [{ startTime: '2026-07-01' }],
    mileage: [
      { startTime: '2026-06-30', endTime: '2026-06-30', endMileage: 1000 },
      { startTime: '2026-08-01', endTime: '2026-08-02', endMileage: 2000 }
    ]
  }

  const result = buildVehicleQuerySummary(records)
  assert.equal(result.summary.commercialExpireDate, '2026-12-31')
  assert.equal(result.summary.inspectionExpireDate, '2027-06-01')
  assert.equal(result.summary.runningMileage, 2000)
  assert.equal(result.summary.nextMaintenanceMileage, 6000)
  assert.deepEqual(result.coverage, {
    insuranceReady: true,
    inspectionReady: true,
    maintenanceReady: true
  })
})

test('vehicle query summary does not turn masked mileage into a number', () => {
  const records: VehicleQuerySummaryRecords = {
    insurance: [],
    inspection: [],
    maintenance: [],
    mileage: [{ startTime: '2026-08-01', endMileage: '***', runningMileage: '***' }]
  }

  const result = buildVehicleQuerySummary(records)
  assert.equal(result.summary.runningMileage, null)
  assert.equal(result.summary.nextMaintenanceMileage, null)
  assert.deepEqual(result.coverage, {
    insuranceReady: false,
    inspectionReady: false,
    maintenanceReady: false
  })
})

test('vehicle query summary uses the configured next maintenance reminder', () => {
  const result = buildVehicleQuerySummary({
    insurance: [],
    inspection: [],
    maintenance: [
      {
        startTime: '2026-10-01',
        serviceDate: '2026-10-01',
        currentOdometerKm: 120000,
        reminderMode: 'mileage',
        nextMaintenanceDate: null,
        nextMaintenanceMileage: 130000
      }
    ],
    mileage: []
  })

  assert.equal(result.summary.nextMaintenanceDate, null)
  assert.equal(result.summary.nextMaintenanceMileage, 130000)
  assert.equal(result.coverage.maintenanceReady, true)
})
