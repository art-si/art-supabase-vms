import { buildSupabaseRpcRange } from '@/utils/supabase'
import { toDateStartTimestamp, toDateEndTimestamp } from '@/utils/time/date-boundary'
import { normalizeNullableText } from '@/utils/form/normalize'
import { useSupabase } from '@/hooks/core/useSupabase'
import { normalizeBooleanFilter, withRequestOptions } from '@/api/providers/supabase/query'
import type { ApiFeedbackOptions, ApiRequestOptions } from '@/types/api/request'
import {
  type VehicleMileageRecord,
  type VehicleMileageSearchParams,
  type VehicleViolationRecord,
  type VehicleViolationSearchParams,
  type VehicleAccidentRecord,
  type VehicleAccidentSearchParams
} from './types'

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

// 车辆里程
interface SecureVehicleMileagePayload {
  records: VehicleMileageRecord[]
  total: number
  fieldAccess?: Api.Vms.VehicleManage.VehicleMileageFieldAccessMap
}

const createVehicleMileageRpcParams = (
  params: VehicleMileageSearchParams & { ids?: string[]; maxRows?: number },
  purpose: 'list' | 'export'
) => {
  const from = Math.max(params.from ?? 0, 0)
  const requestedTo = params.maxRows ? from + Math.max(params.maxRows, 1) - 1 : params.to
  return {
    ...buildSupabaseRpcRange(from, requestedTo ?? 9),
    p_vehicle_id: params.vehicleId || null,
    p_company_name: normalizeNullableText(String(params.companyName ?? '')),
    p_plate_no: normalizeNullableText(String(params.plateNo ?? '')),
    p_start_time_from: toDateStartTimestamp(params.drivingTimeRange?.[0]),
    p_start_time_to: toDateEndTimestamp(params.drivingTimeRange?.[1]),
    p_ids: params.ids?.length ? params.ids : null,
    p_purpose: purpose
  }
}

