<template>
  <div class="business-workspace-page art-full-height min-w-0 gap-3">
    <BusinessWorkspaceHeader
      eyebrow="FUEL CARD LEDGER"
      title="油卡流水"
      description="逐笔记录期初、充值、消费与冲正；余额由系统计算并保留完整轨迹。"
      icon="ri:bill-line"
      :tags="[
        { label: '逐笔留痕', type: 'primary' },
        { label: '余额实时核算', type: 'info' }
      ]"
      :metrics="metrics"
    >
      <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
    </BusinessWorkspaceHeader>
    <ArtTableQuery
      ref="tableRef"
      v-model="search"
      :search-items="searchItems"
      :api-fn="fetchTableData"
      :columns-factory="columnsFactory"
      :header-actions="headerActions"
      header-actions-placement="workspace"
      :search-bar-props="{ span: 6, labelWidth: 86 }"
      :table-props="{
        rowKey: 'id',
        tableLayout: 'fixed',
        emptyText: '暂无油卡流水',
        emptyDescription: '可登记充值或消费，或调整油卡与日期后重新查询。'
      }"
      :on-success="handleSuccess"
      focusable
    />
    <FuelCardEntryDialog ref="entryDialogRef" @success="tableRef?.refreshCreate()" />
    <FuelCardReversalDialog ref="reversalDialogRef" @success="tableRef?.refreshUpdate()" />
  </div>
</template>

