import { buildSupabasePageRange } from '@/utils/supabase/pagination'
import { fetchVehicleArchiveList } from '@vms/api/providers/supabase/vehicle'

export interface VehicleSelectPageParams {
  page: number
  pageSize: number
  keyword?: string
}

/** 车辆业务表单统一使用已审批车辆，避免各页面的筛选条件发生分叉。 */
export async function fetchApprovedVehicleSelectData(params: VehicleSelectPageParams): Promise<{
  data: Api.Vms.ArchiveManage.VehicleArchive[]
  total: number
  error: unknown
}> {
  const { from, to } = buildSupabasePageRange({ current: params.page, size: params.pageSize })
  const { data, total, error } = await fetchVehicleArchiveList({
    plateNo: params.keyword,
    auditStatus: 'approved',
    from,
    to
  })
  return { data: data ?? [], total: total ?? 0, error }
}
