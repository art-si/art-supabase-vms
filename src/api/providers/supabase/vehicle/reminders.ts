import { useSupabase } from '@/hooks/core/useSupabase'
import {
  normalizeBooleanFilter,
  withRequestOptions,
  type SupabaseQueryLike
} from '@/api/providers/supabase/query'
import type { ApiRequestOptions } from '@/types/api/request'
import { applyFilters, type FilterSpec } from '@/utils/supabase'
import type { VehicleReminderRow, VehicleReminderSearchParams } from './types'

type ReminderKind = Api.Vms.ReminderManage.ReminderKind
type ReminderWorkOrder = Api.Vms.ReminderManage.VehicleReminderWorkOrder
type ReminderCreatePayload = Api.Vms.ReminderManage.VehicleReminderWorkOrderCreatePayload
type ReminderTransitionPayload = Api.Vms.ReminderManage.VehicleReminderWorkOrderTransitionPayload

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()

export const VEHICLE_REMINDER_VIEWS = [
  'vehicle_reminder_insurance_expiry',
  'vehicle_reminder_inspection_expiry',
  'vehicle_reminder_maintenance_expiry',
  'vehicle_reminder_part_service_life',
  'vehicle_reminder_vehicle_service_life'
] as const

export type VehicleReminderViewName = (typeof VEHICLE_REMINDER_VIEWS)[number]

type ReminderRiskOverview = Api.Vms.ReminderManage.VehicleReminderRiskOverview

const getVehicleReminderSearchFilters = (
  params: VehicleReminderSearchParams,
  mode: 'days' | 'expired'
): FilterSpec[] => [
  { col: 'id', op: 'eq', val: params.sourceKey },
  {
    col: 'companyName',
    op: 'ilike',
    val: params.companyName ? `%${params.companyName}%` : undefined
  },
  { col: 'plateNo', op: 'ilike', val: params.plateNo ? `%${params.plateNo}%` : undefined },
  {
    col: 'expired',
    op: 'eq',
    val:
      !params.sourceKey && (!params.riskBand || params.riskBand === 'all') && mode === 'expired'
        ? normalizeBooleanFilter(params.expired)
        : undefined
  }
]

const applyReminderRiskBand = <TQuery extends SupabaseQueryLike>(
  query: TQuery,
  riskBand?: VehicleReminderSearchParams['riskBand']
): TQuery => {
  if (riskBand === 'overdue') return query.eq('expired', true)
  if (riskBand === 'due_7') {
    return query.eq('expired', false).gte('remaining_days', 0).lte('remaining_days', 7)
  }
  if (riskBand === 'due_30') {
    return query.eq('expired', false).gt('remaining_days', 7).lte('remaining_days', 30)
  }
  return query
}

const fetchReminderCount = async (
  viewName: VehicleReminderViewName,
  params: VehicleReminderSearchParams,
  configure?: (query: SupabaseQueryLike) => SupabaseQueryLike,
  options?: ApiRequestOptions
): Promise<number> => {
  let builder = supabase.from(viewName).select('id', { count: 'exact', head: true })
  if (params.companyName) builder = builder.ilike('company_name', `%${params.companyName}%`)
  if (params.plateNo) builder = builder.ilike('plate_no', `%${params.plateNo}%`)

  // The dynamic view-name union exceeds TypeScript's instantiation depth when assigned
  // directly to the shared query contract. Keep this single documented compatibility cast.
  let query = builder as unknown as SupabaseQueryLike

  if (configure) query = configure(query)

  const result = await responseHandle<never[]>(() => withRequestOptions(query, options), {
    breakReturn: true,
    showErrorMessage: false,
    errorMessage: '风险概览加载失败，请稍后重试'
  })
  return result.total ?? 0
}

