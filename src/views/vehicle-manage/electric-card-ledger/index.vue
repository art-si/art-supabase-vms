<template>
  <div class="business-workspace-page art-full-height min-w-0 gap-3">
    <BusinessWorkspaceHeader
      eyebrow="ELECTRIC CARD LEDGER"
      title="电卡流水"
      description="逐笔记录期初、充值、充电消费与冲正；电卡余额独立核算。"
      icon="ri:charging-pile-2-line"
      :tags="[
        { label: '逐笔留痕', type: 'primary' },
        { label: '独立余额', type: 'info' }
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
        emptyText: '暂无电卡流水',
        emptyDescription: '可登记充值或充电消费，或调整电卡和日期后重新查询。'
      }"
      :on-success="handleSuccess"
      focusable
    >
      <template #table-header-top>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <ElSegmented
            :model-value="search.entryType || 'all'"
            :options="ledgerViews"
            aria-label="电卡流水类型视图"
            @update:model-value="handleLedgerViewChange"
          />
          <span class="text-xs text-[var(--el-text-color-secondary)]">
            按记账序号倒排；发生时间可回填，余额随记账顺序计算。
          </span>
        </div>
      </template>
    </ArtTableQuery>
    <ElectricCardEntryDialog ref="entryDialogRef" @success="tableRef?.refreshCreate()" />
    <ElectricCardReversalDialog ref="reversalDialogRef" @success="tableRef?.refreshUpdate()" />
    <CardEntryVoucherDialog
      ref="voucherDialogRef"
      kind="electric"
      @success="tableRef?.refreshUpdate()"
    />
    <ArtDrawer ref="detailRef" size="md" :show-footer="false">
      <div v-if="selectedEntry" class="space-y-4">
        <div class="rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-light)] p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <span class="text-xs text-[var(--el-text-color-secondary)]">电卡 / 车辆</span>
              <h3 class="mt-1 break-all text-lg font-semibold"
                >{{ selectedEntry.cardNo }} · {{ selectedEntry.plateNo }}</h3
              >
            </div>
            <ArtDictDisplay dict-code="fuelCardEntryType" :value="selectedEntry.entryType" />
          </div>
          <div class="mt-4 border-t border-[var(--el-border-color)] pt-3">
            <span class="text-xs text-[var(--el-text-color-secondary)]">变动金额 / 变动后余额</span>
            <strong class="mt-1 block text-xl tabular-nums">
              {{ selectedEntry.signedAmount < 0 ? '−' : '+'
              }}{{ formatCurrencyValue(selectedEntry.amount) }} ·
              {{ formatCurrencyValue(selectedEntry.balanceAfter) }}
            </strong>
          </div>
        </div>
        <dl
          class="grid gap-4 rounded-[var(--el-border-radius-base)] border border-[var(--el-border-color-light)] p-5 sm:grid-cols-2"
        >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">卡状态</dt
            ><dd class="mt-1"
              ><ArtDictDisplay dict-code="fuelCardStatus" :value="selectedEntry.cardStatus" /></dd
          ></div>
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">流水时间</dt
            ><dd class="mt-1 font-medium">{{
              formatWithDayjs(selectedEntry.occurredAt) || '--'
            }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">记账序号</dt
            ><dd class="mt-1 font-medium tabular-nums">#{{ selectedEntry.postingSeq }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">记账时间</dt
            ><dd class="mt-1 font-medium">{{
              formatWithDayjs(selectedEntry.createTime) || '--'
            }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">本笔司机</dt
            ><dd class="mt-1 font-medium">{{ selectedEntry.driverName || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">充电站</dt
            ><dd class="mt-1 font-medium">{{ selectedEntry.stationName || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">关联运单</dt
            ><dd class="mt-1 font-medium break-all">{{ selectedEntry.waybillNo || '--' }}</dd></div
          >
          <div class="sm:col-span-2"
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">发生地点</dt
            ><dd class="mt-1 break-words">{{ selectedEntry.expenseLocation || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">表号/桩号</dt
            ><dd class="mt-1 font-medium">{{ selectedEntry.pileNo || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">充电数</dt
            ><dd class="mt-1 font-medium tabular-nums">{{
              selectedEntry.chargeKwh == null ? '--' : `${selectedEntry.chargeKwh} kWh`
            }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">电价（元/kWh）</dt
            ><dd class="mt-1 font-medium tabular-nums">{{
              selectedEntry.unitPrice ?? '--'
            }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">充值渠道</dt
            ><dd class="mt-1 font-medium">{{ selectedEntry.rechargeChannel || '--' }}</dd></div
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
              v-for="(url, index) in voucherPreviews"
              :key="url"
              :href="url"
              target="_blank"
              rel="noopener noreferrer"
              :aria-label="`查看现场凭证 ${index + 1}`"
            >
              <img
                :src="url"
                alt="充电或充值现场凭证"
                width="150"
                height="120"
                class="h-28 w-full rounded-[var(--el-border-radius-base)] object-cover"
              />
            </a>
          </div>
        </ArtSectionCard>
      </div>
    </ArtDrawer>
  </div>
</template>

<script setup lang="tsx">
  import { uniqBy } from 'lodash-es'
  import { ElAlert, ElButton, ElSegmented } from 'element-plus'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import { signPrivateAttachmentPaths } from '@/utils/supabase/private-attachment'
  import { useAuth } from '@/hooks/core/useAuth'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { formatCurrencyValue } from '@/utils/ui/format'
  import { formatWithDayjs } from '@/utils/time'
  import {
    fetchElectricCards,
    fetchElectricCardEntries,
    type ElectricCard,
    type ElectricCardEntry,
    type ElectricCardEntryType
  } from '@/api/electric-card'
  import ElectricCardEntryDialog from './modules/electric-card-entry-dialog.vue'
  import ElectricCardReversalDialog from './modules/electric-card-reversal-dialog.vue'
  import CardEntryVoucherDialog from '../components/card-entry-voucher-dialog.vue'

  defineOptions({ name: 'VmsElectricCardLedger' })

  interface Search {
    cardId?: string
    entryType?: ElectricCardEntryType
    occurredRange: string[]
  }
  interface TableParams extends Search {
    current: number
    size: number
  }
  const route = useRoute()
  const { hasAuth } = useAuth()
  const tableRef = ref<ArtTableQueryExpose>()
  const entryDialogRef = ref<{
    handleOpen: (type: 'recharge' | 'consume', card?: ElectricCard) => Promise<void>
  }>()
  const reversalDialogRef = ref<{ handleOpen: (entry: ElectricCardEntry) => Promise<void> }>()
  const voucherDialogRef = ref<{ handleOpen: (entry: ElectricCardEntry) => Promise<void> }>()
  const detailRef = ref<ArtDrawerExpose<ElectricCardEntry>>()
  const selectedEntry = ref<ElectricCardEntry | null>(null)
  const voucherPreviews = ref<string[]>([])
  const voucherError = ref('')
  const overview = reactive({ total: 0, rows: [] as ElectricCardEntry[] })
  const selectedCardBalance = ref<number | null>(null)
  let balanceRequestId = 0
  const search = reactive<Search>({
    cardId: typeof route.query.cardId === 'string' ? route.query.cardId : undefined,
    entryType: undefined,
    occurredRange: []
  })
  watch(
    () => route.query.cardId,
    (id) => {
      search.cardId = typeof id === 'string' ? id : undefined
      void nextTick(() => tableRef.value?.refreshData())
    }
  )
  const refreshSelectedCardBalance = async (): Promise<void> => {
    const requestId = ++balanceRequestId
    selectedCardBalance.value = null
    if (!search.cardId) return
    try {
      const page = await fetchElectricCards({ current: 1, size: 1, cardId: search.cardId })
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
  const ledgerViews = [
    { label: '全部流水', value: 'all' },
    { label: '充值记录', value: 'recharge' },
    { label: '消费记录', value: 'consume' }
  ]
  const handleLedgerViewChange = (value: string | number | boolean): void => {
    search.entryType = value === 'all' ? undefined : (value as ElectricCardEntryType)
    void nextTick(() => tableRef.value?.refreshData())
  }
  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '电卡',
      key: 'cardId',
      type: 'select',
      api: () => fetchElectricCards({ current: 1, size: 200 }),
      resultField: 'data',
      labelField: 'cardNo',
      valueField: 'id',
      props: { filterable: true, clearable: true, placeholder: '选择电卡' }
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
      label: search.cardId ? '所选电卡余额' : '本页电卡余额',
      value:
        search.cardId && selectedCardBalance.value !== null
          ? formatCurrencyValue(selectedCardBalance.value)
          : overview.rows.length && !search.cardId
            ? formatCurrencyValue(
                uniqBy(overview.rows, 'cardId').reduce((sum, row) => sum + row.cardBalance, 0)
              )
            : '--',
      description: search.cardId ? '日期筛选不影响' : '本页涉及电卡去重汇总',
      icon: 'ri:wallet-3-line',
      tone: 'primary'
    }
  ])
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      key: 'recharge',
      label: '登记充值',
      icon: 'ri:add-circle-line',
      permission: 'ElectricCardLedger:Recharge',
      onClick: () => void openEntryDialog('recharge')
    },
    {
      key: 'consume',
      label: '登记消费',
      icon: 'ri:subtract-line',
      permission: 'ElectricCardLedger:Consume',
      onClick: () => void openEntryDialog('consume')
    }
  ])
  const openEntryDialog = async (type: 'recharge' | 'consume'): Promise<void> => {
    try {
      const card = search.cardId
        ? (await fetchElectricCards({ current: 1, size: 1, cardId: search.cardId })).data[0]
        : undefined
      await entryDialogRef.value?.handleOpen(type, card?.status === 'active' ? card : undefined)
    } catch (error) {
      notifyFriendlyError(error, '电卡信息加载失败，请刷新后重试')
    }
  }
  const columnsFactory = (): ColumnOption<ElectricCardEntry>[] => [
    { type: 'globalIndex', label: '序号', width: 64 },
    {
      prop: 'postingSeq',
      label: '记账序号',
      width: 100,
      align: 'right',
      formatter: (row) => <span class="tabular-nums">#{row.postingSeq}</span>
    },
    {
      prop: 'cardNo',
      label: '电卡号',
      minWidth: 170,
      fixed: 'left',
      link: { permission: 'ElectricCardLedger:View', onClick: (row) => void openDetail(row) }
    },
    {
      prop: 'cardStatus',
      label: '卡状态',
      width: 96,
      formatter: (row) => <ArtDictDisplay dict-code="fuelCardStatus" value={row.cardStatus} />
    },
    {
      prop: 'driverName',
      label: '司机',
      minWidth: 110,
      formatter: (row) => row.driverName || '--'
    },
    {
      prop: 'entryType',
      label: '类型',
      width: 96,
      formatter: (row) => <ArtDictDisplay dict-code="fuelCardEntryType" value={row.entryType} />
    },
    {
      prop: 'signedAmount',
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
    { prop: 'plateNo', label: '绑定车牌', minWidth: 120 },
    {
      prop: 'stationName',
      label: '充电站',
      minWidth: 150,
      formatter: (row) => row.stationName || '--'
    },
    {
      prop: 'waybillNo',
      label: '关联运单',
      minWidth: 170,
      formatter: (row) => row.waybillNo || '--'
    },
    {
      prop: 'expenseLocation',
      label: '发生地点',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row) => row.expenseLocation || '--'
    },
    {
      prop: 'chargeKwh',
      label: '充电数',
      width: 106,
      align: 'right',
      formatter: (row) => (row.chargeKwh == null ? '--' : `${row.chargeKwh.toFixed(3)} kWh`)
    },
    {
      prop: 'unitPrice',
      label: '电价',
      width: 100,
      align: 'right',
      formatter: (row) => (row.unitPrice == null ? '--' : row.unitPrice.toFixed(4))
    },
    { prop: 'pileNo', label: '表号/桩号', minWidth: 120, formatter: (row) => row.pileNo || '--' },
    {
      prop: 'voucherPaths',
      label: '凭证图片',
      width: 110,
      formatter: (row) =>
        row.voucherPaths.length ? (
          <ElButton link type="primary" onClick={() => void openDetail(row)}>
            {row.voucherPaths.length} 张
          </ElButton>
        ) : (
          '--'
        )
    },
    {
      prop: 'occurredAt',
      label: '发生时间',
      width: 170,
      formatter: (row) => formatWithDayjs(row.occurredAt) || '--'
    },
    {
      prop: 'referenceNo',
      label: '凭证号',
      minWidth: 135,
      formatter: (row) => row.referenceNo || '--'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 168,
      fixed: 'right',
      formatter: (row) => (
        <div class="flex items-center justify-end gap-2">
          {hasAuth('ElectricCardLedger:AttachVoucher') && row.voucherPaths.length < 5 && (
            <ElButton
              link
              type="primary"
              onClick={() => void voucherDialogRef.value?.handleOpen(row)}
            >
              补传凭证
            </ElButton>
          )}
          {hasAuth('ElectricCardLedger:Reverse') &&
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
    fetchElectricCardEntries({
      current: params.current,
      size: params.size,
      cardId: params.cardId,
      entryType: params.entryType,
      occurredFrom: params.occurredRange?.[0],
      occurredTo: params.occurredRange?.[1]
    })
  const handleSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (rows, response) => {
    overview.rows = rows as ElectricCardEntry[]
    overview.total = response.total ?? rows.length
    void refreshSelectedCardBalance()
  }
  const openDetail = async (entry: ElectricCardEntry): Promise<void> => {
    selectedEntry.value = entry
    voucherPreviews.value = []
    voucherError.value = ''
    await detailRef.value?.handleOpen(entry, {
      title: '电卡流水',
      subtitle: `${entry.cardNo} · ${entry.plateNo}`
    })
    if (!entry.voucherPaths.length) return
    try {
      const signed = await signPrivateAttachmentPaths(
        'vms-electric-card-private',
        entry.voucherPaths
      )
      if (selectedEntry.value?.id === entry.id) {
        voucherPreviews.value = entry.voucherPaths
          .map((path) => signed.get(path) || '')
          .filter(Boolean)
      }
    } catch {
      if (selectedEntry.value?.id === entry.id)
        voucherError.value = '凭证图片加载失败，请重新打开流水。'
    }
  }
</script>
