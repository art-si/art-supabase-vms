<template>
  <div class="business-workspace-page art-full-height min-w-0 gap-3">
    <BusinessWorkspaceHeader
      eyebrow="PARTS ISSUE & RETURN"
      title="车辆配件领用"
      description="按车辆登记领用、部分归还与丢损处理，单据和库存变动自动关联。"
      icon="ri:truck-line"
      :tags="[
        { label: '一车一单', type: 'primary' },
        { label: '明细可追溯', type: 'info' }
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
      :search-bar-props="{ span: 6, labelWidth: 90 }"
      :table-props="{
        rowKey: 'id',
        tableLayout: 'fixed',
        emptyText: '暂无配件领用单',
        emptyDescription: '可新建领用单，或调整单号后重新查询。'
      }"
      :on-success="handleSuccess"
      focusable
    />
    <PartIssueDialog ref="issueRef" @success="tableRef?.refreshCreate()" />
    <PartReturnDialog ref="returnRef" @success="handleReturnSuccess" />
    <ArtDrawer ref="detailRef" size="lg" :show-footer="false" :loading="detail.loading">
      <ArtAsyncState
        :error="detail.error"
        :empty="!detail.error && !detail.record"
        empty-text="领用单已不可用"
        empty-description="请关闭详情并刷新列表后重试。"
        @retry="reloadDetail"
      >
        <div v-if="detail.record" class="space-y-4">
          <div
            class="grid gap-3 rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-light)] p-4 sm:grid-cols-3"
          >
            <div
              ><span class="text-xs text-[var(--el-text-color-secondary)]">领用单号</span
              ><strong class="mt-1 block break-all">{{ detail.record.documentNo }}</strong></div
            >
            <div
              ><span class="text-xs text-[var(--el-text-color-secondary)]">领用车辆</span
              ><strong class="mt-1 block">{{ detail.record.plateNo }}</strong></div
            >
            <div
              ><span class="text-xs text-[var(--el-text-color-secondary)]">领用司机</span
              ><strong class="mt-1 block">{{ detail.record.driverName || '未指定' }}</strong></div
            >
          </div>
          <ArtSectionCard
            title="领用明细"
            :subtitle="`共 ${detail.record.lines.length} 项；归还可分次登记`"
            preserve-content-structure
          >
            <ElAlert v-if="detail.imageError" class="mb-3" type="warning" :closable="false" show-icon :title="detail.imageError" />
            <div class="space-y-3">
              <article
                v-for="line in detail.record.lines"
                :key="line.id"
                class="min-w-0 rounded-[var(--el-border-radius-base)] border border-[var(--el-border-color-light)] p-4"
              >
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <h4 class="truncate font-medium" :title="line.partName">{{ line.partName }}</h4>
                    <p class="mt-1 text-xs text-[var(--el-text-color-secondary)]"
                      >{{ line.partCode }} · {{ line.model || '无型号' }} ·
                      {{ line.brand || '无品牌' }}</p
                    >
                  </div>
                  <ElTag :type="statusTone[line.status]" effect="plain" size="small">{{
                    statusLabels[line.status]
                  }}</ElTag>
                </div>
                <div
                  class="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--el-border-color-lighter)] pt-3"
                >
                  <div class="grid flex-1 grid-cols-2 gap-x-5 gap-y-2 text-sm sm:grid-cols-4">
                    <p
                      ><span class="text-[var(--el-text-color-secondary)]">领用 </span
                      ><strong class="tabular-nums"
                        >{{ line.issuedQty }} {{ line.unit || '' }}</strong
                      ></p
                    >
                    <p
                      ><span class="text-[var(--el-text-color-secondary)]">已归还 </span
                      ><strong class="tabular-nums">{{ line.returnedQty }}</strong></p
                    >
                    <p
                      ><span class="text-[var(--el-text-color-secondary)]">已处理 </span
                      ><strong class="tabular-nums">{{ line.settledQty }}</strong></p
                    >
                    <p
                      ><span class="text-[var(--el-text-color-secondary)]">待处理 </span
                      ><strong class="tabular-nums">{{
                        Math.max(0, line.issuedQty - line.settledQty)
                      }}</strong></p
                    >
                    <p class="col-span-2 text-xs text-[var(--el-text-color-secondary)]"
                      >领用 {{ formatWithDayjs(line.issuedAt) }}</p
                    >
                    <p
                      v-if="line.returnedAt"
                      class="col-span-2 text-xs text-[var(--el-text-color-secondary)]"
                      >最近归还 {{ formatWithDayjs(line.returnedAt) }}</p
                    >
                  </div>
                  <ElButton
                    v-if="hasAuth('VmsPartIssue:Return') && line.issuedQty > line.settledQty"
                    type="primary"
                    plain
                    @click="openReturn(line)"
                    >归还 / 报损</ElButton
                  >
                </div>
                <a
                  v-if="line.imagePath && detail.imagePreviews[line.imagePath]"
                  class="mt-3 inline-block rounded-[var(--el-border-radius-base)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-color)]"
                  :href="detail.imagePreviews[line.imagePath]"
                  target="_blank"
                  rel="noopener noreferrer"
                  :aria-label="`查看 ${line.partName} 的配件照片`"
                >
                  <img
                    :src="detail.imagePreviews[line.imagePath]"
                    :alt="`${line.partName} 领用照片`"
                    width="88"
                    height="88"
                    class="size-[88px] rounded-[var(--el-border-radius-base)] object-cover"
                  />
                </a>
              </article>
            </div>
          </ArtSectionCard>
          <p v-if="detail.record.remark" class="text-sm text-[var(--el-text-color-secondary)]"
            >备注：{{ detail.record.remark }}</p
          >
        </div>
      </ArtAsyncState>
    </ArtDrawer>
  </div>
