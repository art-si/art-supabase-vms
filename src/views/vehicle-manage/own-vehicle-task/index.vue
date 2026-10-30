<template>
  <div class="own-vehicle-task-page art-full-height min-w-0 gap-3">
    <BusinessWorkspaceHeader
      eyebrow="OWN FLEET OPERATIONS"
      title="自有车任务管理"
      description="一趟出车对应一张 TMS 主运单；登记费用与财务已审核费用分别展示，不重复相加。"
      icon="ri:truck-line"
      :tags="[{ label: 'TMS 主单归集', type: 'primary' }]"
      :metrics="workspaceMetrics"
    >
      <template #actions>
        <BusinessTableWorkspaceActions :table="tableQueryRef" />
        <ElButton
          v-if="hasAuth('OwnVehicleTask:OpenOrderList') && hasAuth('TmsOrderList:View')"
          @click="goToOrders"
        >
          进入运单列表
        </ElButton>
      </template>
    </BusinessWorkspaceHeader>

    <ArtTableQuery
      ref="tableQueryRef"
      v-model="table.searchQuery"
      :search-items="table.searchItems"
      :api-fn="fetchTableData"
      :columns-factory="table.columnsFactory"
      :search-bar-props="{ span: 6, labelWidth: 82 }"
      :table-props="{
        rowKey: 'id',
        tableLayout: 'fixed',
        emptyText: '暂无自有车运输任务',
        emptyDescription: '请核对车辆归属，或前往 TMS 运单列表为自有车辆安排任务。'
      }"
      :on-success="handleTableSuccess"
      focusable
    />
  </div>
</template>