<script setup lang="tsx">
  import { ElButton } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryProps,
    ArtTableQueryExcelColumn
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { useAuth } from '@/hooks/core/useAuth'
  import { formatCurrencyValue } from '@/utils/ui/format'
  import { formatWithDayjs } from '@/utils/time'
  import {
    exportFuelCardLedgerList,
    fetchFuelCardLedgerList,
    fetchFuelCardList,
    type FuelCardEntry
  } from '@/api/fuel-card'
  import FuelCardEntryDialog from './modules/fuel-card-entry-dialog.vue'
  import FuelCardReversalDialog from './modules/fuel-card-reversal-dialog.vue'

  defineOptions({ name: 'VmsFuelCardLedger' })

  type EntryType = FuelCardEntry['entryType']
  interface Search {
    cardId?: string
    entryType?: EntryType
    occurredRange: string[]
  }
  interface TableParams extends Search {
    current: number
    size: number
  }

  const route = useRoute()
  const router = useRouter()
  const { hasAuth } = useAuth()
  const tableRef = ref<ArtTableQueryExpose>()
  const entryDialogRef = ref<{ handleOpen: (type: 'recharge' | 'consume') => Promise<void> }>()
  const reversalDialogRef = ref<{ handleOpen: (entry: FuelCardEntry) => Promise<void> }>()
  const overview = reactive({ total: 0, rows: [] as FuelCardEntry[] })
  const search = reactive<Search>({
    cardId: typeof route.query.cardId === 'string' ? route.query.cardId : undefined,
    entryType: undefined,
    occurredRange: []
  })
  const entryTypeOptions = useDictionaryOptions('fuelCardEntryType')
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '油卡',
      key: 'cardId',
      type: 'select',
      api: () => fetchFuelCardList({ current: 1, size: 200 }),
      resultField: 'data',
      labelField: 'cardNo',
      valueField: 'id',
      props: { filterable: true, clearable: true, placeholder: '选择油卡' }
    },
    {
      label: '流水类型',
      key: 'entryType',
      type: 'select',
      props: { options: entryTypeOptions, clearable: true }
    },
    {
      label: '发生日期',
      key: 'occurredRange',
      type: 'date',
      props: {
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        class: '!w-full'
      }
    }
  ])
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    { label: '流水笔数', value: overview.total, description: '当前筛选结果', icon: 'ri:bill-line' },
    {
      label: '本页充值',
      value: formatCurrencyValue(
        overview.rows
          .filter((row) => row.entryType === 'recharge')
          .reduce((sum, row) => sum + row.amount, 0)
      ),
      description: '不含期初余额',
      icon: 'ri:add-circle-line',
      tone: 'success'
    },
    {
      label: '本页消费',
      value: formatCurrencyValue(
        overview.rows
          .filter((row) => row.entryType === 'consume')
          .reduce((sum, row) => sum + row.amount, 0)
      ),
      description: '当前页消费合计',
      icon: 'ri:subtract-line',
      tone: 'warning'
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'cardNo', title: '油卡号', required: true },
    { key: 'plateNo', title: '绑定车牌' },
    { key: 'entryType', title: '流水类型' },
    { key: 'amount', title: '金额' },
    { key: 'balanceAfter', title: '变动后余额' },
    { key: 'occurredOn', title: '发生日期' },
    { key: 'referenceNo', title: '业务凭证号' },
    { key: 'remark', title: '备注' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      key: 'recharge',
      label: '登记充值',
      icon: 'ri:add-circle-line',
      permission: 'FuelCardLedger:Recharge',
      onClick: () => entryDialogRef.value?.handleOpen('recharge')
    },
    {
      key: 'consume',
      label: '登记消费',
      icon: 'ri:subtract-line',
      permission: 'FuelCardLedger:Consume',
      onClick: () => entryDialogRef.value?.handleOpen('consume')
    },
    {
      type: 'export',
      permission: 'FuelCardLedger:Export',
      exportFilename: '油卡流水',
      exportSheetName: '油卡流水',
      exportColumns: excelColumns,
      exportApi: ({ selectedIds, searchParams, maxRows }) =>
        exportFuelCardLedgerList({
          selectedIds: selectedIds.length ? selectedIds.map(String) : undefined,
          cardId: searchParams.cardId ? String(searchParams.cardId) : undefined,
          entryType: searchParams.entryType
            ? (String(searchParams.entryType) as EntryType)
            : undefined,
          occurredFrom: Array.isArray(searchParams.occurredRange)
            ? String(searchParams.occurredRange[0] || '')
            : undefined,
          occurredTo: Array.isArray(searchParams.occurredRange)
            ? String(searchParams.occurredRange[1] || '')
            : undefined,
          maxRows
        })
    }
  ])
  const columnsFactory = (): ColumnOption<FuelCardEntry>[] => [
    { type: 'selection', width: 48, fixed: 'left', reserveSelection: true },
    { type: 'globalIndex', label: '序号', width: 64 },
    { prop: 'cardNo', label: '油卡号', minWidth: 170, fixed: 'left' },
    {
      prop: 'plateNo',
      label: '绑定车牌',
      minWidth: 130,
      link: {
        permission: 'VehicleQuery:View',
        onClick: (row) => void router.push(`/vms/vehicle-query/detail/${row.vehicleId}`)
      }
    },
    {
      prop: 'entryType',
      label: '类型',
      width: 110,
      formatter: (row) => <ArtDictDisplay dict-code="fuelCardEntryType" value={row.entryType} />
    },
    {
      prop: 'amount',
      label: '变动金额',
      width: 145,
      align: 'right',
      formatter: (row) => (
        <span
          class={[
            'font-medium tabular-nums',
            row.signedAmount < 0
              ? 'text-[var(--el-color-warning)]'
              : 'text-[var(--el-color-success)]'
          ]}
        >
          {row.signedAmount < 0 ? '−' : '+'}
          {formatCurrencyValue(row.amount)}
        </span>
      )
    },
    {
      prop: 'balanceAfter',
      label: '变动后余额',
      width: 145,
      align: 'right',
      formatter: (row) => <span class="tabular-nums">{formatCurrencyValue(row.balanceAfter)}</span>
    },
    { prop: 'occurredOn', label: '发生日期', width: 125 },
    {
      prop: 'referenceNo',
      label: '业务凭证号',
      minWidth: 150,
      formatter: (row) => row.referenceNo || '--'
    },
    { prop: 'remark', label: '备注', minWidth: 180, formatter: (row) => row.remark || '--' },
    {
      prop: 'createTime',
      label: '记录时间',
      width: 170,
      formatter: (row) => formatWithDayjs(row.createTime) || '--'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 96,
      fixed: 'right',
      formatter: (row) =>
        hasAuth('FuelCardLedger:Reverse') && row.entryType !== 'reversal' && !row.isReversed ? (
          <ElButton
            link
            type="warning"
            onClick={() => void reversalDialogRef.value?.handleOpen(row)}
          >
            冲正
          </ElButton>
        ) : (
          '--'
        )
    }
  ]
  const fetchTableData = (params: TableParams) =>
    fetchFuelCardLedgerList({
      current: params.current,
      size: params.size,
      cardId: params.cardId,
      entryType: params.entryType,
      occurredFrom: params.occurredRange?.[0],
      occurredTo: params.occurredRange?.[1]
    })
  const handleSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (rows, response) => {
    overview.rows = rows as FuelCardEntry[]
    overview.total = response.total ?? rows.length
  }
</script>