</template>

<script setup lang="tsx">
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { formatWithDayjs } from '@/utils/time'
  import { useAuth } from '@/hooks/core/useAuth'
  import { signPrivateAttachmentPaths } from '@/utils/supabase/private-attachment'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import {
    fetchVehiclePartIssues,
    fetchVehiclePartIssueDetail,
    type VehiclePartIssue,
    type VehiclePartIssueDetail,
    type VehiclePartIssueLine,
    type VehiclePartIssueStatus
  } from '@vms/api'
  import PartIssueDialog from './part-issue-dialog.vue'
  import PartReturnDialog from './part-return-dialog.vue'

  defineOptions({ name: 'VmsPartIssueWorkspace' })

  const { hasAuth } = useAuth()
  const tableRef = ref<ArtTableQueryExpose>()
  const issueRef = ref<{ handleOpen: () => Promise<void> }>()
  const returnRef = ref<{ handleOpen: (line: VehiclePartIssueLine) => Promise<void> }>()
  const detailRef = ref<ArtDrawerExpose<VehiclePartIssueDetail>>()
  const search = reactive<{ documentNo: string }>({ documentNo: '' })
  const overview = reactive<{ total: number; rows: VehiclePartIssue[] }>({ total: 0, rows: [] })
  const detail = reactive<{
    id: string
    record: VehiclePartIssueDetail | null
    imagePreviews: Record<string, string>
    imageError: string | null
    loading: boolean
    error: string | null
  }>({
    id: '',
    record: null,
    imagePreviews: {},
    imageError: null,
    loading: false,
    error: null
  })
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '领用单数',
      value: overview.total,
      description: '当前筛选条件下',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '本页领用件数',
      value: overview.rows.reduce((sum, row) => sum + row.issuedQty, 0),
      description: '当前页领用合计',
      icon: 'ri:tools-line',
      tone: 'primary'
    },
    {
      label: '本页已归还',
      value: overview.rows.reduce((sum, row) => sum + row.returnedQty, 0),
      description: '不含丢失、损坏',
      icon: 'ri:arrow-go-back-line',
      tone: 'success'
    }
  ])
  const searchItems: SearchFormItem[] = [{ label: '领用单号', key: 'documentNo', type: 'input' }]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      key: 'issue',
      label: '新建领用单',
      icon: 'ri:add-line',
      permission: 'VmsPartIssue:Add',
      onClick: () => void issueRef.value?.handleOpen()
    }
  ])
  const statusLabels: Record<VehiclePartIssueStatus, string> = {
    in_use: '在用',
    returned: '已归还',
    lost: '丢失',
    damaged: '损坏'
  }
  const statusTone: Record<VehiclePartIssueStatus, 'primary' | 'success' | 'danger' | 'warning'> = {
    in_use: 'primary',
    returned: 'success',
    lost: 'danger',
    damaged: 'warning'
  }
  const columnsFactory = (): ColumnOption<VehiclePartIssue>[] => [
    { type: 'globalIndex', label: '序号', width: 70 },
    {
      prop: 'documentNo',
      label: '领用单号',
      minWidth: 210,
      fixed: 'left',
      link: { permission: 'VmsPartIssue:View', onClick: (row) => void openDetail(row) }
    },
    { prop: 'plateNo', label: '领用车辆', minWidth: 120 },
    {
      prop: 'driverName',
      label: '领用司机',
      minWidth: 120,
      formatter: (row) => row.driverName || '--'
    },
    { prop: 'lineCount', label: '明细项', width: 92, align: 'right' },
    { prop: 'issuedQty', label: '领用数量', width: 105, align: 'right' },
    { prop: 'returnedQty', label: '已归还', width: 96, align: 'right' },
    {
      prop: 'createTime',
      label: '登记时间',
      width: 176,
      formatter: (row) => formatWithDayjs(row.createTime) || '--'
    },
    {
      prop: 'operation',
      label: '操作',
      width: 84,
      fixed: 'right',
      formatter: (row) => (
        <BusinessTableRowActions>
          <ArtButtonTable
            type="view"
            permission="VmsPartIssue:View"
            onClick={() => void openDetail(row)}
          />
        </BusinessTableRowActions>
      )
    }
  ]
  const fetchTableData = async (params: { current: number; size: number; documentNo?: string }) => {
    const { from, to } = buildSupabasePageRange(params)
    return await fetchVehiclePartIssues({ from, to, documentNo: params.documentNo })
  }
  const handleSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (rows, response) => {
    overview.rows = rows as VehiclePartIssue[]
    overview.total = response.total ?? rows.length
  }
  const loadDetail = async (id: string): Promise<void> => {
    detail.loading = true
    detail.error = null
    try {
      const result = await fetchVehiclePartIssueDetail(id)
      if (result.error || !result.data) throw result.error || new Error('领用单不存在')
      detail.record = result.data
      const paths = result.data.lines.flatMap((line) => (line.imagePath ? [line.imagePath] : []))
      detail.imageError = null
      detail.imagePreviews = {}
      if (paths.length) {
        try {
          detail.imagePreviews = Object.fromEntries(await signPrivateAttachmentPaths('vms-part-private', paths))
        } catch {
          detail.imageError = '配件照片暂时无法预览，单据和归还操作仍可继续。'
        }
      }
    } catch {
      detail.error = '领用单加载失败，请重试'
    } finally {
      detail.loading = false
    }
  }
  const openDetail = async (row: VehiclePartIssue): Promise<void> => {
    detail.id = row.id
    detail.record = null
    await detailRef.value?.handleOpen(undefined, {
      title: '领用归还详情',
      subtitle: row.documentNo
    })
    await loadDetail(row.id)
  }
  const reloadDetail = (): void => {
    if (detail.id) void loadDetail(detail.id)
  }
  const openReturn = (line: VehiclePartIssueLine): void => {
    void returnRef.value?.handleOpen(line)
  }
  const handleReturnSuccess = (): void => {
    void Promise.all([
      tableRef.value?.refreshUpdate(),
      detail.id ? loadDetail(detail.id) : Promise.resolve()
    ])
  }
</script>
