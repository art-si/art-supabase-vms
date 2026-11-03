import { buildSupabasePageRange } from '@/utils/supabase/pagination'
import { fetchVehicleArchiveList } from '@vms/api/providers/supabase/vehicle'
import { useSupabase } from '@/hooks/core/useSupabase'
import { normalizeNullableText } from '@/utils/form/normalize'

export interface VehicleSelectPageParams {
  page: number
  pageSize: number
  keyword?: string
  isNewEnergy?: boolean
}

/** 车辆业务表单统一使用已审批车辆，避免各页面的筛选条件发生分叉。 */
export async function fetchApprovedVehicleSelectData(params: VehicleSelectPageParams): Promise<{
  data: Api.Vms.ArchiveManage.VehicleArchive[]
  total: number
  error: unknown
}> {
  const { from, to } = buildSupabasePageRange({ current: params.page, size: params.pageSize })
  if (typeof params.isNewEnergy === 'boolean') {
    const { supabase, responseHandle } = useSupabase()
    const result = await responseHandle<{
      records: Api.Vms.ArchiveManage.VehicleArchive[]
      total: number
    }>(
      () =>
        supabase.rpc('vms_list_energy_vehicle_options_secure', {
          p_is_new_energy: params.isNewEnergy,
          p_from: from,
          p_to: to,
          p_keyword: normalizeNullableText(params.keyword)
        }),
      { showErrorMessage: true }
    )
    return { data: result.data?.records ?? [], total: result.data?.total ?? 0, error: result.error }
  }
  const { data, total, error } = await fetchVehicleArchiveList({
    plateNo: params.keyword,
    auditStatus: 'approved',
    from,
    to
  })
  return { data: data ?? [], total: total ?? 0, error }
}
