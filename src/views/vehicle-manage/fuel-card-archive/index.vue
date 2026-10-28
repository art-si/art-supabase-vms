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
      <template #actions>
        <ElRadioGroup v-model="viewMode" size="small" aria-label="油卡展示方式">
          <ElRadioButton value="list">明细</ElRadioButton>
          <ElRadioButton value="cards">卡片</ElRadioButton>
        </ElRadioGroup>
        <BusinessTableWorkspaceActions
          :table="tableRef"
          :show-display-controls="viewMode === 'list'"
        />
      </template>
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
    >
      <template v-if="viewMode === 'cards'" #content>
        <ArtAsyncState
          :loading="cardDataState.loading"
          :error="cardDataState.error"
          :empty="!cardDataState.loading && !cardDataState.error && cardRows.length === 0"
          empty-text="暂无油卡档案"
          empty-description="可创建油卡并绑定已审批车辆，或调整筛选条件后重新查询。"
          :min-height="260"
          @retry="tableRef?.refreshData()"
        >
          <div class="fuel-card-archive__cards grid gap-3 p-4">
            <article
              v-for="card in cardRows"
              :key="card.id"
              class="min-w-0 rounded-[var(--el-border-radius-base)] border border-[var(--el-border-color-light)] bg-[var(--el-bg-color)] p-4"
            >
              <div class="flex min-w-0 items-start justify-between gap-3">
                <img
                  v-if="imagePreviews[card.imagePath || '']"
                  :src="imagePreviews[card.imagePath || '']"
                  :alt="`${card.cardNo} 卡面照片`"
                  width="56"
                  height="56"
                  class="h-14 w-14 shrink-0 rounded-[var(--el-border-radius-base)] object-cover"
                />
                <span
                  v-else
                  class="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-light)] text-[var(--theme-color)]"
                  aria-hidden="true"
                  ><ArtSvgIcon icon="ri:bank-card-line" class="text-2xl"
                /></span>
                <div class="min-w-0 flex-1">
                  <p class="text-xs text-[var(--el-text-color-secondary)]">{{ card.plateNo }}</p>
                  <button
                    type="button"
                    class="mt-1 block max-w-full truncate text-left text-lg font-semibold text-[var(--theme-color)] hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-color)]"
                    :title="card.cardNo"
                    @click="openDetail(card)"
                    >{{ card.cardNo }}</button
                  >
                </div>
                <ArtDictDisplay class="shrink-0" dict-code="fuelCardStatus" :value="card.status" />
              </div>
              <div class="mt-4 border-t border-[var(--el-border-color-lighter)] pt-3">
                <span class="text-xs text-[var(--el-text-color-secondary)]">当前余额</span>
                <strong
                  class="mt-1 block text-2xl tabular-nums text-[var(--el-text-color-primary)]"
                  >{{ formatCurrencyValue(card.balance) }}</strong
                >
              </div>
              <div class="mt-3 flex min-w-0 items-end justify-between gap-2 text-sm">
                <div class="min-w-0 text-[var(--el-text-color-secondary)]">
                  <p class="truncate" :title="`卡归属人：${card.ownerEmployeeName || '未指定'}`"
                    >卡归属人 {{ card.ownerEmployeeName || '未指定' }}</p
                  >
                  <p class="mt-1 truncate" :title="`司机：${card.driverName || '未指定'}`"
                    >司机 {{ card.driverName || '未指定' }}</p
                  >
                </div>
                <ElButton
                  v-if="hasAuth('FuelCardLedger:View')"
                  link
                  type="primary"
                  @click="openLedger(card)"
                  >查看流水</ElButton
                >
              </div>
            </article>
          </div>
          <div class="flex justify-end border-t border-[var(--el-border-color-lighter)] px-4 py-3">
            <ElPagination
              :current-page="cardPagination.current"
              :page-size="cardPagination.size"
              :total="cardPagination.total"
              layout="total, prev, pager, next"
              @current-change="tableRef?.changePage($event)"
            />
          </div>
        </ArtAsyncState>
      </template>
    </ArtTableQuery>
    <FuelCardDialog ref="dialogRef" @success="tableRef?.refreshCreate()" />
    <ArtDrawer ref="detailRef" :show-footer="false" size="md">
      <div v-if="selectedCard" class="space-y-4">
        <img
          v-if="imagePreviews[selectedCard.imagePath || '']"
          :src="imagePreviews[selectedCard.imagePath || '']"
          :alt="`${selectedCard.cardNo} 卡面照片`"
          width="320"
          height="180"
          class="max-h-48 w-full rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-light)] object-contain"
        />
        <div class="rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-light)] p-5">
          <div class="flex min-w-0 items-start justify-between gap-3">
            <div class="min-w-0">
              <span class="text-xs text-[var(--el-text-color-secondary)]">油卡号码</span>
              <h3 class="mt-1 break-all text-lg font-semibold">{{ selectedCard.cardNo }}</h3>
            </div>
            <ArtDictDisplay dict-code="fuelCardStatus" :value="selectedCard.status" />
          </div>
          <div class="mt-5 border-t border-[var(--el-border-color)] pt-4">
            <span class="text-xs text-[var(--el-text-color-secondary)]">当前余额 · 由流水计算</span>
            <strong class="mt-1 block text-2xl tabular-nums">{{
              formatCurrencyValue(selectedCard.balance)
            }}</strong>
          </div>
        </div>
        <dl
          class="grid gap-4 rounded-[var(--el-border-radius-base)] border border-[var(--el-border-color-light)] p-5 sm:grid-cols-2"
        >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">绑定车辆</dt
            ><dd class="mt-1 font-medium">{{ selectedCard.plateNo }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">所属公司</dt
            ><dd class="mt-1 font-medium">{{ selectedCard.companyName || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">所属油品</dt
            ><dd class="mt-1 font-medium"
              ><ArtDictDisplay dict-code="fuelCardFuelType" :value="selectedCard.fuelType" /></dd
          ></div>
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">卡归属人</dt
            ><dd class="mt-1 font-medium">{{ selectedCard.ownerEmployeeName || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">当前司机</dt
            ><dd class="mt-1 font-medium">{{ selectedCard.driverName || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">开户人</dt
            ><dd class="mt-1 font-medium">{{ selectedCard.openerEmployeeName || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">发卡机构</dt
            ><dd class="mt-1 font-medium">{{ selectedCard.issuer || '--' }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">创建时间</dt
            ><dd class="mt-1 font-medium">{{
              formatWithDayjs(selectedCard.createTime) || '--'
            }}</dd></div
          >
          <div
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">最近更新</dt
            ><dd class="mt-1 font-medium">{{
              formatWithDayjs(selectedCard.updateTime) || '--'
            }}</dd></div
          >
          <div class="sm:col-span-2"
            ><dt class="text-xs text-[var(--el-text-color-secondary)]">备注</dt
            ><dd class="mt-1 whitespace-pre-wrap break-words">{{
              selectedCard.remark || '--'
            }}</dd></div
          >
        </dl>
        <div v-if="hasAuth('FuelCardLedger:View')" class="flex justify-end">
          <ElButton type="primary" @click="openLedger(selectedCard)">查看油卡流水</ElButton>
        </div>
        <div v-if="hasAuth('FuelCardArchive:Edit')" class="flex justify-end">
          <ElButton @click="dialogRef?.handleOpen(selectedCard)">编辑档案资料</ElButton>
        </div>
      </div>
    </ArtDrawer>
  </div>
</template>

<script setup lang="tsx">
  import { ElButton, ElPagination, ElRadioButton, ElRadioGroup } from 'element-plus'
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
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { signPrivateAttachmentPaths } from '@/utils/supabase/private-attachment'
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
  const detailRef = ref<ArtDrawerExpose<FuelCard>>()
  const dialogRef = ref<{ handleOpen: (card?: FuelCard) => Promise<void> }>()
  const viewMode = ref<'list' | 'cards'>('list')
  const selectedCard = ref<FuelCard | null>(null)
  const imagePreviews = ref<Record<string, string>>({})
  let imageLoadSequence = 0
  const cardDataState = computed(() => ({
    loading: tableRef.value?.dataState.loading.value ?? false,
    error: tableRef.value?.dataState.error.value ? '油卡档案加载失败，请重试。' : null
  }))
  const cardRows = computed(() => (tableRef.value?.dataState.rows.value ?? []) as FuelCard[])
  const cardPagination = computed(
    () => tableRef.value?.dataState.pagination.value ?? { current: 1, size: 20, total: 0 }
  )
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
    { key: 'fuelType', title: '所属油品' },
    { key: 'ownerEmployeeName', title: '卡归属人' },
    { key: 'driverName', title: '司机' },
    { key: 'openerEmployeeName', title: '开户人' },
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
      minWidth: 202,
      fixed: 'left',
      formatter: (row) => (
        <div class="flex min-w-0 items-center gap-2">
          <span
            class="grid size-[34px] shrink-0 place-items-center rounded-[var(--el-border-radius-base)] bg-[var(--el-color-primary-light-9)] text-lg text-[var(--el-color-primary)]"
            aria-hidden="true"
          >
            <ArtSvgIcon icon="ri:bank-card-line" />
          </span>
          <div class="min-w-0 flex-1">
            {hasAuth('FuelCardArchive:View') ? (
              <button
                type="button"
                class="block max-w-full truncate text-left font-semibold text-[var(--theme-color)] hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-color)]"
                title={row.cardNo}
                onClick={() => openDetail(row)}
              >
                {row.cardNo}
              </button>
            ) : (
              <strong class="block truncate" title={row.cardNo}>
                {row.cardNo}
              </strong>
            )}
            <small
              class="mt-0.5 block truncate text-[var(--el-text-color-secondary)]"
              title={row.issuer || row.plateNo}
            >
              {row.issuer || row.plateNo}
            </small>
          </div>
        </div>
      )
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
    {
      prop: 'status',
      label: '卡状态',
      width: 104,
      formatter: (row) => <ArtDictDisplay dict-code="fuelCardStatus" value={row.status} />
    },
    {
      prop: 'driverName',
      label: '司机',
      minWidth: 120,
      formatter: (row) => row.driverName || '--'
    },
    {
      prop: 'ownerEmployeeName',
      label: '卡归属人',
      minWidth: 130,
      formatter: (row) => row.ownerEmployeeName || '--'
    },
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
      prop: 'fuelType',
      label: '所属油品',
      width: 120,
      formatter: (row) => <ArtDictDisplay dict-code="fuelCardFuelType" value={row.fuelType} />
    },
    { prop: 'issuer', label: '发卡机构', minWidth: 170, formatter: (row) => row.issuer || '--' },
    {
      prop: 'createTime',
      label: '创建时间',
      width: 170,
      formatter: (row) => formatWithDayjs(row.createTime) || '--'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 96,
      fixed: 'right',
      formatter: (row) =>
        hasAuth('FuelCardArchive:Edit') ? (
          <ArtButtonMore
            list={statusActions(row)}
            onClick={(item: ButtonMoreItem) => void handleCardAction(row, item)}
          />
        ) : (
          '--'
        )
    }
  ]
  const handleSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (rows, response) => {
    overview.rows = rows as FuelCard[]
    overview.total = response.total ?? rows.length
    void loadImagePreviews(overview.rows)
  }
  const loadImagePreviews = async (rows: FuelCard[]): Promise<void> => {
    const requestId = ++imageLoadSequence
    const paths = rows.map((row) => row.imagePath).filter((path): path is string => Boolean(path))
    if (!paths.length) {
      imagePreviews.value = {}
      return
    }
    try {
      const signed = await signPrivateAttachmentPaths('vms-fuel-card-private', paths)
      if (requestId === imageLoadSequence) imagePreviews.value = Object.fromEntries(signed)
    } catch {
      if (requestId === imageLoadSequence) imagePreviews.value = {}
    }
  }
  const openDetail = (card: FuelCard): void => {
    selectedCard.value = card
    void detailRef.value?.handleOpen(card, {
      title: '油卡档案',
      subtitle: `${card.plateNo} · ${card.cardNo}`
    })
  }
  const openLedger = (card: FuelCard): void => {
    void router.push(`/vms/vehicle-manage/fuel-card-ledger?cardId=${card.id}`)
  }
  const statusActions = (card: FuelCard): ButtonMoreItem[] => [
    { key: 'edit', label: '编辑档案', icon: 'ri:edit-line', auth: 'FuelCardArchive:Edit' },
    ...(card.status === 'active'
      ? [
          { key: 'lost', label: '挂失', icon: 'ri:alert-line', auth: 'FuelCardArchive:Edit' },
          {
            key: 'disabled',
            label: '停用',
            icon: 'ri:stop-circle-line',
            auth: 'FuelCardArchive:Edit'
          }
        ]
      : [
          {
            key: 'active',
            label: '恢复正常',
            icon: 'ri:restart-line',
            auth: 'FuelCardArchive:Edit'
          }
        ])
  ]
  const handleCardAction = (card: FuelCard, item: ButtonMoreItem): void => {
    if (item.key === 'edit') {
      void dialogRef.value?.handleOpen(card)
      return
    }
    if (item.key === 'active' || item.key === 'lost' || item.key === 'disabled') {
      void changeStatus(card, item.key)
    }
  }
  const changeStatus = async (card: FuelCard, next: FuelCardStatus): Promise<void> => {
    const actionName = next === 'lost' ? '挂失' : next === 'disabled' ? '停用' : '恢复正常'
    try {
      await confirmAction(
        next === 'active'
          ? `确定将油卡“${card.cardNo}”恢复正常吗？`
          : `${actionName}油卡“${card.cardNo}”后将不能登记新的充值与消费，确定继续吗？`,
        `${actionName}油卡`,
        {
          confirmButtonText: `确认${actionName}`,
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

<style scoped>
  .fuel-card-archive__cards {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
  }
</style>
