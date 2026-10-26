import { useSupabase } from '@/hooks/core/useSupabase'
import { normalizeNullableText } from '@/utils/form/normalize'
import type {
  TrailerCompanyOption,
  TrailerRecord,
  TrailerSearchParams,
  TrailerWritePayload
} from '@vms/types/trailer'

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

interface TrailerListResponse {
  records: TrailerRecord[]
  total: number
}

export async function fetchTrailerList(params: TrailerSearchParams) {
  const result = await responseHandle<TrailerListResponse>(
    () =>
      supabase.rpc('vms_list_trailers_secure', {
        p_from: params.from,
        p_to: params.to,
        p_plate_no: normalizeNullableText(params.plateNo ?? '')
      }),
    { showErrorMessage: true }
  )

  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error
  }
}

export async function fetchTrailerDetail(id: string) {
  return await responseHandle<TrailerRecord | null>(
    () => supabase.rpc('vms_get_trailer_secure', { p_id: id }),
    { showErrorMessage: true }
  )
}

export async function fetchTrailerCompanyOptions(keyword = '', trailerId: string | null = null) {
  return await responseHandle<TrailerCompanyOption[]>(
    () =>
      supabase.rpc('vms_list_trailer_company_options_secure', {
        p_keyword: normalizeNullableText(keyword),
        p_trailer_id: trailerId
      }),
    { showErrorMessage: true }
  )
}

export async function saveTrailer(id: string | null, payload: TrailerWritePayload) {
  return await responseHandle<TrailerRecord>(
    () =>
      supabase.rpc('vms_save_trailer_secure', {
        p_id: id,
        p_payload: keysToSnakeDeep(payload)
      }),
    { showMessage: true, breakReturn: true }
  )
}

export interface TrailerOption {
  id: string
  plateNo: string
  plateColor: string
  trailerType: string
  tenantId: string
  isDefault: boolean
}

export interface TrailerOptionParams {
  vehicleId?: string | null
  keyword?: string
  from?: number
  to?: number
}

export async function fetchTrailerOptions(params: TrailerOptionParams = {}) {
  const result = await responseHandle<{ records: TrailerOption[]; total: number }>(
    () =>
      supabase.rpc('vms_list_trailer_options_secure', {
        p_vehicle_id: params.vehicleId ?? null,
        p_keyword: normalizeNullableText(params.keyword ?? ''),
        p_from: params.from ?? 0,
        p_to: params.to ?? 19
      }),
    { showErrorMessage: true }
  )
  return { data: result.data?.records ?? [], total: result.data?.total ?? 0, error: result.error }
}

export async function fetchDefaultTrailer(vehicleId: string) {
  return await responseHandle<TrailerOption | null>(
    () => supabase.rpc('vms_get_default_trailer_secure', { p_vehicle_id: vehicleId }),
    { showErrorMessage: true }
  )
}

export async function setDefaultTrailer(params: { vehicleId: string; trailerId: string | null }) {
  return await responseHandle<TrailerOption | null>(
    () =>
      supabase.rpc('vms_set_default_trailer_secure', {
        p_vehicle_id: params.vehicleId,
        p_trailer_id: params.trailerId
      }),
    { showMessage: true, breakReturn: true }
  )
}
