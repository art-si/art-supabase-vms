import { normalizeNullableText } from '@/utils/form/normalize'
import { useSupabase } from '@/hooks/core/useSupabase'
import { withRequestOptions } from '@/api/providers/supabase/query'
import type { ApiRequestOptions } from '@/types/api/request'

export type VmsCarrierReference = Api.Vms.Integration.CarrierReference

export type VmsDriverReference = Api.Vms.Integration.DriverReference

export interface VmsAssetReferenceParams {
  tenantId?: string | null
  vehicleId?: string | null
  trailerId?: string | null
  keyword?: string
}

export interface VmsAssetCompanyOption {
  id: string
  label: string
  isDefault: boolean
}

export interface VmsHrEmployeeReference {
  id: string
  employeeNo: string
  employeeName: string
  organizationId?: string | null
  jobTitle?: string | null
  employmentStatus: 'probation' | 'active' | 'leave' | 'terminated'
}

interface CarrierReferenceParams {
  carrierCode?: string
  companyName?: string
  excludeId?: string
  includeDisabled?: boolean
  ids?: string[]
  maxRows?: number
}

interface DriverReferenceParams {
  carrierId?: string | null
  driverName?: string
  driverType?: 'primary' | 'secondary'
  ids?: string[]
  includeDisabled?: boolean
  maxRows?: number
}

export type VmsAssetDriverOwnership = 'self_operated' | 'carrier' | 'individual_affiliation'

export interface VmsAssetDriverReferenceParams {
  tenantId?: string | null
  vehicleId?: string | null
  vehicleOwnership: VmsAssetDriverOwnership
  carrierId?: string | null
  driverType: 'primary' | 'secondary'
  driverName?: string
  maxRows?: number
}

const { supabase, responseHandle } = useSupabase()

function assetReferenceParams(params: VmsAssetReferenceParams) {
  return {
    p_tenant_id: params.tenantId || null,
    p_vehicle_id: params.vehicleId || null,
    p_trailer_id: params.trailerId || null,
    p_keyword: normalizeNullableText(params.keyword)
  }
}

export async function fetchVmsAssetCompanyOptions(params: VmsAssetReferenceParams = {}) {
  return await responseHandle<VmsAssetCompanyOption[]>(
    () => supabase.rpc('vms_list_asset_company_options_secure', assetReferenceParams(params)),
    { showErrorMessage: false }
  )
}

export async function fetchVmsAssetCarrierReferences(
  params: VmsAssetReferenceParams & { ids?: string[]; maxRows?: number } = {}
) {
  return await responseHandle<VmsCarrierReference[]>(
    () =>
      supabase.rpc('vms_list_asset_carrier_options_secure', {
        ...assetReferenceParams(params),
        p_ids: params.ids?.length ? params.ids : null,
        p_max_rows: params.maxRows ?? 200
      }),
    { showErrorMessage: false }
  )
}

/**
 * VMS consumer adapter for TMS-owned carrier data.
 *
 * The database RPC is the integration contract; VMS never imports the TMS
 * transport implementation and only receives tenant-scoped, masked fields.
 */
export async function fetchVmsCarrierReferences(
  params: CarrierReferenceParams = {},
  options?: ApiRequestOptions
) {
  const {
    carrierCode,
    companyName,
    excludeId,
    includeDisabled = false,
    ids,
    maxRows = 200
  } = params

  return await responseHandle<VmsCarrierReference[]>(
    () =>
      withRequestOptions(
        supabase.rpc('tms_list_carrier_options_secure', {
          p_exclude_id: excludeId || null,
          p_include_disabled: includeDisabled,
          p_keyword: normalizeNullableText(String(companyName || carrierCode || '')),
          p_ids: ids?.length ? ids : null,
          p_max_rows: maxRows
        }),
        options
      ),
    { showErrorMessage: true }
  )
}

export async function fetchVmsDriverReferences(
  params: DriverReferenceParams = {},
  options?: ApiRequestOptions
) {
  const { carrierId, driverName, driverType, ids, includeDisabled = false, maxRows = 200 } = params

  return await responseHandle<VmsDriverReference[]>(
    () =>
      withRequestOptions(
        supabase.rpc('tms_list_driver_options_secure', {
          p_carrier_id: carrierId || null,
          p_driver_name: normalizeNullableText(String(driverName ?? '')),
          p_driver_type: driverType || null,
          p_ids: ids?.length ? ids : null,
          p_include_disabled: includeDisabled,
          p_max_rows: maxRows
        }),
        options
      ),
    { showErrorMessage: true }
  )
}

/** Tenant- and ownership-scoped driver choices for vehicle archive editing. */
export async function fetchVmsAssetDriverReferences(
  params: VmsAssetDriverReferenceParams,
  options?: ApiRequestOptions
) {
  return await responseHandle<VmsDriverReference[]>(
    () =>
      withRequestOptions(
        supabase.rpc('vms_list_asset_driver_options_secure', {
          p_tenant_id: params.tenantId || null,
          p_vehicle_id: params.vehicleId || null,
          p_vehicle_ownership: params.vehicleOwnership,
          p_carrier_id: params.carrierId || null,
          p_driver_type: params.driverType,
          p_driver_name: normalizeNullableText(String(params.driverName ?? '')),
          p_max_rows: params.maxRows ?? 200
        }),
        options
      ),
    { showErrorMessage: false }
  )
}

/** Driver choices for a specific VMS vehicle, scoped to that vehicle's tenant. */
export async function fetchVmsVehicleDriverReferences(
  vehicleId: string,
  params: { driverName?: string; maxRows?: number } = {},
  options?: ApiRequestOptions
) {
  return await responseHandle<VmsDriverReference[]>(
    () =>
      withRequestOptions(
        supabase.rpc('vms_list_vehicle_driver_options_secure', {
          p_vehicle_id: vehicleId,
          p_driver_name: normalizeNullableText(String(params.driverName ?? '')),
          p_max_rows: params.maxRows ?? 200
        }),
        options
      ),
    { showErrorMessage: true }
  )
}

/** HR-owned read model exposed specifically for VMS use cases. */
export async function fetchVmsHrEmployeeReferences(
  params: { keyword?: string; maxRows?: number } = {},
  options?: ApiRequestOptions
) {
  return await responseHandle<VmsHrEmployeeReference[]>(
    () =>
      withRequestOptions(
        supabase.rpc('vms_list_hr_employee_options_secure', {
          p_keyword: normalizeNullableText(String(params.keyword ?? '')),
          p_max_rows: params.maxRows ?? 100
        }),
        options
      ),
    { showErrorMessage: true }
  )
}
