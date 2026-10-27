import assert from 'node:assert/strict'
import test from 'node:test'
import { formatVehicleAge } from '../../src/views/vehicle-archive-edit/modules/vehicle-age'

const asOf = new Date('2026-10-27T12:00:00+08:00')

test('vehicle age uses completed months and never becomes an editable stored field', () => {
  assert.equal(formatVehicleAge('2022-04-27', asOf), '4 年 6 个月')
  assert.equal(formatVehicleAge('2025-04-27', asOf), '1 年 6 个月')
  assert.equal(formatVehicleAge('2026-09-27', asOf), '1 个月')
  assert.equal(formatVehicleAge('2026-10-27', asOf), '0 个月')
})

test('vehicle age stays blank when a purchase date is unavailable or in the future', () => {
  assert.equal(formatVehicleAge(null, asOf), '')
  assert.equal(formatVehicleAge('', asOf), '')
  assert.equal(formatVehicleAge('not-a-date', asOf), '')
  assert.equal(formatVehicleAge('2027-01-01', asOf), '')
})
