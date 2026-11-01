import { buildSupabaseRpcRange } from '@/utils/supabase'
import { toDateStartTimestamp, toDateEndTimestamp } from '@/utils/time/date-boundary'
import { normalizeNullableText } from '@/utils/form/normalize'
import { useSupabase } from '@/hooks/core/useSupabase'
import { withRequestOptions } from '@/api/providers/supabase/query'
import type { ApiFeedbackOptions, ApiRequestOptions } from '@/types/api/request'
import {
  type VehicleInsurance,
  type VehicleInsuranceSearchParams,
  type VehicleInspection,
  type VehicleInspectionSearchParams,
  type VehicleRoutineInspectionRecord,
  type VehicleRoutineInspectionSearchParams
} from './types'

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

// 车辆保险
interface SecureVehicleInsurancePayload {
  records: VehicleInsurance[]
  total: number
  fieldAccess?: Api.Vms.VehicleManage.VehicleInsuranceFieldAccessMap
}

const createVehicleInsuranceRpcParams = (
  params: VehicleInsuranceSearchParams & { ids?: string[]; maxRows?: number },
  purpose: 'list' | 'export'
) => {
  const from = Math.max(params.from ?? 0, 0)
  const requestedTo = params.maxRows ? from + Math.max(params.maxRows, 1) - 1 : params.to
  return {
    ...buildSupabaseRpcRange(from, requestedTo ?? 9),
    p_vehicle_id: params.vehicleId || null,
    p_company_name: normalizeNullableText(String(params.companyName ?? '')),
    p_plate_no: normalizeNullableText(String(params.plateNo ?? '')),
    p_commercial_policy_no: normalizeNullableText(String(params.commercialPolicyNo ?? '')),
    p_compulsory_policy_no: normalizeNullableText(String(params.compulsoryPolicyNo ?? '')),
    p_commercial_expire_from: params.commercialExpireDateRange?.[0] || null,
    p_commercial_expire_to: params.commercialExpireDateRange?.[1] || null,
    p_compulsory_expire_from: params.compulsoryExpireDateRange?.[0] || null,
    p_compulsory_expire_to: params.compulsoryExpireDateRange?.[1] || null,
    p_create_time_from: toDateStartTimestamp(params.createTimeRange?.[0]),
    p_create_time_to: toDateEndTimestamp(params.createTimeRange?.[1]),
    p_ids: params.ids?.length ? params.ids : null,
    p_purpose: purpose
  }
}

