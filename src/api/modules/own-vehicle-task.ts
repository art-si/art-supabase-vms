import { useSupabase } from '@/hooks/core/useSupabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import { buildSupabaseRpcRange } from '@/utils/supabase'

export interface OwnVehicleTaskRecord {
  id: string
  waybillNo: string
  plateNo: string
  driverName: string | null
  originCity: string
  destinationCity: string
  status: string
  plannedDepartureAt: string | null
  actualDepartureAt: string | null
  actualArrivalAt: string | null
  distanceKm: number | null
  returnDistanceKm: number | null
  registeredTollFee: number | null
  registeredOtherFee: number | null
  approvedTollFee: number | null
  approvedOtherFee: number | null
  hasReturnLeg: boolean
}

export interface OwnVehicleTaskSearch {
  keyword?: string
  plateNo?: string
  status?: string
  from?: number
  to?: number
}

interface OwnVehicleTaskPayload {
  records: OwnVehicleTaskRecord[]
  total: number
  canViewCosts: boolean
}

const { supabase, responseHandle } = useSupabase()

export async function fetchOwnVehicleTasks(params: OwnVehicleTaskSearch) {
  const result = await responseHandle<OwnVehicleTaskPayload>(
    () =>
      supabase.rpc('vms_list_own_vehicle_tasks_secure', {
        ...buildSupabaseRpcRange(params.from ?? 0, params.to ?? 9),
        p_keyword: normalizeNullableText(params.keyword ?? ''),
        p_plate_no: normalizeNullableText(params.plateNo ?? ''),
        p_status: normalizeNullableText(params.status ?? '')
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    canViewCosts: result.data?.canViewCosts ?? false,
    error: result.error
  }
}
