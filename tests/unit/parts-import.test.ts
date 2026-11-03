import assert from 'node:assert/strict'
import test from 'node:test'
import { resolvePartImportUnit } from '../../src/api/providers/supabase/vehicle/parts-import'

const material = {
  id: 'material-1',
  tenantId: 'tenant-a',
  materialCode: 'M-001',
  materialName: '物料',
  baseUnitId: 'base',
  status: 'enabled' as const
}

const units: Parameters<typeof resolvePartImportUnit>[2] = [
  { id: 'base', tenantId: 'tenant-a', unitCode: 'PC', unitName: '件', status: 'enabled' },
  { id: 'other', tenantId: 'tenant-a', unitCode: 'BOX', unitName: '箱', status: 'enabled' },
  { id: 'duplicate', tenantId: 'tenant-a', unitCode: 'EA', unitName: '件', status: 'enabled' }
]

test('legacy imports resolve code, name, and material base unit', () => {
  assert.equal(resolvePartImportUnit({ unit: 'box' }, material, units)?.id, 'other')
  assert.equal(resolvePartImportUnit({ unit: '件' }, material, units)?.id, 'base')
  assert.equal(resolvePartImportUnit({}, material, units)?.id, 'base')
})

test('unknown and forged unit IDs fail instead of choosing another unit', () => {
  assert.equal(resolvePartImportUnit({ unit: '未知单位' }, material, units), undefined)
  assert.equal(resolvePartImportUnit({ unitId: 'foreign' }, material, units), undefined)
})