export async function fetchVehicleReminderViewRiskOverview(
  viewName: VehicleReminderViewName,
  params: VehicleReminderSearchParams,
  options?: ApiRequestOptions
) {
  const [total, overdue, dueWithin7Days, dueWithin30Days] = await Promise.all([
    fetchReminderCount(viewName, params, undefined, options),
    fetchReminderCount(viewName, params, (query) => query.eq('expired', true), options),
    fetchReminderCount(
      viewName,
      params,
      (query) => query.eq('expired', false).gte('remaining_days', 0).lte('remaining_days', 7),
      options
    ),
    fetchReminderCount(
      viewName,
      params,
      (query) => query.eq('expired', false).gt('remaining_days', 7).lte('remaining_days', 30),
      options
    )
  ])
  const overview: ReminderRiskOverview = {
    total,
    overdue,
    dueWithin7Days,
    dueWithin30Days,
    stable: Math.max(total - overdue - dueWithin7Days - dueWithin30Days, 0)
  }
  return { data: overview, error: null }
}

export async function fetchVehicleReminderViewList(
  viewName: VehicleReminderViewName,
  sourceType: ReminderKind,
  params: VehicleReminderSearchParams,
  mode: 'days' | 'expired',
  options?: ApiRequestOptions
) {
  const { from = 0, to = 9 } = params
  let query = supabase
    .from(viewName)
    .select('*', { count: 'exact' })
    .order('remaining_days', { ascending: true })
    .range(from, to)

  if (
    !params.sourceKey &&
    (!params.riskBand || params.riskBand === 'all') &&
    mode === 'days' &&
    params.reminderDays !== null &&
    params.reminderDays !== undefined
  ) {
    query = query.lte('remaining_days', Number(params.reminderDays))
  }

  query = applyFilters(query, getVehicleReminderSearchFilters(params, mode), {
    skipEmpty: true,
    camelToSnake: true
  })
  const filteredQuery = applyReminderRiskBand(query, params.sourceKey ? undefined : params.riskBand)

  const result = await responseHandle<VehicleReminderRow[]>(() =>
    withRequestOptions(filteredQuery, options)
  )

  const rows = (result.data ?? []).map((row) => ({
    ...row,
    sourceVersion: getReminderSourceVersion(row)
  }))
  if (!rows.length) return { ...result, data: rows }

  const { data: workOrders } = await responseHandle<ReminderWorkOrder[]>(
    () => {
      let workOrderQuery = supabase
        .from('vehicle_reminder_work_order')
        .select('*')
        .eq('source_type', sourceType)
      workOrderQuery = params.workOrderId
        ? workOrderQuery.eq('id', params.workOrderId)
        : workOrderQuery.in(
            'source_key',
            rows.map((row) => row.id)
          )
      return withRequestOptions(workOrderQuery.order('update_time', { ascending: false }), options)
    },
    { showErrorMessage: true }
  )
  const workOrderMap = new Map(
    (workOrders ?? []).map((workOrder) => [
      `${workOrder.sourceKey}:${workOrder.sourceVersion}`,
      workOrder
    ])
  )
  const targetWorkOrder = params.workOrderId ? workOrders?.[0] : undefined

  return {
    ...result,
    data: rows.map((row) => {
      const workOrder =
        (targetWorkOrder?.sourceKey === row.id ? targetWorkOrder : undefined) ??
        workOrderMap.get(`${row.id}:${row.sourceVersion}`) ??
        null
      return { ...row, workOrder, workOrderStatus: workOrder?.status ?? null }
    })
  }
}

export async function createVehicleReminderWorkOrder(params: ReminderCreatePayload) {
  return await responseHandle<ReminderWorkOrder>(
    () =>
      supabase.rpc('get_or_create_vehicle_reminder_work_order', {
        p_reminder: keysToSnakeDeep(params)
      }),
    { breakReturn: true }
  )
}

export async function transitionVehicleReminderWorkOrder(params: ReminderTransitionPayload) {
  return await responseHandle<ReminderWorkOrder>(
    () =>
      supabase.rpc('transition_vehicle_reminder_work_order', {
        p_work_order_id: params.workOrderId,
        p_next_status: params.nextStatus,
        p_resolution: params.resolution || null
      }),
    { breakReturn: true }
  )
}

function getReminderSourceVersion(row: VehicleReminderRow): string {
  return (
    row.expireDate ||
    row.nextMaintenanceDate ||
    [row.startUseDate, row.serviceYears].filter(Boolean).join(':') ||
    [row.currentMileage, row.nextMaintenanceMileage]
      .filter((value) => value !== undefined)
      .join(':') ||
    'current'
  )
}
