import { fetchVehicleDriverChoices } from '@/api/vehicle-driver-select'

export interface VehicleSelectPageParams {
  page: number
  pageSize: number
  keyword?: string
  isNewEnergy?: boolean
}

/** Vehicle forms retain approved-only scope and optional fuel/energy eligibility. */
export async function fetchApprovedVehicleSelectData(params: VehicleSelectPageParams) {
  return fetchVehicleDriverChoices<Api.Vms.ArchiveManage.VehicleArchive>(
    typeof params.isNewEnergy === 'boolean' ? 'energy_vehicle' : 'approved_vehicle',
    { ...params, keyword: params.keyword ?? '', filters: {} },
    { isNewEnergy: params.isNewEnergy }
  )
}