export async function fetchVehicleMileageList(
  params: VehicleMileageSearchParams,
  options?: ApiRequestOptions & ApiFeedbackOptions
) {
  const result = await responseHandle<SecureVehicleMileagePayload>(
    () =>
      withRequestOptions(
        supabase.rpc(
          'vms_list_vehicle_mileage_secure',
          createVehicleMileageRpcParams(params, 'list')
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

export async function exportVehicleMileageList(
  params: VehicleMileageSearchParams & { ids?: string[]; maxRows?: number }
) {
  const result = await responseHandle<SecureVehicleMileagePayload>(
    () =>
      supabase.rpc(
        'vms_list_vehicle_mileage_secure',
        createVehicleMileageRpcParams({ ...params, maxRows: params.maxRows ?? 10000 }, 'export')
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

// 车辆违章
export interface LinkViolationDriverInput {
  id: string
  driverId: string | null
  expectedUpdatedAt: string
}

/** Associate an existing violation with a verified driver; keep its historical name. */
export async function linkVehicleViolationDriver(input: LinkViolationDriverInput) {
  const signal = AbortSignal.timeout(30_000)
  const result = await responseHandle<VehicleViolationRecord>(
    () =>
      supabase
        .rpc('vms_link_violation_driver_secure', {
          p_id: input.id,
          p_driver_id: input.driverId,
          p_expected_updated_at: input.expectedUpdatedAt
        })
        .abortSignal(signal),
    { showErrorMessage: false }
  )
  if (signal.aborted) {
    throw new Error('保存结果暂未确认，请关闭窗口并刷新列表，核对司机关联后再操作', {
      cause: result.error
    })
  }
  if (result.error) throw result.error
  return result
}

interface SecureVehicleViolationPayload {
  records: VehicleViolationRecord[]
  total: number
  fieldAccess?: Api.Vms.VehicleManage.VehicleViolationFieldAccessMap
}

const createVehicleViolationRpcParams = (
  params: VehicleViolationSearchParams & { ids?: string[]; maxRows?: number },
  purpose: 'list' | 'export'
) => {
  const from = Math.max(params.from ?? 0, 0)
  const requestedTo = params.maxRows ? from + Math.max(params.maxRows, 1) - 1 : params.to
  return {
    ...buildSupabaseRpcRange(from, requestedTo ?? 9),
    p_vehicle_id: params.vehicleId || null,
    p_company_name: normalizeNullableText(String(params.companyName ?? '')),
    p_plate_no: normalizeNullableText(String(params.plateNo ?? '')),
    p_driver_name: normalizeNullableText(String(params.driverName ?? '')),
    p_violation_behavior: normalizeNullableText(String(params.violationBehavior ?? '')),
    p_processed: normalizeBooleanFilter(params.processed) ?? null,
    p_violation_time_from: toDateStartTimestamp(params.violationTimeRange?.[0]),
    p_violation_time_to: toDateEndTimestamp(params.violationTimeRange?.[1]),
    p_ids: params.ids?.length ? params.ids : null,
    p_purpose: purpose
  }
}

export async function fetchVehicleViolationList(
  params: VehicleViolationSearchParams,
  options?: ApiRequestOptions & ApiFeedbackOptions
) {
  const result = await responseHandle<SecureVehicleViolationPayload>(
    () =>
      withRequestOptions(
        supabase.rpc(
          'vms_list_vehicle_violations_secure',
          createVehicleViolationRpcParams(params, 'list')
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

export async function exportVehicleViolationList(
  params: VehicleViolationSearchParams & { ids?: string[]; maxRows?: number }
) {
  const result = await responseHandle<SecureVehicleViolationPayload>(
    () =>
      supabase.rpc(
        'vms_list_vehicle_violations_secure',
        createVehicleViolationRpcParams({ ...params, maxRows: params.maxRows ?? 10000 }, 'export')
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

// 车辆事故
interface SecureVehicleAccidentPayload {
  records: VehicleAccidentRecord[]
  total: number
  fieldAccess?: Api.Vms.VehicleManage.VehicleAccidentFieldAccessMap
}

const createVehicleAccidentRpcParams = (
  params: VehicleAccidentSearchParams & { ids?: string[]; maxRows?: number },
  purpose: 'list' | 'export'
) => {
  const from = Math.max(params.from ?? 0, 0)
  const requestedTo = params.maxRows ? from + Math.max(params.maxRows, 1) - 1 : params.to
  return {
    ...buildSupabaseRpcRange(from, requestedTo ?? 9),
    p_vehicle_id: params.vehicleId || null,
    p_company_name: normalizeNullableText(String(params.companyName ?? '')),
    p_plate_no: normalizeNullableText(String(params.plateNo ?? '')),
    p_driver_name: normalizeNullableText(String(params.driverName ?? '')),
    p_processed: normalizeBooleanFilter(params.processed) ?? null,
    p_data_source: normalizeNullableText(String(params.dataSource ?? '')),
    p_accident_time_from: toDateStartTimestamp(params.accidentTimeRange?.[0]),
    p_accident_time_to: toDateEndTimestamp(params.accidentTimeRange?.[1]),
    p_create_time_from: toDateStartTimestamp(params.createTimeRange?.[0]),
    p_create_time_to: toDateEndTimestamp(params.createTimeRange?.[1]),
    p_ids: params.ids?.length ? params.ids : null,
    p_purpose: purpose
  }
}

export async function fetchVehicleAccidentList(
  params: VehicleAccidentSearchParams,
  options?: ApiRequestOptions & ApiFeedbackOptions
) {
  const result = await responseHandle<SecureVehicleAccidentPayload>(
    () =>
      withRequestOptions(
        supabase.rpc(
          'vms_list_vehicle_accidents_secure',
          createVehicleAccidentRpcParams(params, 'list')
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

export async function exportVehicleAccidentList(
  params: VehicleAccidentSearchParams & { ids?: string[]; maxRows?: number }
) {
  const result = await responseHandle<SecureVehicleAccidentPayload>(
    () =>
      supabase.rpc(
        'vms_list_vehicle_accidents_secure',
        createVehicleAccidentRpcParams({ ...params, maxRows: params.maxRows ?? 10000 }, 'export')
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

export async function fetchVehicleAccidentDetail(id: string, options?: ApiFeedbackOptions) {
  return await responseHandle<VehicleAccidentRecord | null>(
    () => supabase.rpc('vms_get_vehicle_accident_secure', { p_id: id }),
    {
      showErrorMessage: options?.showErrorMessage ?? true
    }
  )
}

export async function addVehicleAccident(params: VehicleAccidentRecord) {
  const result = await responseHandle<string>(
    () =>
      supabase.rpc('vms_create_vehicle_accident_secure', { p_payload: keysToSnakeDeep(params) }),
    { showMessage: true, breakReturn: true }
  )
  return { ...result, data: result.data ? { id: result.data } : null }
}

export async function editVehicleAccident(params: VehicleAccidentRecord) {
  const { id, ...data } = params
  if (!id) throw new Error('缺少车辆事故 ID')
  return await responseHandle<VehicleAccidentRecord>(
    () =>
      supabase.rpc('vms_update_vehicle_accident_secure', {
        p_id: id,
        p_payload: keysToSnakeDeep(data)
      }),
    { showMessage: true, breakReturn: true }
  )
}

export async function deleteVehicleAccident(id: string) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_accident_secure', { p_ids: [id] }),
    { showMessage: true, message: '删除成功', breakReturn: true }
  )
}

export async function deleteVehicleAccidentBatch(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_accident_secure', { p_ids: ids }),
    { showMessage: true, breakReturn: true }
  )
}
