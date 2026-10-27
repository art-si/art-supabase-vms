import { toDateStartTimestamp, toDateEndTimestamp } from '@/utils/time/date-boundary'
import { normalizeNullableText } from '@/utils/form/normalize'
import { uniq } from 'lodash-es'
import { useSupabase } from '@/hooks/core/useSupabase'
import { withRequestOptions } from '@/api/providers/supabase/query'
import type { ApiRequestOptions } from '@/types/api/request'
import type { QueryResult } from '@/types/api/response'
import { loadAllDocumentPages } from '@/utils/business/document-detail-list'
import {
  isPrivateAttachmentPath,
  signPrivateAttachmentPaths
} from '@/utils/supabase/private-attachment'
import {
  VEHICLE_DOCUMENT_BUCKET,
  privateDocumentPathForWrite,
  signVmsPrivateDocuments
} from './private-documents'
import {
  VEHICLE_REMINDER_VIEWS,
  fetchVehicleReminderViewList,
  fetchVehicleReminderViewRiskOverview
} from './reminders'
import {
  type VehicleArchive,
  type VehicleArchiveSearchParams,
  type VehicleArchiveWritePayload,
  type VehicleArchiveDeletePreview,
  type VehicleReminderSearchParams,
  type VehicleReminderCompanyOption
} from './types'

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()
const VEHICLE_DOCUMENT_FIELDS = [
  'drivingLicenseFrontUrl',
  'drivingLicenseBackUrl',
  'drivingLicenseBackReverseUrl',
  'operationLicenseUrl',
  'personVehiclePhotoUrl',
  'vehicleHeadPhotoUrl'
] as const

function vehiclePayloadWithPrivatePaths(
  payload: VehicleArchiveWritePayload
): VehicleArchiveWritePayload {
  const next = { ...payload }
  for (const field of VEHICLE_DOCUMENT_FIELDS) {
    const value = payload[field]
    if (typeof value === 'string') {
      next[field] = privateDocumentPathForWrite(value, VEHICLE_DOCUMENT_BUCKET)
    }
  }
  if (Array.isArray(payload.attachments)) {
    next.attachments = payload.attachments.map((attachment: unknown) => {
      if (!attachment || typeof attachment !== 'object' || !('url' in attachment)) return attachment
      const { url } = attachment
      return {
        ...attachment,
        url:
          typeof url === 'string' ? privateDocumentPathForWrite(url, VEHICLE_DOCUMENT_BUCKET) : url
      }
    })
  }
  return next
}

async function signVehicleArchive(record: VehicleArchive): Promise<VehicleArchive> {
  const signedImages = await signVmsPrivateDocuments(
    record,
    VEHICLE_DOCUMENT_FIELDS,
    VEHICLE_DOCUMENT_BUCKET
  )
  const attachments = signedImages.attachments ?? []
  const paths = attachments.flatMap((attachment) =>
    isPrivateAttachmentPath(attachment.url) ? [attachment.url] : []
  )
  const signed = await signPrivateAttachmentPaths(VEHICLE_DOCUMENT_BUCKET, paths)
  return {
    ...signedImages,
    attachments: attachments.map((attachment) => ({
      ...attachment,
      url: isPrivateAttachmentPath(attachment.url)
        ? (signed.get(attachment.url) ?? '')
        : attachment.url
    }))
  }
}

interface VehicleArchiveWriteOptions {
  showMessage?: boolean
}

interface SecureVehicleArchivePayload {
  records: VehicleArchive[]
  total: number
  fieldAccess?: Api.Vms.ArchiveManage.VehicleArchiveFieldAccessMap
}

export interface VehicleArchiveNavigationItem {
  id: string
  vehicleOwnership: string
  vehicleType: string
}

export async function fetchVehicleArchiveNavigation(options?: ApiRequestOptions) {
  return await responseHandle<VehicleArchiveNavigationItem[]>(
    () => withRequestOptions(supabase.rpc('vms_list_vehicle_archive_navigation_secure'), options),
    { showErrorMessage: false }
  )
}

export async function importVehicleArchives(rows: VehicleArchiveWritePayload[]) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_import_vehicle_archives_secure', { p_rows: keysToSnakeDeep(rows) }),
    { showErrorMessage: false }
  )
}

