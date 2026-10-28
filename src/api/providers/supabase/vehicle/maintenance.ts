import { buildSupabaseRpcRange } from '@/utils/supabase'
import { toDateStartTimestamp, toDateEndTimestamp } from '@/utils/time/date-boundary'
import { normalizeNullableText } from '@/utils/form/normalize'
import { useSupabase } from '@/hooks/core/useSupabase'
import { withRequestOptions } from '@/api/providers/supabase/query'
import type { ApiFeedbackOptions, ApiRequestOptions } from '@/types/api/request'
import {
  type VehicleMaintenanceRecord,
  type VehicleMaintenanceSearchParams,
  type VehiclePartUsage,
  type VehiclePartUsageSearchParams
} from './types'

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

// 车辆保养维修
interface SecureVehicleMaintenancePayload {
  records: VehicleMaintenanceRecord[]
  total: number
  fieldAccess?: Api.Vms.VehicleManage.VehicleMaintenanceFieldAccessMap
}

export interface MaintenanceWorkshopOption {
  id: string
  supplierName: string
  supplierCode?: string
}

export interface VehicleMaintenanceCostSource {
  id: string
  sourceDate: string | null
  costAmount: number | string | null
  recognitionStatus: 'unlinked' | 'pending_review' | 'approved'
  linkedCostId: string | null
  linkedCostNo: string | null
}

interface VehicleMaintenanceCostSourcePayload {
  records: VehicleMaintenanceCostSource[]
  total: number
  amountVisible: boolean
}

export async function fetchVehicleMaintenanceCostSource(id: string) {
  const result = await responseHandle<VehicleMaintenanceCostSourcePayload>(
    () => supabase.rpc('vms_list_vehicle_maintenance_cost_ledger_secure', { p_maintenance_id: id }),
    { showErrorMessage: false }
  )
  if (result.error) throw result.error
  return result.data?.records[0] ?? null
}

export async function fetchMaintenanceWorkshopOptions(keyword?: string, tenantId?: string | null) {
  const result = await responseHandle<{ records: MaintenanceWorkshopOption[] }>(
    () =>
      supabase.rpc('vms_list_maintenance_workshops_secure', {
        p_keyword: normalizeNullableText(keyword ?? ''),
        p_limit: 50,
        p_tenant_id: tenantId || null
      }),
    { showErrorMessage: false }
  )
  if (result.error) throw result.error
  return result.data?.records ?? []
}

const createVehicleMaintenanceRpcParams = (
  params: VehicleMaintenanceSearchParams & { ids?: string[]; maxRows?: number },
  purpose: 'list' | 'export'
) => {
  const from = Math.max(params.from ?? 0, 0)
  const requestedTo = params.maxRows ? from + Math.max(params.maxRows, 1) - 1 : params.to
  return {
    ...buildSupabaseRpcRange(from, requestedTo ?? 9),
    p_vehicle_id: params.vehicleId || null,
    p_company_name: normalizeNullableText(String(params.companyName ?? '')),
    p_plate_no: normalizeNullableText(String(params.plateNo ?? '')),
    p_maintenance_no: normalizeNullableText(String(params.maintenanceNo ?? '')),
    p_maintenance_type: normalizeNullableText(String(params.maintenanceType ?? '')),
    p_create_time_from: toDateStartTimestamp(params.createTimeRange?.[0]),
    p_create_time_to: toDateEndTimestamp(params.createTimeRange?.[1]),
    p_ids: params.ids?.length ? params.ids : null,
    p_purpose: purpose
  }
}

export async function fetchVehicleMaintenanceList(
  params: VehicleMaintenanceSearchParams,
  options?: ApiRequestOptions & ApiFeedbackOptions
) {
  const result = await responseHandle<SecureVehicleMaintenancePayload>(
    () =>
      withRequestOptions(
        supabase.rpc(
          'vms_list_vehicle_maintenance_secure',
          createVehicleMaintenanceRpcParams(params, 'list')
        ),
        options
      ),
    { showErrorMessage: options?.showErrorMessage ?? true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error,
    fieldAccess: result.data?.fieldAccess ?? {}
  }
}

export async function exportVehicleMaintenanceList(
  params: VehicleMaintenanceSearchParams & { ids?: string[]; maxRows?: number }
) {
  const result = await responseHandle<SecureVehicleMaintenancePayload>(
    () =>
      supabase.rpc(
        'vms_list_vehicle_maintenance_secure',
        createVehicleMaintenanceRpcParams({ ...params, maxRows: params.maxRows ?? 10000 }, 'export')
      ),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error,
    fieldAccess: result.data?.fieldAccess ?? {}
  }
}

export async function fetchVehicleMaintenanceDetail(id: string, options?: ApiFeedbackOptions) {
  return await responseHandle<VehicleMaintenanceRecord | null>(
    () => supabase.rpc('vms_get_vehicle_maintenance_secure', { p_id: id }),
    {
      showErrorMessage: options?.showErrorMessage ?? true
    }
  )
}

export async function addVehicleMaintenance(params: VehicleMaintenanceRecord) {
  const result = await responseHandle<string>(
    () =>
      supabase.rpc('vms_create_vehicle_maintenance_secure', {
        p_payload: keysToSnakeDeep(params)
      }),
    { showMessage: true, breakReturn: true }
  )
  return { ...result, data: result.data ? { id: result.data } : null }
}

export async function editVehicleMaintenance(params: VehicleMaintenanceRecord) {
  const { id, ...data } = params
  if (!id) throw new Error('缺少车辆维修保养 ID')
  return await responseHandle<VehicleMaintenanceRecord>(
    () =>
      supabase.rpc('vms_update_vehicle_maintenance_secure', {
        p_id: id,
        p_payload: keysToSnakeDeep(data)
      }),
    { showMessage: true, breakReturn: true }
  )
}

export async function deleteVehicleMaintenance(id: string) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_maintenance_secure', { p_ids: [id] }),
    { showMessage: true, message: '删除成功', showErrorMessage: false, breakReturn: true }
  )
}

