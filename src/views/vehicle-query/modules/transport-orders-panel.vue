<template>
  <ArtSectionCard
    title="运输订单"
    subtitle="按运输执行记录查看这辆车承运的订单与司机"
    :loading="state.loading"
    :error="state.error"
    error-title="运输订单加载失败"
    :empty="!state.rows.length"
    empty-title="暂无运输订单"
    empty-description="当前车辆尚无可查看的运输执行记录。"
    :min-height="280"
    @retry="loadRows"
  >
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
  import { RouterLink } from 'vue-router'
  import type { ColumnOption } from '@/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import {
    fetchTransportMainlineRelations,
    type TransportMainlineRelation
  } from '@/api/transport-mainline'
  import { formatWithDayjs } from '@/utils/time'
  import { useAuth } from '@/hooks/core/useAuth'

  defineOptions({ name: 'VehicleTransportOrdersPanel' })

  const props = defineProps<{ vehicleId: string }>()
  const { hasAuth } = useAuth()
  const pageSize = 20
  const state = reactive<{
    rows: TransportMainlineRelation[]
    total: number
    page: number
    loading: boolean
    error: string | null
  }>({ rows: [], total: 0, page: 1, loading: false, error: null })

  const canViewOrder = computed(() => hasAuth('TmsOrderQuery:View'))
  const canViewDriver = computed(() => hasAuth('TmsDriverQuery:View'))

  const columns = computed<ColumnOption<TransportMainlineRelation>[]>(() => [
    { type: 'globalIndex', label: '序号', width: 68 },
    {
      prop: 'orderNo',
      label: '运输订单',
      minWidth: 180,
      formatter: (row) =>
        canViewOrder.value && row.orderId ? (
          <RouterLink
            class="text-[var(--el-color-primary)] hover:underline focus-visible:outline-2"
            to={`/tms/order-query/detail/${row.orderId}`}
          >
            {row.orderNo}
          </RouterLink>
        ) : (
          row.orderNo || '--'
        )
    },
    {
      prop: 'waybillNo',
      label: '执行运单',
      minWidth: 150,
      formatter: (row) => row.waybillNo || '--'
    },
    {
      prop: 'driverName',
      label: '承运司机',
      minWidth: 140,
      formatter: (row) =>
        canViewDriver.value && row.driverId ? (
          <RouterLink
            class="text-[var(--el-color-primary)] hover:underline focus-visible:outline-2"
            to={`/tms/driver-query/detail/${row.driverId}`}
          >
            {row.driverName || '查看司机'}
          </RouterLink>
        ) : (
          row.driverName || '--'
        )
    },
    {
      prop: 'waybillStatus',
      label: '运单状态',
      width: 116,
      formatter: (row) => (
        <ArtDictDisplay dictCode="tmsWaybillStatus" value={row.waybillStatus} display="tag" />
      )
    },
    {
      prop: 'departedAt',
      label: '发车时间',
      minWidth: 165,
      formatter: (row) => (row.departedAt ? formatWithDayjs(row.departedAt) : '--')
    },
    {
      prop: 'completedAt',
      label: '完成时间',
      minWidth: 165,
      formatter: (row) => (row.completedAt ? formatWithDayjs(row.completedAt) : '--')
    }
  ])

  let requestId = 0
  const loadRows = async (): Promise<void> => {
    const currentRequest = ++requestId
    state.loading = true
    state.error = null
    const from = (state.page - 1) * pageSize
    try {
      const result = await fetchTransportMainlineRelations({
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
      state.error = '暂时无法读取运输订单，请重试。'
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
