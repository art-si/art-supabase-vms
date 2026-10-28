import { useSupabase } from '@/hooks/core/useSupabase'
import { normalizeNullableText } from '@/utils/form/normalize'

const { supabase, responseHandle } = useSupabase()

export type VehiclePartReferenceSource =
  'vms_part_issue_line' | 'vms_part_stock_movement' | 'vms_part_stock'

export interface VehiclePartReferenceDestination {
  tab: 'issues' | 'inventory'
  issueId?: string
  partId?: string
}

/** Resolve a delete-guard reference to the authorized VMS record it belongs to. */
export async function fetchVehiclePartReferenceDestination(
  sourceTable: VehiclePartReferenceSource,
  recordId: string
): Promise<VehiclePartReferenceDestination | null> {
  const id = recordId.split(':').at(-1)
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null
  }
  const { data } = await responseHandle<VehiclePartReferenceDestination | null>(
    () =>
      supabase.rpc('vms_get_part_reference_destination_secure', {
        p_source_table: sourceTable,
        p_record_id: id
      }),
    { breakReturn: true, showErrorMessage: false, errorMessage: '关联配件记录定位失败，请重试' }
  )
  if (!data || !['issues', 'inventory'].includes(data.tab)) return null
  return {
    tab: data.tab,
    issueId: typeof data.issueId === 'string' ? data.issueId : undefined,
    partId: typeof data.partId === 'string' ? data.partId : undefined
  }
}

export interface VehiclePartStock {
  id: string
  partId: string
  partCode: string
  partName: string
  categoryId?: string | null
  categoryName?: string | null
  model: string | null
  brand: string | null
  unit: string | null
  stockQty: number
  updatedAt: string | null
}

export type VehiclePartIssueStatus = 'in_use' | 'returned' | 'lost' | 'damaged'

export interface VehiclePartIssueLine {
  id: string
  partId: string
  partCode: string
  partName: string
  model: string | null
  brand: string | null
  unit: string | null
  issuedQty: number
  returnedQty: number
  lostQty: number
  damagedQty: number
  settledQty: number
  issuedAt: string
  returnedAt: string | null
  status: VehiclePartIssueStatus
  imagePath: string | null
}

export interface VehiclePartIssue {
  id: string
  documentNo: string
  vehicleId: string
  plateNo: string
  driverId: string | null
  driverName: string | null
  remark: string | null
  lineCount: number
  issuedQty: number
  returnedQty: number
  createTime: string
}

export interface VehiclePartIssueDetail extends VehiclePartIssue {
  lines: VehiclePartIssueLine[]
}

export interface VehiclePartStockMovement {
  id: string
  postingSeq: number
  partId: string
  partCode: string
  partName: string
  movementType: 'receipt' | 'issue' | 'return' | 'lost' | 'damaged'
  quantity: number
  stockDelta: number
  balanceAfter: number
  occurredAt: string
  referenceNo: string | null
  remark: string | null
}

export async function fetchVehiclePartStock(partId?: string) {
  const result = await responseHandle<{ records: VehiclePartStock[]; total: number }>(
    () => supabase.rpc('vms_list_part_stock_secure', { p_part_id: partId || null }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error
  }
}

export async function fetchVehiclePartStockMovements(params: {
  from: number
  to: number
  partId?: string
}) {
  const result = await responseHandle<{ records: VehiclePartStockMovement[]; total: number }>(
    () =>
      supabase.rpc('vms_list_part_stock_movements_secure', {
        p_from: params.from,
        p_to: params.to,
        p_part_id: params.partId || null
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error
  }
}

export async function fetchVehiclePartIssues(params: {
  from: number
  to: number
  vehicleId?: string
  documentNo?: string
}) {
  const result = await responseHandle<{ records: VehiclePartIssue[]; total: number }>(
    () =>
      supabase.rpc('vms_list_part_issue_secure', {
        p_from: params.from,
        p_to: params.to,
        p_vehicle_id: params.vehicleId || null,
        p_document_no: normalizeNullableText(params.documentNo ?? '')
      }),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error
  }
}

export async function fetchVehiclePartIssueDetail(id: string) {
  return await responseHandle<VehiclePartIssueDetail>(
    () => supabase.rpc('vms_get_part_issue_secure', { p_id: id }),
    { showErrorMessage: true }
  )
}

export async function postVehiclePartStockReceipt(payload: {
  partId: string
  quantity: number
  occurredAt: string
  remark?: string
  idempotencyKey: string
}) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('vms_post_part_stock_receipt_secure', {
        p_payload: {
          part_id: payload.partId,
          quantity: payload.quantity,
          occurred_at: payload.occurredAt,
          remark: normalizeNullableText(payload.remark ?? ''),
          idempotency_key: payload.idempotencyKey
        }
      }),
    { showMessage: true, breakReturn: true }
  )
}

export async function createVehiclePartIssue(payload: {
  vehicleId: string
  driverId?: string
  remark?: string
  idempotencyKey: string
  lines: Array<{
    partId: string
    issuedQty: number
    issuedAt: string
    imagePath?: string
  }>
}) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('vms_create_part_issue_secure', {
        p_payload: {
          vehicle_id: payload.vehicleId,
          driver_id: payload.driverId || null,
          remark: normalizeNullableText(payload.remark ?? ''),
          idempotency_key: payload.idempotencyKey,
          lines: payload.lines.map((line) => ({
            part_id: line.partId,
            issued_qty: line.issuedQty,
            issued_at: line.issuedAt,
            image_path: line.imagePath || null
          }))
        }
      }),
    { showMessage: true, breakReturn: true }
  )
}

export async function returnVehiclePartIssueLine(
  lineId: string,
  payload: {
    returnedQty: number
    returnedAt: string
    status: Exclude<VehiclePartIssueStatus, 'in_use'>
    remark?: string
    idempotencyKey: string
  }
) {
  return await responseHandle<string>(
    () =>
      supabase.rpc('vms_return_part_issue_line_secure', {
        p_line_id: lineId,
        p_payload: {
          returned_qty: payload.returnedQty,
          returned_at: payload.returnedAt,
          status: payload.status,
          remark: normalizeNullableText(payload.remark ?? ''),
          idempotency_key: payload.idempotencyKey
        }
      }),
    { showMessage: true, breakReturn: true }
  )
}