const createVehicleArchiveRpcParams = (
  params: VehicleArchiveSearchParams & { ids?: string[]; maxRows?: number },
  purpose: 'list' | 'export'
) => {
  const from = Math.max(params.from ?? 0, 0)
  const requestedTo = params.maxRows ? from + Math.max(params.maxRows, 1) - 1 : params.to
  const to = Math.max(requestedTo ?? 9, from)
  return {
    p_from: from,
    p_to: to,
    p_record_id: params.recordId || null,
    p_carrier_id: params.carrierId || null,
    p_plate_no: normalizeNullableText(String(params.plateNo ?? '')),
    p_company_name: normalizeNullableText(String(params.companyName ?? '')),
    p_vehicle_type: params.vehicleType || null,
    p_manufacturer: normalizeNullableText(String(params.manufacturer ?? '')),
    p_vin: normalizeNullableText(String(params.vin ?? '')),
    p_operation_status: params.operationStatus || null,
    p_audit_status: params.auditStatus || null,
    p_audit_statuses: params.auditStatuses?.length ? params.auditStatuses : null,
    p_create_time_from: toDateStartTimestamp(params.createTimeRange?.[0]),
    p_create_time_to: toDateEndTimestamp(params.createTimeRange?.[1]),
    p_ids: params.ids?.length ? params.ids : null,
    p_purpose: purpose
  }
}

