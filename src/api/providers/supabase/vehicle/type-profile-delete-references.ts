import { uniq } from 'lodash-es'
import type { MasterDataDeleteDependencyDetail } from '@/api/master-data-delete'
import { useSupabase } from '@/hooks/core/useSupabase'

interface VehicleReference {
  id: string
  tenantId: string
  plateNo: string
  operationStatus: string
}

interface TrailerReference {
  id: string
  tenantId: string
  plateNo: string
  status: string
}

interface CommissionReference {
  id: string
  tenantId: string
  driverId: string
  ruleName: string
  enabled: boolean
}

const { supabase, responseHandle } = useSupabase()

function requireVisibleRows<T extends { id: string; tenantId: string }>(
  rows: T[] | null,
  ids: string[],
  tenantId: string
): Map<string, T> {
  const byId = new Map((rows ?? []).map((row) => [row.id, row]))
  if (ids.some((id) => !byId.has(id) || byId.get(id)?.tenantId !== tenantId))
    throw new Error('部分关联记录不可见或已变化，请联系有查看权限的人员核对后重试')
  return byId
}

/** Enrich the generic FK reader with exact names, statuses, and navigation IDs. */
export async function fetchVehicleTypeDeleteReferences(
  references: MasterDataDeleteDependencyDetail[],
  tenantId: string
): Promise<{
  records: MasterDataDeleteDependencyDetail[]
  driverIds: Map<string, string>
}> {
  const ids = (source: string) =>
    uniq(
      references
        .filter((row) => row.dependencyCode === source && row.recordNo !== '关联记录暂不可见')
        .map((row) => row.targetId)
    )
  const vehicleIds = ids('mdm_vehicle')
  const trailerIds = ids('vehicle_trailer')
  const commissionIds = ids('tms_driver_commission_rule')

  const [vehicleResult, trailerResult, commissionResult] = await Promise.all([
    vehicleIds.length
      ? responseHandle<VehicleReference[]>(
          () =>
            supabase
              .from('mdm_vehicle')
              .select('id,tenant_id,plate_no,operation_status')
              .in('id', vehicleIds)
              .eq('tenant_id', tenantId),
          { breakReturn: true, showErrorMessage: false }
        )
      : Promise.resolve({ data: [] as VehicleReference[] }),
    trailerIds.length
      ? responseHandle<TrailerReference[]>(
          () =>
            supabase
              .from('vehicle_trailer')
              .select('id,tenant_id,plate_no,status')
              .in('id', trailerIds)
              .eq('tenant_id', tenantId),
          { breakReturn: true, showErrorMessage: false }
        )
      : Promise.resolve({ data: [] as TrailerReference[] }),
    commissionIds.length
      ? responseHandle<CommissionReference[]>(
          () =>
            supabase
              .from('tms_driver_commission_rule')
              .select('id,tenant_id,driver_id,rule_name,enabled')
              .in('id', commissionIds)
              .eq('tenant_id', tenantId),
          { breakReturn: true, showErrorMessage: false }
        )
      : Promise.resolve({ data: [] as CommissionReference[] })
  ])
  const vehicles = requireVisibleRows(vehicleResult.data, vehicleIds, tenantId)
  const trailers = requireVisibleRows(trailerResult.data, trailerIds, tenantId)
  const commissions = requireVisibleRows(commissionResult.data, commissionIds, tenantId)
  const driverIds = new Map([...commissions].map(([id, row]) => [id, row.driverId]))
  return {
    driverIds,
    records: references.map((reference) => {
      const vehicle = vehicles.get(reference.targetId)
      if (reference.dependencyCode === 'mdm_vehicle' && vehicle)
        return {
          ...reference,
          recordNo: vehicle.plateNo,
          recordStatus: vehicle.operationStatus
        }
      const trailer = trailers.get(reference.targetId)
      if (reference.dependencyCode === 'vehicle_trailer' && trailer)
        return {
          ...reference,
          recordNo: trailer.plateNo,
          recordStatus: trailer.status
        }
      const commission = commissions.get(reference.targetId)
      if (reference.dependencyCode === 'tms_driver_commission_rule' && commission)
        return {
          ...reference,
          recordNo: commission.ruleName,
          recordStatus: commission.enabled ? 'enabled' : 'disabled'
        }
      return reference
    })
  }
}
