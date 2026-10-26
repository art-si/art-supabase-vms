<template>
  <ArtSectionCard
    title="油耗与加油"
    subtitle="取自执行运单的出车、途中加油和回场记录；费用金额请查看费用流水"
    :loading="state.loading"
    :error="state.error"
    error-title="车辆油耗加载失败"
    :empty="!state.rows.length"
    empty-title="暂无执行油量记录"
    empty-description="完成运单并记录出回场油量、表数后，可在这里核对油耗。"
    :min-height="280"
    @retry="loadRows"
  >
    <p class="mb-4 text-xs leading-5 text-[var(--el-text-color-secondary)]">
      净耗油＝出车余油＋途中加油－回场余油；百公里油耗按单次执行里程计算。缺油量、未完成、
      里程非正或同车表数区间重叠的记录显示“待核算”，不计入油耗率。
    </p>
    <ArtTable :data="state.rows" :columns="columns" :pagination="false" />
    <div v-if="state.total > pageSize" class="mt-4 flex justify-end">
      <ElPagination
        v-model:current-page="state.page"
        background
        layout="prev, pager, next, total"
        :page-size="pageSize"
        :total="state.total"
        @current-change="loadRows"
      />
    </div>
  </ArtSectionCard>
</template>

<script setup lang="tsx">
  import type { ColumnOption } from '@/types'
  import { fetchVehicleFuelExecutions, type VehicleFuelExecution } from '@/api/mainline-operating'
  import BusinessRecordLink from '@/components/business/business-record-link/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import { formatNumberValue } from '@/utils/ui/format'

  defineOptions({ name: 'VehicleFuelExecutionPanel' })

  const props = defineProps<{ vehicleId: string }>()
  const { hasAuth } = useAuth()
  const pageSize = 20
  const state = reactive<{
    rows: VehicleFuelExecution[]
    total: number
    page: number
    loading: boolean
    error: string | null
  }>({ rows: [], total: 0, page: 1, loading: false, error: null })

  const formatVolume = (value: number | null): string =>
    value == null ? '--' : formatNumberValue(value, 'zh-CN', { maximumFractionDigits: 2 })
  const formatComputed = (value: number | null): string =>
    value == null ? '待核算' : formatVolume(value)

  const columns: ColumnOption<VehicleFuelExecution>[] = [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'waybillNo',
      label: '执行运单',
      minWidth: 170,
      formatter: (row) => (
        <BusinessRecordLink
          label={row.waybillNo}
          to={
            hasAuth('TmsLoadedWaybillList:View')
              ? `/tms/waybill-management/detail/${row.waybillId}`
              : undefined
          }
          compact
        />
      )
    },
    {
      prop: 'departureFuelLiters',
      label: '出车余油（升）',
      minWidth: 150,
      align: 'right',
      formatter: (row) => formatVolume(row.departureFuelLiters)
    },
    {
      prop: 'refueledLiters',
      label: '途中加油（升）',
      minWidth: 150,
      align: 'right',
      formatter: (row) => formatVolume(row.refueledLiters)
    },
    {
      prop: 'returnFuelLiters',
      label: '回场余油（升）',
      minWidth: 150,
      align: 'right',
      formatter: (row) => formatVolume(row.returnFuelLiters)
    },
    {
      prop: 'totalMileageKm',
      label: '核算里程（公里）',
      minWidth: 170,
      align: 'right',
      formatter: (row) => formatComputed(row.totalMileageKm)
    },
    {
      prop: 'consumedFuelLiters',
      label: '净耗油（升）',
      minWidth: 145,
      align: 'right',
      formatter: (row) => formatComputed(row.consumedFuelLiters)
    },
    {
      prop: 'fuelPer100km',
      label: '百公里油耗（升）',
      minWidth: 170,
      align: 'right',
      formatter: (row) => formatComputed(row.fuelPer100km)
    }
  ]

  let requestId = 0
  async function loadRows(): Promise<void> {
    const currentRequest = ++requestId
    state.loading = true
    state.error = null
    try {
      const from = (state.page - 1) * pageSize
      const result = await fetchVehicleFuelExecutions({
        vehicleId: props.vehicleId,
        from,
        to: from + pageSize - 1
      })
      if (currentRequest !== requestId) return
      state.rows = result.data
      state.total = result.total
    } catch {
      if (currentRequest !== requestId) return
      state.rows = []
      state.total = 0
      state.error = '暂时无法读取车辆油耗，请重试。'
    } finally {
      if (currentRequest === requestId) state.loading = false
    }
  }

  watch(
    () => props.vehicleId,
    () => {
      state.page = 1
      void loadRows()
    },
    { immediate: true }
  )
</script>