export async function fetchVehicleArchiveList(
  params: VehicleArchiveSearchParams & { ids?: string[] },
  options?: ApiRequestOptions
) {
  const result = await responseHandle<SecureVehicleArchivePayload>(
    () =>
      withRequestOptions(
        supabase.rpc(
          'vms_list_vehicle_archives_secure',
          createVehicleArchiveRpcParams(params, 'list')
        ),
        options
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

export async function exportVehicleArchiveList(
  params: VehicleArchiveSearchParams & { ids?: string[]; maxRows?: number }
) {
  const result = await responseHandle<SecureVehicleArchivePayload>(
    () =>
      supabase.rpc(
        'vms_list_vehicle_archives_secure',
        createVehicleArchiveRpcParams({ ...params, maxRows: params.maxRows ?? 10000 }, 'export')
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

export async function fetchVehicleArchiveDetail(id: string) {
  const result = await responseHandle<VehicleArchive | null>(
    () => supabase.rpc('vms_get_vehicle_archive_secure', { p_id: id }),
    { showErrorMessage: true }
  )
  return { ...result, data: result.data ? await signVehicleArchive(result.data) : null }
}

export async function addVehicleArchive(
  params: VehicleArchiveWritePayload,
  options: VehicleArchiveWriteOptions = {}
) {
  const result = await responseHandle<string>(
    () =>
      supabase.rpc('vms_create_vehicle_archive_secure', {
        p_payload: keysToSnakeDeep(vehiclePayloadWithPrivatePaths(params))
      }),
    { showMessage: options.showMessage ?? true, breakReturn: true }
  )
  return { ...result, data: result.data ? { id: result.data } : null }
}

export async function editVehicleArchive(
  params: VehicleArchiveWritePayload,
  options: VehicleArchiveWriteOptions = {}
) {
  const { id, ...payload } = params
  if (!id) throw new Error('缺少车辆档案 ID')
  return await responseHandle<VehicleArchive>(
    () =>
      supabase.rpc('vms_update_vehicle_archive_secure', {
        p_id: id,
        p_payload: keysToSnakeDeep(vehiclePayloadWithPrivatePaths(payload))
      }),
    { showMessage: options.showMessage ?? true, breakReturn: true }
  )
}

export async function fetchVehicleArchiveDeletePreview(id: string) {
  return await responseHandle<VehicleArchiveDeletePreview>(
    () => supabase.rpc('vms_get_vehicle_archive_delete_preview_secure', { p_id: id }),
    { showErrorMessage: true }
  )
}

export async function deleteVehicleArchive(id: string) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_archives_secure', { p_ids: [id] }),
    { showMessage: true, message: '删除成功', breakReturn: true }
  )
}

export async function deleteVehicleArchiveBatch(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_archives_secure', { p_ids: ids }),
    { showMessage: true, breakReturn: true }
  )
}

// 车辆管理选项
export async function fetchVehicleArchiveOptions(
  params: Partial<Pick<VehicleArchive, 'carrierId' | 'plateNo' | 'companyName'>> = {},
  options?: ApiRequestOptions
) {
  const { carrierId, plateNo, companyName } = params
  return await responseHandle<Api.Vms.VehicleManage.VehicleOption[]>(
    () =>
      withRequestOptions(
        supabase.rpc('vms_list_vehicle_archive_options_secure', {
          p_carrier_id: carrierId || null,
          p_plate_no: normalizeNullableText(String(plateNo ?? '')),
          p_company_name: normalizeNullableText(String(companyName ?? '')),
          p_ids: null,
          p_max_rows: 200
        }),
        options
      ),
    {
      showErrorMessage: true
    }
  )
}

export async function fetchVehicleReminderCompanyOptions() {
  const results = await Promise.all(
    VEHICLE_REMINDER_VIEWS.map((viewName) =>
      responseHandle<VehicleReminderCompanyOption[]>(
        () =>
          supabase
            .from(viewName)
            .select('company_name')
            .not('company_name', 'is', null)
            .neq('company_name', '')
            .order('company_name', { ascending: true }),
        { showErrorMessage: true }
      )
    )
  )

  const failedResult = results.find((result) => result.error)
  if (failedResult) return { data: null, error: failedResult.error }

  const companyNames = uniq(
    results.flatMap((result) => (result.data ?? []).map((item) => item.companyName)).filter(Boolean)
  )

  return {
    data: companyNames
      .sort((first, second) => first.localeCompare(second, 'zh-CN'))
      .map((companyName) => ({ companyName })),
    error: null
  }
}

export async function fetchVehicleReminderInsuranceExpiryList(
  params: VehicleReminderSearchParams,
  options?: ApiRequestOptions
) {
  return await fetchVehicleReminderViewList(
    'vehicle_reminder_insurance_expiry',
    'insurance',
    params,
    'days',
    options
  )
}

export async function fetchVehicleReminderInsuranceRiskOverview(
  params: VehicleReminderSearchParams,
  options?: ApiRequestOptions
) {
  return await fetchVehicleReminderViewRiskOverview(
    'vehicle_reminder_insurance_expiry',
    params,
    options
  )
}

export async function fetchVehicleReminderInspectionExpiryList(
  params: VehicleReminderSearchParams,
  options?: ApiRequestOptions
) {
  return await fetchVehicleReminderViewList(
    'vehicle_reminder_inspection_expiry',
    'inspection',
    params,
    'days',
    options
  )
}

export async function fetchVehicleReminderInspectionRiskOverview(
  params: VehicleReminderSearchParams,
  options?: ApiRequestOptions
) {
  return await fetchVehicleReminderViewRiskOverview(
    'vehicle_reminder_inspection_expiry',
    params,
    options
  )
}

export async function fetchVehicleReminderVehicleServiceLifeList(
  params: VehicleReminderSearchParams,
  options?: ApiRequestOptions
) {
  return await fetchVehicleReminderViewList(
    'vehicle_reminder_vehicle_service_life',
    'vehicle',
    params,
    'days',
    options
  )
}

export async function fetchVehicleReminderVehicleServiceLifeRiskOverview(
  params: VehicleReminderSearchParams,
  options?: ApiRequestOptions
) {
  return await fetchVehicleReminderViewRiskOverview(
    'vehicle_reminder_vehicle_service_life',
    params,
    options
  )
}

export async function fetchVehicleReminderMaintenanceExpiryList(
  params: VehicleReminderSearchParams,
  options?: ApiRequestOptions
) {
  return await fetchVehicleReminderViewList(
    'vehicle_reminder_maintenance_expiry',
    'maintenance',
    params,
    'expired',
    options
  )
}

export async function fetchVehicleReminderMaintenanceRiskOverview(
  params: VehicleReminderSearchParams,
  options?: ApiRequestOptions
) {
  return await fetchVehicleReminderViewRiskOverview(
    'vehicle_reminder_maintenance_expiry',
    params,
    options
  )
}

export async function fetchVehicleReminderPartServiceLifeList(
  params: VehicleReminderSearchParams,
  options?: ApiRequestOptions
) {
  return await fetchVehicleReminderViewList(
    'vehicle_reminder_part_service_life',
    'part',
    params,
    'expired',
    options
  )
}

export async function fetchVehicleReminderPartServiceLifeRiskOverview(
  params: VehicleReminderSearchParams,
  options?: ApiRequestOptions
) {
  return await fetchVehicleReminderViewRiskOverview(
    'vehicle_reminder_part_service_life',
    params,
    options
  )
}

export async function fetchInsuranceCompanyOptions(_params?: unknown, options?: ApiRequestOptions) {
  type CompanyOption = Api.Vms.VehicleManage.InsuranceCompanyOption
  try {
    const data = await loadAllDocumentPages<CompanyOption, { from?: number; to?: number }>(
      ({ from = 0, to = 499 }) =>
        responseHandle<CompanyOption[]>(
          () =>
            withRequestOptions(
              supabase
                .from('mdm_insurance_company')
                .select('id, company_name, contact_person, contact_phone', { count: 'exact' })
                .order('company_name', { ascending: true })
                .order('id')
                .range(from, to),
              options
            ),
          { showErrorMessage: true }
        ),
      {}
    )
    return { data, total: data.length, error: null } satisfies QueryResult<CompanyOption[]>
  } catch (error) {
    return { data: null, error } satisfies QueryResult<CompanyOption[]>
  }
}
