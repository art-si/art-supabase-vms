<template>
  <div class="business-workspace-page art-full-height min-w-0 gap-3">
    <BusinessWorkspaceHeader
      eyebrow="FUEL CARD ARCHIVE"
      title="油卡档案"
      description="按车辆管理油卡绑定、使用状态和当前余额；每笔资金变化可追溯到流水。"
      icon="ri:bank-card-line"
      :tags="[
        { label: '已审批车辆绑定', type: 'primary' },
        { label: '余额由流水计算', type: 'info' }
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
      :search-bar-props="{ span: 6, labelWidth: 80 }"
      :table-props="{
        rowKey: 'id',
        tableLayout: 'fixed',
        emptyText: '暂无油卡档案',
        emptyDescription: '可创建油卡并绑定已审批车辆，或调整筛选条件后重新查询。'
      }"
      :on-success="handleSuccess"
      focusable
    />
    <FuelCardDialog ref="dialogRef" @success="tableRef?.refreshCreate()" />
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
  import { notifyFriendlyError, useArtFeedback } from '@/hooks/core/useArtFeedback'
  import { formatCurrencyValue } from '@/utils/ui/format'
  import { formatWithDayjs } from '@/utils/time'
  import {
    exportFuelCardList,
    fetchFuelCardList,
    setFuelCardStatus,
    type FuelCard,
    type FuelCardStatus
  } from '@/api/fuel-card'
  import FuelCardDialog from './modules/fuel-card-dialog.vue'

  defineOptions({ name: 'VmsFuelCardArchive' })

  const { hasAuth } = useAuth()
  const { confirmAction } = useArtFeedback()
  const route = useRoute()
  const router = useRouter()
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<{ handleOpen: () => Promise<void> }>()
  const overview = reactive({ total: 0, rows: [] as FuelCard[] })
  const search = reactive<{ keyword: string; status?: FuelCardStatus }>({
    keyword: typeof route.query.recordNo === 'string' ? route.query.recordNo : '',
    status: undefined
  })
  const linkedCardId = ref(
    typeof route.query.recordId === 'string' ? route.query.recordId : undefined
  )
  const statusOptions = useDictionaryOptions('fuelCardStatus')
  watch(
    () => [search.keyword, search.status],
    () => {
      linkedCardId.value = undefined
    }
  )
  watch(
    () => [route.query.recordNo, route.query.recordId],
    ([recordNo, recordId]) => {
      search.keyword = typeof recordNo === 'string' ? recordNo : ''
      void nextTick(() => {
        linkedCardId.value = typeof recordId === 'string' ? recordId : undefined
        return tableRef.value?.refreshData()
      })
    }
  )
  const fetchTableData = (params: Parameters<typeof fetchFuelCardList>[0]) =>
    fetchFuelCardList({ ...params, cardId: linkedCardId.value })
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '油卡/车牌',
      key: 'keyword',
      type: 'input',
      props: { placeholder: '输入油卡号或车牌号' }
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: { options: statusOptions, clearable: true }
    }
  ])
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '油卡总数',
      value: overview.total,
      description: '当前筛选结果',
      icon: 'ri:bank-card-line'
    },
    {
      label: '本页在用',
      value: overview.rows.filter((row) => row.status === 'active').length,
      description: '当前页可登记充值和消费',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: '本页余额',
      value: formatCurrencyValue(
        overview.rows.reduce((sum, row) => sum + Number(row.balance || 0), 0)
      ),
      description: '仅汇总当前页',
      icon: 'ri:money-cny-circle-line'
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'cardNo', title: '油卡号', required: true },
    { key: 'plateNo', title: '绑定车牌' },
    { key: 'issuer', title: '发卡机构' },
    { key: 'status', title: '状态' },
    { key: 'balance', title: '当前余额' },
    { key: 'createTime', title: '创建时间' }
  ]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      type: 'add',
      label: '新增油卡',
      permission: 'FuelCardArchive:Add',
      onClick: () => dialogRef.value?.handleOpen()
    },
    {
      type: 'export',
      permission: 'FuelCardArchive:Export',
      exportFilename: '油卡档案',
      exportSheetName: '油卡档案',
      exportColumns: excelColumns,
      exportApi: ({ selectedIds, searchParams, maxRows }) =>
        exportFuelCardList({
          selectedIds: selectedIds.length ? selectedIds.map(String) : undefined,
          keyword: String(searchParams.keyword || ''),
          status: searchParams.status as FuelCardStatus | undefined,
          cardId: linkedCardId.value,
          maxRows
        })
    }
  ])
  const columnsFactory = (): ColumnOption<FuelCard>[] => [
    { type: 'selection', width: 48, fixed: 'left', reserveSelection: true },
    { type: 'globalIndex', label: '序号', width: 64 },
    {
      prop: 'cardNo',
      label: '油卡号',
      minWidth: 180,
      fixed: 'left',
      link: {
        permission: 'FuelCardLedger:View',
        onClick: (row) => void router.push(`/vms/vehicle-manage/fuel-card-ledger?cardId=${row.id}`)
      }
    },
    {
      prop: 'plateNo',
      label: '绑定车牌',
      minWidth: 140,
      link: {
        permission: 'VehicleQuery:View',
        onClick: (row) => void router.push(`/vms/vehicle-query/detail/${row.vehicleId}`)
      }
    },
    { prop: 'issuer', label: '发卡机构', minWidth: 170, formatter: (row) => row.issuer || '--' },
    {
      prop: 'balance',
      label: '当前余额',
      width: 150,
      align: 'right',
      formatter: (row) => (
        <span class="font-medium tabular-nums">{formatCurrencyValue(row.balance)}</span>
      )
    },
    {
      prop: 'status',
      label: '状态',
      width: 112,
      formatter: (row) => <ArtDictDisplay dict-code="fuelCardStatus" value={row.status} />
    },
    {
      prop: 'createTime',
      label: '创建时间',
      width: 170,
      formatter: (row) => formatWithDayjs(row.createTime) || '--'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 128,
      fixed: 'right',
      formatter: (row) =>
        hasAuth('FuelCardArchive:Edit') ? (
          <ElButton
            link
            type={row.status === 'active' ? 'warning' : 'primary'}
            onClick={() => void toggleStatus(row)}
          >
            {row.status === 'active' ? '停用' : '启用'}
          </ElButton>
        ) : (
          '--'
        )
    }
  ]
  const handleSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (rows, response) => {
    overview.rows = rows as FuelCard[]
    overview.total = response.total ?? rows.length
  }
  const toggleStatus = async (card: FuelCard): Promise<void> => {
    const next = card.status === 'active' ? 'disabled' : 'active'
    try {
      await confirmAction(
        next === 'disabled'
          ? `停用油卡“${card.cardNo}”后将不能登记新的充值与消费，确定继续吗？`
          : `确定启用油卡“${card.cardNo}”吗？`,
        next === 'disabled' ? '停用油卡' : '启用油卡',
        {
          confirmButtonText: next === 'disabled' ? '确认停用' : '确认启用',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } catch {
      return
    }
    try {
      await setFuelCardStatus(card.id, next)
      await tableRef.value?.refreshUpdate()
    } catch (error) {
      notifyFriendlyError(error, '油卡状态更新失败，请刷新后重试')
    }
  }
</script>
