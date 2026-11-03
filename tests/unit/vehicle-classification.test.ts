import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildVehicleClassificationTree,
  filterClassifiedVehicles
} from '../../src/views/vehicle-manage/components/vehicle-classification'

const rows = [
  { id: 'a', vehicleOwnership: 'carrier', vehicleType: 'semi' },
  { id: 'b', vehicleOwnership: 'carrier', vehicleType: 'semi' },
  { id: 'c', vehicleOwnership: 'self', vehicleType: 'flat' },
  { id: 'd', vehicleOwnership: '', vehicleType: '' }
]

test('classification counts and Chinese search use dictionary labels and retain unassigned vehicles', () => {
  const tree = buildVehicleClassificationTree(rows, (dictionary, value) =>
    dictionary === 'vehicleOwnership' && value === 'carrier'
      ? '承运商'
      : dictionary === 'vehicleType' && value === 'semi'
        ? '半挂车'
        : undefined
  )
  assert.equal(tree[0].count, 2)
  assert.equal(tree[0].children?.[0].searchText, '承运商 半挂车')
  assert.match(tree[0].searchText, /半挂车/)
  assert.equal(tree[2].label, '归属未设置')
  assert.equal(tree[2].children?.[0].label, '车型未设置')
  assert.equal(
    tree.reduce((sum, node) => sum + node.count, 0),
    rows.length
  )
})

test('classification filters ownership and type together and all includes unassigned', () => {
  assert.deepEqual(filterClassifiedVehicles(rows, {}), rows)
  assert.deepEqual(
    filterClassifiedVehicles(rows, { vehicleOwnership: 'carrier', vehicleType: 'semi' }),
    rows.slice(0, 2)
  )
  assert.deepEqual(
    filterClassifiedVehicles(rows, { vehicleOwnership: 'self', vehicleType: 'semi' }),
    []
  )
  assert.deepEqual(
    filterClassifiedVehicles(rows, { vehicleOwnership: 'unassigned' }),
    rows.slice(3)
  )
})

test('unknown dictionary codes do not leak into labels and still filter by original keys', () => {
  const legacyRows = [
    { id: 'legacy', vehicleOwnership: 'unknown_owner', vehicleType: '半挂车' },
    { id: 'unknown', vehicleOwnership: 'unknown_owner', vehicleType: 'future_type' }
  ]
  const tree = buildVehicleClassificationTree(legacyRows, () => undefined)
  assert.equal(tree[0].label, '未识别归属')
  assert.deepEqual(
    tree[0].children?.map((node) => node.label),
    ['半挂车', '未识别']
  )
  assert.equal(tree[0].children?.[1].vehicleType, 'future_type')
  assert.deepEqual(
    filterClassifiedVehicles(legacyRows, {
      vehicleOwnership: 'unknown_owner',
      vehicleType: 'future_type'
    }),
    legacyRows.slice(1)
  )
})

test('mixed historical codes stay hidden without merging classification keys', () => {
  const rows = [
    { id: 'chinese', vehicleOwnership: 'carrier', vehicleType: ' 半挂车（13.5米） ' },
    { id: 'mixed', vehicleOwnership: 'carrier', vehicleType: 'legacy_半挂车' },
    { id: 'unknown', vehicleOwnership: 'carrier', vehicleType: 'legacy_type' }
  ]
  const tree = buildVehicleClassificationTree(rows, () => undefined)
  assert.deepEqual(
    tree[0].children?.map((node) => node.label),
    ['半挂车（13.5米）', '未识别', '未识别']
  )
  assert.equal(tree[0].children?.length, 3)
  assert.equal(tree[0].count, 3)
  assert.notEqual(tree[0].children?.[1].key, tree[0].children?.[2].key)
  assert.deepEqual(filterClassifiedVehicles(rows, { vehicleType: 'legacy_半挂车' }), [rows[1]])
  const translated = buildVehicleClassificationTree(rows, (dictionary, value) =>
    dictionary === 'vehicleType' && value === 'legacy_半挂车' ? '半挂车' : undefined
  )
  assert.equal(translated[0].children?.[1].label, '半挂车')
})
