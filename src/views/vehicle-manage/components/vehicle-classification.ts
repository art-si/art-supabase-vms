import { groupBy } from 'lodash-es'
import type { VehicleArchiveNavigationItem } from '@vms/api'
import { getVehicleTypeFallbackLabel } from '@/utils/business/vehicle-type-display'

export interface VehicleClassificationFilter {
  vehicleOwnership?: string
  vehicleType?: string
}

export interface VehicleClassificationNode extends VehicleClassificationFilter {
  key: string
  label: string
  count: number
  searchText: string
  children?: VehicleClassificationNode[]
}

type DictionaryLabel = (
  dictionary: 'vehicleOwnership' | 'vehicleType',
  value: string
) => string | undefined

/** Keep the classification used by archive, query, cards and mileage in sync. */
export function filterClassifiedVehicles(
  rows: VehicleArchiveNavigationItem[],
  filter: VehicleClassificationFilter
): VehicleArchiveNavigationItem[] {
  return rows.filter(
    (row) =>
      (!filter.vehicleOwnership ||
        (row.vehicleOwnership || 'unassigned') === filter.vehicleOwnership) &&
      (!filter.vehicleType || (row.vehicleType || 'unassigned') === filter.vehicleType)
  )
}

export function buildVehicleClassificationTree(
  rows: VehicleArchiveNavigationItem[],
  getLabel: DictionaryLabel
): VehicleClassificationNode[] {
  return Object.entries(groupBy(rows, (row) => row.vehicleOwnership || 'unassigned')).map(
    ([vehicleOwnership, ownershipRows]) => {
      const label =
        getLabel('vehicleOwnership', vehicleOwnership) ??
        (vehicleOwnership === 'unassigned' ? '归属未设置' : '未识别归属')
      const children = Object.entries(
        groupBy(ownershipRows, (row) => row.vehicleType || 'unassigned')
      ).map(([vehicleType, typeRows]): VehicleClassificationNode => {
        const typeLabel =
          getLabel('vehicleType', vehicleType) ??
          (vehicleType === 'unassigned' ? '车型未设置' : getVehicleTypeFallbackLabel(vehicleType))
        return {
          key: `type:${vehicleOwnership}:${vehicleType}`,
          label: typeLabel,
          count: typeRows.length,
          vehicleOwnership,
          vehicleType,
          searchText: `${label} ${typeLabel}`
        }
      })
      return {
        key: `ownership:${vehicleOwnership}`,
        label,
        count: ownershipRows.length,
        vehicleOwnership,
        searchText: `${label} ${children.map((child) => child.label).join(' ')}`,
        children
      }
    }
  )
}