export async function fetchVehicleInsuranceList(
  params: VehicleInsuranceSearchParams,
  options?: ApiRequestOptions & ApiFeedbackOptions
) {
  const result = await responseHandle<SecureVehicleInsurancePayload>(
    () =>
      withRequestOptions(
        supabase.rpc(
          'vms_list_vehicle_insurance_secure',
          createVehicleInsuranceRpcParams(params, 'list')
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

export async function exportVehicleInsuranceList(
  params: VehicleInsuranceSearchParams & { ids?: string[]; maxRows?: number }
) {
  const result = await responseHandle<SecureVehicleInsurancePayload>(
    () =>
      supabase.rpc(
        'vms_list_vehicle_insurance_secure',
        createVehicleInsuranceRpcParams({ ...params, maxRows: params.maxRows ?? 10000 }, 'export')
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

export async function fetchVehicleInsuranceDetail(id: string, options?: ApiFeedbackOptions) {
  return await responseHandle<VehicleInsurance | null>(
    () => supabase.rpc('vms_get_vehicle_insurance_secure', { p_id: id }),
    {
      showErrorMessage: options?.showErrorMessage ?? true
    }
  )
}

export async function addVehicleInsurance(params: VehicleInsurance) {
  const result = await responseHandle<string>(
    () =>
      supabase.rpc('vms_create_vehicle_insurance_secure', {
        p_payload: keysToSnakeDeep(params)
      }),
    { showMessage: true, breakReturn: true }
  )
  return { ...result, data: result.data ? { id: result.data } : null }
}

export async function editVehicleInsurance(params: VehicleInsurance) {
  const { id, ...data } = params
  if (!id) throw new Error('缺少车辆保险 ID')
  return await responseHandle<VehicleInsurance>(
    () =>
      supabase.rpc('vms_update_vehicle_insurance_secure', {
        p_id: id,
        p_payload: keysToSnakeDeep(data)
      }),
    { showMessage: true, breakReturn: true }
  )
}

export async function deleteVehicleInsurance(id: string) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_insurance_secure', { p_ids: [id] }),
    {
      showMessage: true,
      message: '删除成功',
      showErrorMessage: false,
      showReferenceFeedback: false,
      breakReturn: true,
      requireAffected: true
    }
  )
}

export async function deleteVehicleInsuranceBatch(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_insurance_secure', { p_ids: ids }),
    {
      showMessage: true,
      showErrorMessage: false,
      showReferenceFeedback: false,
      breakReturn: true,
      requireAffected: true
    }
  )
}

// 车辆年检
interface SecureVehicleInspectionPayload {
  records: VehicleInspection[]
  total: number
  fieldAccess?: Api.Vms.VehicleManage.VehicleInspectionFieldAccessMap
}

const createVehicleInspectionRpcParams = (
  params: VehicleInspectionSearchParams & { ids?: string[]; maxRows?: number },
  purpose: 'list' | 'export'
) => {
  const from = Math.max(params.from ?? 0, 0)
  const requestedTo = params.maxRows ? from + Math.max(params.maxRows, 1) - 1 : params.to
  return {
    ...buildSupabaseRpcRange(from, requestedTo ?? 9),
    p_vehicle_id: params.vehicleId || null,
    p_company_name: normalizeNullableText(String(params.companyName ?? '')),
    p_plate_no: normalizeNullableText(String(params.plateNo ?? '')),
    p_inspection_no: normalizeNullableText(String(params.inspectionNo ?? '')),
    p_expire_from: params.expireDateRange?.[0] || null,
    p_expire_to: params.expireDateRange?.[1] || null,
    p_create_time_from: toDateStartTimestamp(params.createTimeRange?.[0]),
    p_create_time_to: toDateEndTimestamp(params.createTimeRange?.[1]),
    p_ids: params.ids?.length ? params.ids : null,
    p_purpose: purpose
  }
}

export async function fetchVehicleInspectionList(
  params: VehicleInspectionSearchParams,
  options?: ApiRequestOptions & ApiFeedbackOptions
) {
  const result = await responseHandle<SecureVehicleInspectionPayload>(
    () =>
      withRequestOptions(
        supabase.rpc(
          'vms_list_vehicle_inspections_secure',
          createVehicleInspectionRpcParams(params, 'list')
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

export async function exportVehicleInspectionList(
  params: VehicleInspectionSearchParams & { ids?: string[]; maxRows?: number }
) {
  const result = await responseHandle<SecureVehicleInspectionPayload>(
    () =>
      supabase.rpc(
        'vms_list_vehicle_inspections_secure',
        createVehicleInspectionRpcParams({ ...params, maxRows: params.maxRows ?? 10000 }, 'export')
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

export async function fetchVehicleInspectionDetail(id: string, options?: ApiFeedbackOptions) {
  return await responseHandle<VehicleInspection | null>(
    () => supabase.rpc('vms_get_vehicle_inspection_secure', { p_id: id }),
    {
      showErrorMessage: options?.showErrorMessage ?? true
    }
  )
}
export async function addVehicleInspection(params: VehicleInspection) {
  const result = await responseHandle<string>(
    () =>
      supabase.rpc('vms_create_vehicle_inspection_secure', {
        p_payload: keysToSnakeDeep(params)
      }),
    { showMessage: true, breakReturn: true }
  )
  return { ...result, data: result.data ? { id: result.data } : null }
}

export async function editVehicleInspection(params: VehicleInspection) {
  const { id, ...data } = params
  if (!id) throw new Error('缺少车辆年检 ID')
  return await responseHandle<VehicleInspection>(
    () =>
      supabase.rpc('vms_update_vehicle_inspection_secure', {
        p_id: id,
        p_payload: keysToSnakeDeep(data)
      }),
    { showMessage: true, breakReturn: true }
  )
}

export async function deleteVehicleInspection(id: string) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_inspections_secure', { p_ids: [id] }),
    {
      showMessage: true,
      message: '删除成功',
      showErrorMessage: false,
      showReferenceFeedback: false,
      breakReturn: true,
      requireAffected: true
    }
  )
}

export async function deleteVehicleInspectionBatch(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_inspections_secure', { p_ids: ids }),
    {
      showMessage: true,
      showErrorMessage: false,
      showReferenceFeedback: false,
      breakReturn: true,
      requireAffected: true
    }
  )
}

// 车辆例行检查
interface SecureVehicleRoutineInspectionPayload {
  records: VehicleRoutineInspectionRecord[]
  total: number
  fieldAccess?: Api.Vms.VehicleManage.VehicleRoutineInspectionFieldAccessMap
}

const createVehicleRoutineInspectionRpcParams = (
  params: VehicleRoutineInspectionSearchParams & { ids?: string[]; maxRows?: number },
  purpose: 'list' | 'export'
) => {
  const from = Math.max(params.from ?? 0, 0)
  const requestedTo = params.maxRows ? from + Math.max(params.maxRows, 1) - 1 : params.to
  return {
    ...buildSupabaseRpcRange(from, requestedTo ?? 9),
    p_vehicle_id: params.vehicleId || null,
    p_company_name: normalizeNullableText(String(params.companyName ?? '')),
    p_plate_no: normalizeNullableText(String(params.plateNo ?? '')),
    p_inspection_type: normalizeNullableText(String(params.inspectionType ?? '')),
    p_check_result: normalizeNullableText(String(params.checkResult ?? '')),
    p_inspection_time_from: toDateStartTimestamp(params.inspectionTimeRange?.[0]),
    p_inspection_time_to: toDateEndTimestamp(params.inspectionTimeRange?.[1]),
    p_create_time_from: toDateStartTimestamp(params.createTimeRange?.[0]),
    p_create_time_to: toDateEndTimestamp(params.createTimeRange?.[1]),
    p_ids: params.ids?.length ? params.ids : null,
    p_purpose: purpose
  }
}

export async function fetchVehicleRoutineInspectionList(
  params: VehicleRoutineInspectionSearchParams,
  options?: ApiRequestOptions & ApiFeedbackOptions
) {
  const result = await responseHandle<SecureVehicleRoutineInspectionPayload>(
    () =>
      withRequestOptions(
        supabase.rpc(
          'vms_list_vehicle_routine_inspections_secure',
          createVehicleRoutineInspectionRpcParams(params, 'list')
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

export async function exportVehicleRoutineInspectionList(
  params: VehicleRoutineInspectionSearchParams & { ids?: string[]; maxRows?: number }
) {
  const result = await responseHandle<SecureVehicleRoutineInspectionPayload>(
    () =>
      supabase.rpc(
        'vms_list_vehicle_routine_inspections_secure',
        createVehicleRoutineInspectionRpcParams(
          { ...params, maxRows: params.maxRows ?? 10000 },
          'export'
        )
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

export async function fetchVehicleRoutineInspectionDetail(
  id: string,
  options?: ApiFeedbackOptions
) {
  return await responseHandle<VehicleRoutineInspectionRecord | null>(
    () => supabase.rpc('vms_get_vehicle_routine_inspection_secure', { p_id: id }),
    {
      showErrorMessage: options?.showErrorMessage ?? true
    }
  )
}

export async function addVehicleRoutineInspection(params: VehicleRoutineInspectionRecord) {
  const result = await responseHandle<string>(
    () =>
      supabase.rpc('vms_create_vehicle_routine_inspection_secure', {
        p_payload: keysToSnakeDeep(params)
      }),
    { showMessage: true, breakReturn: true }
  )
  return { ...result, data: result.data ? { id: result.data } : null }
}

export async function editVehicleRoutineInspection(params: VehicleRoutineInspectionRecord) {
  const { id, ...data } = params
  if (!id) throw new Error('缺少车辆例检记录 ID')
  return await responseHandle<VehicleRoutineInspectionRecord>(
    () =>
      supabase.rpc('vms_update_vehicle_routine_inspection_secure', {
        p_id: id,
        p_payload: keysToSnakeDeep(data)
      }),
    { showMessage: true, breakReturn: true }
  )
}

export async function deleteVehicleRoutineInspection(id: string) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_routine_inspections_secure', { p_ids: [id] }),
    {
      showMessage: true,
      message: '删除成功',
      showErrorMessage: false,
      showReferenceFeedback: false,
      breakReturn: true,
      requireAffected: true
    }
  )
}

export async function deleteVehicleRoutineInspectionBatch(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_routine_inspections_secure', { p_ids: ids }),
    {
      showMessage: true,
      showErrorMessage: false,
      showReferenceFeedback: false,
      breakReturn: true,
      requireAffected: true
    }
  )
}