<script setup lang="tsx">
  import { ElButton } from 'element-plus'
  import type { ComputedRef, UnwrapNestedRefs } from 'vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import { formatCurrencyValue } from '@/utils/ui/format'
  import { formatWithDayjs } from '@/utils/time'
  import { useAuth } from '@/hooks/core/useAuth'
  import {
    fetchOwnVehicleTasks,
    type OwnVehicleTaskRecord
  } from '@vms/api/modules/own-vehicle-task'

  defineOptions({ name: 'OwnVehicleTask' })

  type SearchParams = { keyword: string; plateNo: string; status: string }
  type TableParams = SearchParams & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  interface TableGroup {
    searchQuery: SearchParams
    searchItems: ComputedRef<SearchFormItem[]>
    columnsFactory: () => ColumnOption<OwnVehicleTaskRecord>[]
  }

  const router = useRouter()
  const { hasAuth } = useAuth()
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const overview = reactive<{ total: number; rows: OwnVehicleTaskRecord[]; canViewCosts: boolean }>(
    {
      total: 0,
      rows: [],
      canViewCosts: false
    }
  )

  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前任务',
      value: overview.total,
      description: '按自有车和当前筛选统计',
      icon: 'ri:truck-line'
    },
    {
      label: '本页返程任务',
      value: overview.rows.filter((row) => row.hasReturnLeg).length,
      description: '同一主单下的返程子单',
      icon: 'ri:arrow-go-back-line',
      tone: 'success'
    },
    {
      label: '本页行驶里程',
      value: `${overview.rows.reduce((sum, row) => sum + Number(row.distanceKm ?? 0) + Number(row.returnDistanceKm ?? 0), 0).toFixed(0)} km`,
      description: '已登记正向和返程里程',
      icon: 'ri:speed-up-line'
    }
  ])

  const table: UnwrapNestedRefs<TableGroup> = reactive<TableGroup>({
    searchQuery: { keyword: '', plateNo: '', status: '' },
    searchItems: computed<SearchFormItem[]>(() => [
      { label: '任务单号', key: 'keyword', type: 'input' },
      { label: '车牌号', key: 'plateNo', type: 'input' },
      {
        label: '任务状态',
        key: 'status',
        type: 'select',
        props: {
          options: [
            { label: '全部状态', value: '' },
            { label: '待接单', value: 'pending' },
            { label: '已接单', value: 'accepted' },
            { label: '运输中', value: 'transporting' },
            { label: '已签收', value: 'signed' },
            { label: '已完成', value: 'completed' }
          ]
        }
      }
    ]),
    columnsFactory: () => [
      { type: 'globalIndex', label: '序号', width: 64 },
      {
        prop: 'waybillNo',
        label: '主运输任务',
        minWidth: 190,
        formatter: (row: OwnVehicleTaskRecord) => (
          <div class="min-w-0">
            <strong class="block truncate text-sm">{row.waybillNo}</strong>
            <span class="text-xs text-g-500">
              {row.plateNo} · {row.driverName || '未指定司机'}
            </span>
          </div>
        )
      },
      {
        prop: 'originCity',
        label: '线路',
        minWidth: 190,
        formatter: (row: OwnVehicleTaskRecord) => (
          <span class="block truncate">
            {row.originCity} → {row.destinationCity}
          </span>
        )
      },
      {
        prop: 'plannedDepartureAt',
        label: '计划发车',
        minWidth: 158,
        formatter: (row: OwnVehicleTaskRecord) => formatWithDayjs(row.plannedDepartureAt) ?? '—'
      },
      {
        prop: 'actualDepartureAt',
        label: '实际发车',
        minWidth: 158,
        formatter: (row: OwnVehicleTaskRecord) => formatWithDayjs(row.actualDepartureAt) ?? '—'
      },
      {
        prop: 'actualArrivalAt',
        label: '实际到达',
        minWidth: 158,
        formatter: (row: OwnVehicleTaskRecord) => formatWithDayjs(row.actualArrivalAt) ?? '—'
      },
      {
        prop: 'distanceKm',
        label: '行驶里程',
        width: 112,
        align: 'right',
        formatter: (row: OwnVehicleTaskRecord) =>
          row.distanceKm == null && row.returnDistanceKm == null
            ? '—'
            : `${(Number(row.distanceKm ?? 0) + Number(row.returnDistanceKm ?? 0)).toFixed(1)} km`
      },
      ...(overview.canViewCosts
        ? [
            {
              prop: 'registeredTollFee',
              label: '路桥费',
              width: 150,
              align: 'right',
              formatter: (row: OwnVehicleTaskRecord) =>
                renderCostBreakdown(row.registeredTollFee, row.approvedTollFee)
            },
            {
              prop: 'registeredOtherFee',
              label: '其他费用',
              width: 150,
              align: 'right',
              formatter: (row: OwnVehicleTaskRecord) =>
                renderCostBreakdown(row.registeredOtherFee, row.approvedOtherFee)
            }
          ]
        : []),
      {
        prop: 'hasReturnLeg',
        label: '返程货',
        width: 92,
        formatter: (row: OwnVehicleTaskRecord) => (row.hasReturnLeg ? '已关联' : '—')
      },
      {
        prop: 'status',
        label: '状态',
        width: 98,
        formatter: (row: OwnVehicleTaskRecord) => statusLabel[row.status] ?? row.status
      },
      {
        prop: 'operation',
        label: '操作',
        width: 112,
        fixed: 'right',
        formatter: (row: OwnVehicleTaskRecord) =>
          hasAuth('OwnVehicleTask:OpenWaybill') && hasAuth('TmsLoadedWaybillList:View') ? (
            <ElButton link type="primary" onClick={() => goToWaybill(row.id)}>
              查看运单
            </ElButton>
          ) : null
      }
    ]
  })

  const statusLabel: Record<string, string> = {
    pending: '待接单',
    accepted: '已接单',
    transporting: '运输中',
    signed: '已签收',
    completed: '已完成',
    cancelled: '已取消'
  }

  const renderCostBreakdown = (registered: number | null, approved: number | null) => {
    const hasRegistered = Number(registered ?? 0) > 0
    const hasApproved = Number(approved ?? 0) > 0
    if (!hasRegistered && !hasApproved) return '—'
    return (
      <div class="flex flex-col items-end gap-0.5 leading-tight">
        {hasRegistered && (
          <span class="text-sm">
            {formatCurrencyValue(registered ?? 0)} <span class="text-xs text-g-500">任务登记</span>
          </span>
        )}
        {hasApproved && (
          <span class="text-sm">
            {formatCurrencyValue(approved ?? 0)} <span class="text-xs text-g-500">已审核</span>
          </span>
        )}
      </div>
    )
  }

  const fetchTableData = async (params: TableParams) => {
    const from = Math.max((params.current - 1) * params.size, 0)
    const result = await fetchOwnVehicleTasks({
      ...params,
      from,
      to: from + params.size - 1
    })
    overview.canViewCosts = result.canViewCosts
    return result
  }

  const handleTableSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (rows, response) => {
    overview.rows = rows as OwnVehicleTaskRecord[]
    overview.total = response.total ?? rows.length
  }

  const goToOrders = () => void router.push({ name: 'TmsOrderList' })
  const goToWaybill = (id: string) => void router.push({ name: 'TmsWaybillDetail', params: { id } })
</script>
