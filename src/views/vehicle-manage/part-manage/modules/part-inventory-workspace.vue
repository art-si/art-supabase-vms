<template>
  <div class="part-inventory-workspace business-workspace-page min-h-0 min-w-0">
    <BusinessWorkspaceHeader
      eyebrow="PARTS INVENTORY"
      title="配件库存台账"
      description="入库、车辆领用和归还逐笔留痕；当前库存由台账自动结算。"
      icon="ri:archive-stack-line"
      density="compact"
      :tags="[
        { label: '实物库存', type: 'primary' },
        { label: '领用自动出库', type: 'info' }
      ]"
      :metrics="metrics"
    >
      <template #actions>
        <ElButton
          v-if="activeTab === 'stock' && hasAuth('VmsPartInventory:Receipt')"
          type="primary"
          @click="openReceipt"
        >
          <span class="art-icon-label"><ArtSvgIcon icon="ri:add-line" />登记入库</span>
        </ElButton>
        <BusinessTableWorkspaceActions v-else-if="activeTab === 'movements'" :table="tableRef" />
      </template>
    </BusinessWorkspaceHeader>

    <div class="part-inventory-workspace__content flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <div class="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
        <ElTabs
          v-model="activeTab"
          class="part-inventory-workspace__tabs w-full min-w-0 flex-none sm:w-auto sm:flex-1"
          aria-label="配件库存台账视图"
        >
          <ElTabPane label="当前库存" name="stock" />
          <ElTabPane label="配件流水" name="movements" />
        </ElTabs>
      </div>

      <ArtSectionCard
        v-if="activeTab === 'stock'"
        class="part-inventory-workspace__stock min-h-0 flex-1"
        aria-label="当前库存明细"
        :loading="stock.loading"
        :error="stock.error"
        :empty="!stock.loading && !stock.error && stock.rows.length === 0"
        empty-title="暂无库存记录"
        empty-description="先登记配件入库，之后可在“领用归还”中按车领用。"
        :scroll-max-height="440"
        @retry="loadStock"
      >
        <ArtTable
          :data="stock.rows"
          :columns="stockColumns"
          :pagination="false"
          table-layout="fixed"
          size="default"
          row-key="id"
        />
      </ArtSectionCard>

      <ArtTableQuery
        v-else
        ref="tableRef"
        v-model="search"
        :search-items="searchItems"
        :api-fn="fetchMovements"
        :columns-factory="columnsFactory"
        :search-bar-props="{ span: 6, labelWidth: 90 }"
        :table-props="{
          rowKey: 'id',
          tableLayout: 'fixed',
          emptyText: '暂无库存变动',
          emptyDescription: '登记入库或领用配件后，出入库流水会显示在这里。'
        }"
        focus-scope-selector=".part-inventory-workspace__content"
        focusable
      />
    </div>
    <PartStockReceiptDialog ref="receiptRef" @success="refresh" />
  </div>
</template>

