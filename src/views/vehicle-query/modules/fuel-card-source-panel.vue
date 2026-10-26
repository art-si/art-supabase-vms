<template>
  <ArtSectionCard
    :title="kind === 'archive' ? '油卡档案' : '油卡流水'"
    :subtitle="
      kind === 'archive' ? '当前车辆绑定的油卡与余额' : '当前车辆油卡的期初、充值和消费记录'
    "
    :loading="loading"
    :error="error"
    :empty="!canView || records.length === 0"
    :empty-title="!canView ? '暂无查看权限' : kind === 'archive' ? '暂无绑定油卡' : '暂无油卡流水'"
    :empty-description="
      !canView
        ? '请联系管理员分配对应的油卡查看权限。'
        : kind === 'archive'
          ? '可在油卡档案中创建油卡并绑定这台已审批车辆。'
          : '油卡创建期初余额、充值或消费后，记录将在这里显示。'
    "
    :min-height="260"
    @retry="loadRecords"
  >
    <template #actions>
      <RouterLink
        v-if="canView"
        class="text-sm font-medium text-[var(--el-color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-color-primary)]"
        :to="
          kind === 'archive'
            ? '/vms/vehicle-manage/fuel-card-archive'
            : '/vms/vehicle-manage/fuel-card-ledger'
        "
        >查看完整台账</RouterLink
      >
    </template>
    <VehicleQueryTable :data="records" :columns="columns" />
    <div v-if="total > pageSize" class="mt-4 flex justify-end">
      <ElPagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="loadRecords"
      />
    </div>
  </ArtSectionCard>
</template>

<script setup lang="tsx">
  import type { ColumnOption } from '@/types'
  import { RouterLink } from 'vue-router'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import { formatCurrencyValue } from '@/utils/ui/format'
  import {
    fetchFuelCardList,
    fetchFuelCardLedgerList,
    type FuelCard,
    type FuelCardEntry
  } from '@/api/fuel-card'
  import VehicleQueryTable from './vehicle-query-table.vue'

  defineOptions({ name: 'VehicleFuelCardSourcePanel' })
  const props = defineProps<{ kind: 'archive' | 'ledger'; vehicleId: string }>()
  const { hasAuth } = useAuth()
  const canView = computed(() =>
    hasAuth(props.kind === 'archive' ? 'FuelCardArchive:View' : 'FuelCardLedger:View')
  )
  const page = ref(1)
  const pageSize = 20
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const records = ref<Array<FuelCard | FuelCardEntry>>([])
  let requestId = 0

  const columns = computed<ColumnOption[]>(() =>
    props.kind === 'archive'
      ? [
          { prop: 'cardNo', label: '油卡号', minWidth: 160 },
          { prop: 'plateNo', label: '绑定车牌', minWidth: 130 },
          {
            prop: 'issuer',
            label: '发卡机构',
            minWidth: 150,
            formatter: (row: FuelCard) => row.issuer || '--'
          },
          {
            prop: 'balance',
            label: '当前余额',
            width: 145,
            align: 'right',
            formatter: (row: FuelCard) => formatCurrencyValue(row.balance)
          },
          {
            prop: 'status',
            label: '状态',
            width: 110,
            formatter: (row: FuelCard) => (
              <ArtDictDisplay dict-code="fuelCardStatus" value={row.status} />
            )
          }
        ]
      : [
          { prop: 'cardNo', label: '油卡号', minWidth: 150 },
          {
            prop: 'entryType',
            label: '类型',
            width: 120,
            formatter: (row: FuelCardEntry) => (
              <ArtDictDisplay dict-code="fuelCardEntryType" value={row.entryType} />
            )
          },
          {
            prop: 'amount',
            label: '变动金额',
            width: 140,
            align: 'right',
            formatter: (row: FuelCardEntry) =>
              `${row.signedAmount < 0 ? '−' : '+'}${formatCurrencyValue(row.amount)}`
          },
          {
            prop: 'balanceAfter',
            label: '变动后余额',
            width: 150,
            align: 'right',
            formatter: (row: FuelCardEntry) => formatCurrencyValue(row.balanceAfter)
          },
          { prop: 'occurredOn', label: '发生日期', width: 130 },
          {
            prop: 'referenceNo',
            label: '业务凭证号',
            minWidth: 150,
            formatter: (row: FuelCardEntry) => row.referenceNo || '--'
          }
        ]
  )

  const loadRecords = async (): Promise<void> => {
    const currentRequest = ++requestId
    records.value = []
    total.value = 0
    error.value = null
    if (!canView.value || !props.vehicleId) {
      loading.value = false
      return
    }
    loading.value = true
    try {
      const response =
        props.kind === 'archive'
          ? await fetchFuelCardList({
              current: page.value,
              size: pageSize,
              vehicleId: props.vehicleId
            })
          : await fetchFuelCardLedgerList({
              current: page.value,
              size: pageSize,
              vehicleId: props.vehicleId
            })
      if (currentRequest !== requestId) return
      records.value = response.data
      total.value = response.total
    } catch {
      if (currentRequest !== requestId) return
      records.value = []
      total.value = 0
      error.value = '油卡记录加载失败，请重试。'
    } finally {
      if (currentRequest === requestId) loading.value = false
    }
  }

  watch(
    () => [props.kind, props.vehicleId, canView.value],
    () => {
      page.value = 1
      void loadRecords()
    },
    { immediate: true }
  )
</script>
