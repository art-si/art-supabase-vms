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
    >
      <template #table-header-top>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <ElSegmented
            :model-value="search.entryType || 'all'"
            :options="ledgerViewOptions"
            aria-label="油卡流水类型视图"
            @update:model-value="handleLedgerViewChange"
          />
          <span class="text-xs text-[var(--el-text-color-secondary)]">
            充值与消费按原流水核算；冲正及期初记录在全部流水中保留。
          </span>
        </div>
      </template>
    </ArtTableQuery>
    <FuelCardEntryDialog ref="entryDialogRef" @success="tableRef?.refreshCreate()" />
    <FuelCardReversalDialog ref="reversalDialogRef" @success="tableRef?.refreshUpdate()" />
    <CardEntryVoucherDialog
      ref="voucherDialogRef"
      kind="fuel"
      @success="tableRef?.refreshUpdate()"
    />
    <FuelStatementDrawer ref="statementDrawerRef" />
    <ArtDrawer ref="detailRef" size="md" :show-footer="false">
      <div v-if="selectedEntry" class="space-y-4">
        <div class="rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-light)] p-5">
          <div class="flex items-start justify-between gap-3">
            <div
              ><span class="text-xs text-[var(--el-text-color-secondary)]">油卡 / 车辆</span
              ><h3 class="mt-1 break-all text-lg font-semibold"
                >{{ selectedEntry.cardNo }} · {{ selectedEntry.plateNo }}</h3
              ></div
            >
            <ArtDictDisplay dict-code="fuelCardEntryType" :value="selectedEntry.entryType" />
          </div>
          <div class="mt-4 border-t border-[var(--el-border-color)] pt-3"
            ><span class="text-xs text-[var(--el-text-color-secondary)]">变动金额 / 变动后余额</span
            ><strong class="mt-1 block text-xl tabular-nums"
              >{{ selectedEntry.signedAmount < 0 ? '−' : '+'
              }}{{ formatCurrencyValue(selectedEntry.amount) }} ·
              {{ formatCurrencyValue(selectedEntry.balanceAfter) }}</strong
            ></div
          >
        </div>
        <dl
          class="grid gap-4 rounded-[var(--el-border-radius-base)] border border-[var(--el-border-color-light)] p-5 sm:grid-cols-2"
        >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">油卡状态</dt
            ><dd class="mt-1"
              ><ArtDictDisplay dict-code="fuelCardStatus" :value="selectedEntry.cardStatus" /></dd
          ></div>
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">流水时间</dt
            ><dd class="mt-1 font-medium">{{
              selectedEntry.occurredAt
                ? formatWithDayjs(selectedEntry.occurredAt)
                : selectedEntry.occurredOn
            }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">关联运单</dt
            ><dd class="mt-1 font-medium">{{ selectedEntry.waybillNo || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">燃油费用单</dt
            ><dd class="mt-1 font-medium"
              >{{ selectedEntry.sourceCostNo || '--' }}
              <ElButton
                v-if="selectedEntry.sourceCostId && hasAuth('FinanceWaybillCost:View')"
                link
                type="primary"
                @click="openSourceCost(selectedEntry)"
                >查看费用单</ElButton
              ></dd
            ></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">所属公司</dt
            ><dd class="mt-1 font-medium">{{ selectedEntry.companyName || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">本笔司机</dt
            ><dd class="mt-1 font-medium">{{ selectedEntry.driverName || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">加油站</dt
            ><dd class="mt-1 font-medium">{{ selectedEntry.stationName || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">发生地点</dt
            ><dd class="mt-1 font-medium">{{ selectedEntry.expenseLocation || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">地点坐标</dt
            ><dd class="mt-1 font-medium tabular-nums">
              {{
                selectedEntry.expenseCoordinateStatus === 'located'
                  ? formatCoordinateValue(
                      selectedEntry.expenseLongitude,
                      selectedEntry.expenseLatitude
                    )
                  : '--'
              }}
              <span
                v-if="selectedEntry.expenseCoordinateStatus === 'located'"
                class="ml-1 text-xs font-normal text-[var(--el-text-color-secondary)]"
              >
                {{
                  selectedEntry.expenseCoordinateSource === 'device_geolocation'
                    ? '当前位置'
                    : '地图选点'
                }}
              </span>
            </dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">加油升数</dt
            ><dd class="mt-1 font-medium tabular-nums">{{ selectedEntry.liters ?? '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">油价（元/升）</dt
            ><dd class="mt-1 font-medium tabular-nums">{{
              selectedEntry.unitPrice ?? '--'
            }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">表显里程（公里）</dt
            ><dd class="mt-1 font-medium tabular-nums">{{
              selectedEntry.odometerKm ?? '--'
            }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">本趟百公里油耗</dt
            ><dd class="mt-1 font-medium tabular-nums">{{
              selectedEntry.entryType !== 'consume'
                ? '—'
                : selectedEntry.tripFuelPer100Km == null
                  ? '待核算：需完整运单里程、表显与余油'
                  : `${selectedEntry.tripFuelPer100Km.toFixed(2)} L/100km`
            }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">支付方式</dt
            ><dd class="mt-1"
              ><ArtDictDisplay
                v-if="selectedEntry.paymentMethod"
                dict-code="fuelCardPaymentMethod"
                :value="selectedEntry.paymentMethod"
              /><span v-else>--</span></dd
            ></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">充值渠道</dt
            ><dd class="mt-1 font-medium">{{ selectedEntry.rechargeChannel || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">充值人</dt
            ><dd class="mt-1 font-medium">{{
              selectedEntry.rechargerEmployeeName || '--'
            }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">发票号</dt
            ><dd class="mt-1 font-medium">{{ selectedEntry.invoiceNo || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">业务凭证号</dt
            ><dd class="mt-1 font-medium">{{ selectedEntry.referenceNo || '--' }}</dd></div
          >
          <div class="sm:col-span-2"
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">备注</dt
            ><dd class="mt-1 whitespace-pre-wrap break-words">{{
              selectedEntry.remark || '--'
            }}</dd></div
          >
        </dl>
        <ArtSectionCard
          v-if="selectedEntry.voucherPaths.length"
          title="现场凭证"
          preserve-content-structure
        >
          <ElAlert
            v-if="voucherError"
            :title="voucherError"
            type="warning"
            :closable="false"
            show-icon
          />
          <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <a
              v-for="(url, path) in voucherPreviews"
              :key="path"
              :href="url"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="`查看现场凭证 ${Number(path) + 1}`"
              ><img
                :src="url"
                alt="现场凭证照片"
                width="150"
                height="120"
                class="h-28 w-full rounded-[var(--el-border-radius-base)] object-cover"
            /></a>
          </div>
        </ArtSectionCard>
        <ElAlert
          v-else-if="selectedEntry.sourceCostId"
          type="info"
          :closable="false"
          show-icon
          title="此流水由运单燃油费用生成；若有原始凭证，可在运单费用详情按权限查看。"
        />
      </div>
    </ArtDrawer>
  </div>
</template>

<script setup lang="tsx">
  import { ElButton } from 'element-plus'
  import { uniqBy } from 'lodash-es'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryProps,
    ArtTableQueryExcelColumn
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { signPrivateAttachmentPaths } from '@/utils/supabase/private-attachment'
  import { getWaybillCostDetailPath } from '@/router/business-paths'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import { formatCurrencyValue } from '@/utils/ui/format'
  import { formatCoordinateValue } from '@/utils/ui/coordinates'
  import { formatWithDayjs } from '@/utils/time'
  import {
    exportFuelCardLedgerList,
    fetchFuelCardLedgerList,
    fetchFuelCardList,
    type FuelCardEntry
  } from '@/api/fuel-card'
  import FuelCardEntryDialog from './modules/fuel-card-entry-dialog.vue'
  import FuelCardReversalDialog from './modules/fuel-card-reversal-dialog.vue'
  import CardEntryVoucherDialog from '../components/card-entry-voucher-dialog.vue'
  import FuelStatementDrawer from './modules/fuel-statement-drawer.vue'

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
  const voucherDialogRef = ref<{ handleOpen: (entry: FuelCardEntry) => Promise<void> }>()
  const statementDrawerRef = ref<{ handleOpen: () => Promise<void> }>()
  const detailRef = ref<ArtDrawerExpose<FuelCardEntry>>()
  const selectedEntry = ref<FuelCardEntry | null>(null)
  const voucherPreviews = ref<string[]>([])
  const voucherThumbs = ref<Record<string, string>>({})
  let voucherThumbRequest = 0
  const voucherError = ref('')
  const overview = reactive({ total: 0, rows: [] as FuelCardEntry[] })
  const selectedCardBalance = ref<number | null>(null)
  let balanceRequestId = 0
  const search = reactive<Search>({
    cardId: typeof route.query.cardId === 'string' ? route.query.cardId : undefined,
    entryType: undefined,
    occurredRange: []
  })
  const ledgerViewOptions = [
    { label: '全部流水', value: 'all' },
    { label: '充值记录', value: 'recharge' },
    { label: '消费记录', value: 'consume' }
  ]
  const handleLedgerViewChange = (value: string | number | boolean): void => {
    search.entryType = value === 'all' ? undefined : (String(value) as EntryType)
    tableRef.value?.clearSelection()
    void tableRef.value?.getData()
  }
  const refreshSelectedCardBalance = async (): Promise<void> => {
    const requestId = ++balanceRequestId
    const cardId = search.cardId
    if (!cardId) {
      selectedCardBalance.value = null
      return
    }
    try {
      const page = await fetchFuelCardList({ current: 1, size: 1, cardId })
      if (requestId === balanceRequestId) selectedCardBalance.value = page.data[0]?.balance ?? null
    } catch {
      if (requestId === balanceRequestId) selectedCardBalance.value = null
    }
  }
  watch(
    () => search.cardId,
    () => void refreshSelectedCardBalance(),
    { immediate: true }
  )
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
    },
    {
      label: search.cardId ? '所选油卡余额' : '本页油卡余额',
      value:
        search.cardId && selectedCardBalance.value !== null
          ? formatCurrencyValue(selectedCardBalance.value)
          : overview.rows.length && !search.cardId
            ? formatCurrencyValue(
                uniqBy(overview.rows, 'cardId').reduce((sum, row) => sum + row.cardBalance, 0)
              )
            : '--',
      description: search.cardId ? '日期筛选不影响' : '本页涉及油卡去重汇总',
      icon: 'ri:wallet-3-line',
      tone: 'primary'
    }
  ])
  const excelColumns: ArtTableQueryExcelColumn[] = [
    { key: 'cardNo', title: '油卡号', required: true },
    { key: 'plateNo', title: '绑定车牌' },
    { key: 'cardStatus', title: '油卡状态' },
    { key: 'entryType', title: '流水类型' },
    { key: 'driverName', title: '本笔司机' },
    { key: 'stationName', title: '加油站' },
    { key: 'liters', title: '加油升数' },
    { key: 'tripFuelPer100Km', title: '本趟百公里油耗' },
    { key: 'unitPrice', title: '油价（元/升）' },
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
      key: 'statement',
      label: '站点对账',
      icon: 'ri:scales-3-line',
      permission: 'FuelCardLedger:View',
      onClick: () => void statementDrawerRef.value?.handleOpen()
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
    {
      prop: 'cardNo',
      label: '油卡号',
      minWidth: 150,
      fixed: 'left',
      link: { permission: 'FuelCardLedger:View', onClick: (row) => void openDetail(row) }
    },
    {
      prop: 'cardStatus',
      label: '卡状态',
      width: 96,
      formatter: (row) => <ArtDictDisplay dict-code="fuelCardStatus" value={row.cardStatus} />
    },
    {
      prop: 'driverName',
      label: '本笔司机',
      minWidth: 110,
      formatter: (row) => row.driverName || '--'
    },
    {
      prop: 'voucherPaths',
      label: '凭证图片',
      width: 130,
      formatter: (row) =>
        row.voucherPaths.length ? (
          <ElButton
            link
            type="primary"
            class="!h-auto !p-0"
            aria-label={`查看 ${row.cardNo} 的 ${row.voucherPaths.length} 张现场凭证`}
            onClick={() => void openDetail(row)}
          >
            <span class="art-icon-label">
              {voucherThumbs.value[row.id] ? (
                <img
                  src={voucherThumbs.value[row.id]}
                  alt=""
                  width="28"
                  height="28"
                  class="h-7 w-7 rounded-[var(--el-border-radius-small)] object-cover"
                />
              ) : (
                <ArtSvgIcon icon="ri:image-line" aria-hidden="true" class="text-base" />
              )}
              <span>{row.voucherPaths.length} 张</span>
            </span>
          </ElButton>
        ) : row.sourceCostId ? (
          hasAuth('FinanceWaybillCost:View') ? (
            <ElButton link type="primary" onClick={() => openSourceCost(row)}>
              查看费用单
            </ElButton>
          ) : (
            '费用单关联'
          )
        ) : (
          '--'
        )
    },
    {
      prop: 'amount',
      label: '变动金额',
      width: 132,
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
      width: 132,
      align: 'right',
      formatter: (row) => <span class="tabular-nums">{formatCurrencyValue(row.balanceAfter)}</span>
    },
    {
      prop: 'plateNo',
      label: '绑定车牌',
      minWidth: 120,
      link: {
        permission: 'VehicleQuery:View',
        onClick: (row) => void router.push(`/vms/vehicle-query/detail/${row.vehicleId}`)
      }
    },
    {
      prop: 'entryType',
      label: '类型',
      width: 96,
      formatter: (row) => <ArtDictDisplay dict-code="fuelCardEntryType" value={row.entryType} />
    },
    {
      prop: 'stationName',
      label: '加油站',
      minWidth: 150,
      formatter: (row) => row.stationName || '--'
    },
    {
      prop: 'liters',
      label: '升数',
      width: 100,
      align: 'right',
      formatter: (row) => (row.liters == null ? '--' : row.liters.toFixed(2))
    },
    {
      prop: 'tripFuelPer100Km',
      label: '本趟百公里油耗',
      width: 165,
      align: 'right',
      formatter: (row) =>
        row.entryType !== 'consume'
          ? '—'
          : row.tripFuelPer100Km == null
            ? '待核算'
            : `${row.tripFuelPer100Km.toFixed(2)} L/100km`
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
      width: 168,
      fixed: 'right',
      formatter: (row) => (
        <div class="flex items-center justify-end gap-2">
          {row.sourceCostId && hasAuth('FinanceWaybillCost:View') && (
            <ElButton link type="primary" onClick={() => openSourceCost(row)}>
              费用单
            </ElButton>
          )}
          {hasAuth('FuelCardLedger:AttachVoucher') && row.voucherPaths.length < 5 && (
            <ElButton
              link
              type="primary"
              onClick={() => void voucherDialogRef.value?.handleOpen(row)}
            >
              补传凭证
            </ElButton>
          )}
          {!row.sourceCostId &&
            hasAuth('FuelCardLedger:Reverse') &&
            row.entryType !== 'reversal' &&
            !row.isReversed && (
              <ElButton
                link
                type="warning"
                onClick={() => void reversalDialogRef.value?.handleOpen(row)}
              >
                冲正
              </ElButton>
            )}
        </div>
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
    if (search.cardId) void refreshSelectedCardBalance()
    void loadVoucherThumbs(rows as FuelCardEntry[])
  }
  const loadVoucherThumbs = async (entries: FuelCardEntry[]): Promise<void> => {
    const request = ++voucherThumbRequest
    voucherThumbs.value = {}
    const candidates = entries.filter((entry) => entry.voucherPaths.length)
    if (!candidates.length) return
    try {
      const paths = uniqBy(candidates, (entry) => entry.voucherPaths[0]).map(
        (entry) => entry.voucherPaths[0]
      )
      const signed = await signPrivateAttachmentPaths('vms-fuel-card-private', paths)
      if (request !== voucherThumbRequest) return
      voucherThumbs.value = Object.fromEntries(
        candidates
          .map((entry) => [entry.id, signed.get(entry.voucherPaths[0])] as const)
          .filter((pair): pair is readonly [string, string] => Boolean(pair[1]))
      )
    } catch {
      if (request === voucherThumbRequest) voucherThumbs.value = {}
    }
  }
  const openDetail = async (entry: FuelCardEntry): Promise<void> => {
    selectedEntry.value = entry
    voucherPreviews.value = []
    voucherError.value = ''
    await detailRef.value?.handleOpen(entry, {
      title: '流水明细',
      subtitle: `${entry.cardNo} · ${entry.occurredOn}`
    })
    if (!entry.voucherPaths.length) return
    try {
      const signed = await signPrivateAttachmentPaths('vms-fuel-card-private', entry.voucherPaths)
      if (selectedEntry.value?.id === entry.id) {
        voucherPreviews.value = entry.voucherPaths
          .map((path) => signed.get(path))
          .filter((url): url is string => Boolean(url))
      }
    } catch {
      if (selectedEntry.value?.id === entry.id)
        voucherError.value = '现场凭证预览失败，请稍后重试。'
    }
  }
  const openSourceCost = (entry: FuelCardEntry): void => {
    if (!entry.sourceCostId || !hasAuth('FinanceWaybillCost:View')) return
    void router.push(getWaybillCostDetailPath(entry.sourceCostId))
  }
</script>