<script setup lang="tsx">
  import { ElButton } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type { ArtTableQueryExpose } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { formatWithDayjs } from '@/utils/time'
  import { useAuth } from '@/hooks/core/useAuth'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import {
    fetchVehiclePartStock,
    fetchVehiclePartStockMovements,
    type VehiclePartStock,
    type VehiclePartStockMovement
  } from '@vms/api'
  import PartStockReceiptDialog from './part-stock-receipt-dialog.vue'

  defineOptions({ name: 'VmsPartInventoryWorkspace' })
  const props = defineProps<{ initialPartId?: string }>()

  const { hasAuth } = useAuth()
  const activeTab = ref<'stock' | 'movements'>(props.initialPartId ? 'movements' : 'stock')
  const tableRef = ref<ArtTableQueryExpose>()
  const receiptRef = ref<{ handleOpen: () => Promise<void> }>()
  const stock = reactive<{ rows: VehiclePartStock[]; loading: boolean; error: string | null }>({
    rows: [],
    loading: false,
    error: null
  })
  const search = reactive<{ partId?: string }>({ partId: props.initialPartId })
  watch(
    () => props.initialPartId,
    (partId) => {
      search.partId = partId
      if (partId) activeTab.value = 'movements'
      void nextTick(() => tableRef.value?.refreshData())
    }
  )
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '物料种类',
      value: stock.rows.length,
      description: '有库存台账的配件',
      icon: 'ri:tools-line'
    },
    {
      label: '库存为零',
      value: stock.rows.filter((row) => row.stockQty === 0).length,
      description: '无法直接发起领用的配件',
      icon: 'ri:archive-stack-line',
      tone: 'primary'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '配件',
      key: 'partId',
      type: 'select',
      props: {
        clearable: true,
        filterable: true,
        options: stock.rows.map((row) => ({
          label: `${row.partName} · ${row.partCode}`,
          value: row.partId
        }))
      }
    }
  ])
  const stockColumns: ColumnOption<VehiclePartStock>[] = [
    {
      prop: 'partName',
      label: '配件 / 编码',
      minWidth: 240,
      formatter: (row) => (
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-[var(--el-border-radius-base)] bg-[var(--el-color-primary-light-9)] text-[var(--theme-color)]"
            aria-hidden="true"
          >
            <ArtSvgIcon icon="ri:tools-line" />
          </span>
          <div class="min-w-0">
            <p
              class="truncate font-medium text-[var(--el-text-color-primary)]"
              title={row.partName}
            >
              {row.partName}
            </p>
            <p class="truncate text-xs text-[var(--el-text-color-secondary)]" title={row.partCode}>
              {row.partCode}
            </p>
          </div>
        </div>
      )
    },
    {
      prop: 'categoryName',
      label: '配件分类',
      minWidth: 110,
      formatter: (row) => row.categoryName || '--'
    },
    { prop: 'model', label: '规格型号', minWidth: 120, showOverflowTooltip: true },
    { prop: 'brand', label: '品牌', minWidth: 110, showOverflowTooltip: true },
    {
      prop: 'stockQty',
      label: '库存数量',
      width: 130,
      align: 'right',
      formatter: (row) => (
        <strong class="tabular-nums">
          {row.stockQty} {row.unit || ''}
        </strong>
      )
    },
    {
      prop: 'updatedAt',
      label: '最近变动',
      width: 178,
      formatter: (row) => formatWithDayjs(row.updatedAt) || '--'
    }
  ]
  const loadStock = async (): Promise<void> => {
    stock.loading = true
    stock.error = null
    try {
      const result = await fetchVehiclePartStock()
      if (result.error) throw result.error
      stock.rows = result.data
    } catch {
      stock.error = '库存加载失败，请重试'
    } finally {
      stock.loading = false
    }
  }
  const fetchMovements = async (params: { current: number; size: number; partId?: string }) => {
    const { from, to } = buildSupabasePageRange(params)
    return await fetchVehiclePartStockMovements({ from, to, partId: params.partId })
  }
  const movementTypeOptions = useDictionaryOptions('vehiclePartStockMovementType')
  const movementLabel = (type: VehiclePartStockMovement['movementType']): string =>
    movementTypeOptions.find((item) => item.value === type)?.label || type
  const columnsFactory = (): ColumnOption<VehiclePartStockMovement>[] => [
    { type: 'globalIndex', label: '序号', width: 70 },
    {
      prop: 'postingSeq',
      label: '记账序号',
      width: 96,
      align: 'right',
      formatter: (row) => <span class="tabular-nums">#{row.postingSeq}</span>
    },
    {
      prop: 'partName',
      label: '配件 / 编码',
      minWidth: 220,
      formatter: (row) => (
        <div class="min-w-0">
          <div class="truncate font-medium" title={row.partName}>
            {row.partName}
          </div>
          <div class="truncate text-xs text-[var(--el-text-color-secondary)]" title={row.partCode}>
            {row.partCode}
          </div>
        </div>
      )
    },
    {
      prop: 'movementType',
      label: '变动类型',
      width: 118,
      formatter: (row) => movementLabel(row.movementType)
    },
    {
      prop: 'stockDelta',
      label: '库存变动',
      width: 118,
      align: 'right',
      formatter: (row) => (
        <span class="tabular-nums">
          {row.stockDelta > 0 ? '+' : ''}
          {row.stockDelta}
        </span>
      )
    },
    {
      prop: 'balanceAfter',
      label: '变动后库存',
      width: 128,
      align: 'right',
      formatter: (row) => <strong class="tabular-nums">{row.balanceAfter}</strong>
    },
    {
      prop: 'referenceNo',
      label: '关联单号',
      minWidth: 170,
      formatter: (row) => row.referenceNo || '--'
    },
    { prop: 'plateNo', label: '领用车牌', minWidth: 120, formatter: (row) => row.plateNo || '--' },
    {
      prop: 'vehicleOwnership',
      label: '车辆归属',
      minWidth: 110,
      dict: { code: 'vehicleOwnership', display: 'auto' }
    },
    {
      prop: 'isNewEnergy',
      label: '是否新能源车',
      width: 120,
      formatter: (row) => (row.isNewEnergy == null ? '--' : row.isNewEnergy ? '是' : '否')
    },
    {
      prop: 'driverName',
      label: '领用司机(电话)',
      minWidth: 170,
      formatter: (row) => [row.driverName, row.driverPhone].filter(Boolean).join(' · ') || '--'
    },
    { prop: 'carrierName', label: '所属承运商', minWidth: 160, showOverflowTooltip: true },
    { prop: 'companyName', label: '所属公司', minWidth: 160, showOverflowTooltip: true },
    {
      prop: 'occurredAt',
      label: '发生时间',
      width: 176,
      formatter: (row) => formatWithDayjs(row.occurredAt) || '--'
    }
  ]
  const openReceipt = (): void => {
    void receiptRef.value?.handleOpen()
  }
  const refresh = (): void => {
    void Promise.all([loadStock(), tableRef.value?.refreshData()])
  }
  onMounted(() => {
    void loadStock()
  })
</script>

<style scoped lang="scss">
  .part-inventory-workspace {
    &__tabs {
      :deep(.el-tabs__header) {
        margin: 0;
      }

      :deep(.el-tabs__item) {
        font-size: var(--el-font-size-base);
        font-weight: 500;
      }
    }

    :deep(.el-table th.el-table__cell) {
      height: 44px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }
  }
</style>