export async function deleteVehicleMaintenanceBatch(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_maintenance_secure', { p_ids: ids }),
    { showMessage: true, showErrorMessage: false, breakReturn: true }
  )
}

// 车辆零部件使用
interface SecureVehiclePartUsagePayload {
  records: VehiclePartUsage[]
  total: number
  fieldAccess?: Api.Vms.VehicleManage.VehiclePartUsageFieldAccessMap
}

const createVehiclePartUsageRpcParams = (
  params: VehiclePartUsageSearchParams & { ids?: string[]; maxRows?: number },
  purpose: 'list' | 'export'
) => {
  const from = Math.max(params.from ?? 0, 0)
  const requestedTo = params.maxRows ? from + Math.max(params.maxRows, 1) - 1 : params.to
  return {
    ...buildSupabaseRpcRange(from, requestedTo ?? 9),
    p_vehicle_id: params.vehicleId || null,
    p_company_name: normalizeNullableText(String(params.companyName ?? '')),
    p_plate_no: normalizeNullableText(String(params.plateNo ?? '')),
    p_part_type: normalizeNullableText(String(params.partType ?? '')),
    p_part_name: normalizeNullableText(String(params.partName ?? '')),
    p_category_id: params.categoryId || null,
    p_rfid_tag: normalizeNullableText(String(params.rfidTag ?? '')),
    p_status: normalizeNullableText(String(params.status ?? '')),
    p_create_time_from: toDateStartTimestamp(params.createTimeRange?.[0]),
    p_create_time_to: toDateEndTimestamp(params.createTimeRange?.[1]),
    p_ids: params.ids?.length ? params.ids : null,
    p_purpose: purpose
  }
}

export async function fetchVehiclePartUsageList(
  params: VehiclePartUsageSearchParams,
  options?: ApiRequestOptions & ApiFeedbackOptions
) {
  const result = await responseHandle<SecureVehiclePartUsagePayload>(
    () =>
      withRequestOptions(
        supabase.rpc(
          'vms_list_vehicle_part_usages_secure',
          createVehiclePartUsageRpcParams(params, 'list')
        ),
        options
      ),
    { showErrorMessage: options?.showErrorMessage ?? true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error,
    fieldAccess: result.data?.fieldAccess ?? {}
  }
}

export async function exportVehiclePartUsageList(
  params: VehiclePartUsageSearchParams & { ids?: string[]; maxRows?: number }
) {
  const result = await responseHandle<SecureVehiclePartUsagePayload>(
    () =>
      supabase.rpc(
        'vms_list_vehicle_part_usages_secure',
        createVehiclePartUsageRpcParams({ ...params, maxRows: params.maxRows ?? 10000 }, 'export')
      ),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error,
    fieldAccess: result.data?.fieldAccess ?? {}
  }
}

export async function fetchVehiclePartUsageDetail(id: string, options?: ApiFeedbackOptions) {
  return await responseHandle<VehiclePartUsage | null>(
    () => supabase.rpc('vms_get_vehicle_part_usage_secure', { p_id: id }),
    {
      showErrorMessage: options?.showErrorMessage ?? true
    }
  )
}

export async function addVehiclePartUsage(params: VehiclePartUsage) {
  const result = await responseHandle<string>(
    () =>
      supabase.rpc('vms_create_vehicle_part_usage_secure', { p_payload: keysToSnakeDeep(params) }),
    { showMessage: true, breakReturn: true }
  )
  return { ...result, data: result.data ? { id: result.data } : null }
}

export async function editVehiclePartUsage(params: VehiclePartUsage) {
  const { id, ...data } = params
  if (!id) throw new Error('缺少车辆配件使用记录 ID')
  return await responseHandle<VehiclePartUsage>(
    () =>
      supabase.rpc('vms_update_vehicle_part_usage_secure', {
        p_id: id,
        p_payload: keysToSnakeDeep(data)
      }),
    { showMessage: true, breakReturn: true }
  )
}

export async function deleteVehiclePartUsage(id: string) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_part_usages_secure', { p_ids: [id] }),
    { showMessage: true, message: '删除成功', breakReturn: true }
  )
}

export async function deleteVehiclePartUsageBatch(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_part_usages_secure', { p_ids: ids }),
    { showMessage: true, breakReturn: true }
  )
}
