<template>
  <div class="trailer-manage art-full-height">
    <MasterDeleteProcessingNotice
      :table="tableQueryRef"
      action-hint="请核对关联挂车；解除车型引用后返回原页面继续删除。"
    />
    <BusinessWorkspaceHeader
      eyebrow="FLEET ASSET CONTROL"
      title="挂车管理"
      description="统一维护挂车证照、车型参数与默认牵引关系，派车时可快速核对车辆信息。"
      icon="ri:truck-line"
      :tags="[{ label: '挂车档案', type: 'primary' }]"
      :metrics="workspaceMetrics"
    >
      <template #actions>
        <BusinessTableWorkspaceActions :table="tableQueryRef" />
      </template>
    </BusinessWorkspaceHeader>

    <ArtTableQuery
      v-if="canView"
      ref="tableQueryRef"
      v-model="searchQuery"
      :search-items="searchItems"
      :api-fn="fetchTableData"
      :columns-factory="columnsFactory"
      :header-actions="headerActions"
      header-actions-placement="workspace"
      :on-success="handleTableSuccess"
      :table-props="{
        rowKey: 'id',
        tableLayout: 'fixed',
        emptyText: '暂无挂车档案',
        emptyDescription: '新增挂车后，可在这里查看证照和牵引关系。'
      }"
      focusable
    />
    <ArtEmptyState
      v-else
      title="暂无挂车查看权限"
      description="请联系管理员在角色权限中授权挂车查看。"
    />

    <TrailerDialog ref="dialogRef" @success="handleSaveSuccess" />
  </div>
</template>

<script setup lang="tsx">
  import { h } from 'vue'
  import dayjs from 'dayjs'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { formatWithDayjs } from '@/utils/time'
  import { fetchTrailerDetail, fetchTrailerList } from '@vms/api'
  import type { TrailerRecord } from '@vms/types/trailer'
  import TrailerDialog from './modules/trailer-dialog.vue'
  import MasterDeleteProcessingNotice from '@/components/business/master-delete-processing-notice/index.vue'

  defineOptions({ name: 'TrailerManage' })

  const { hasAuth } = useAuth()
  const route = useRoute()
  const canView = computed(() => hasAuth('TrailerManage:View'))
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<{ handleOpen: (row?: TrailerRecord) => Promise<void> }>()
  const searchQuery = ref({ plateNo: '' })
  const overview = reactive<{ total: number; rows: TrailerRecord[] }>({ total: 0, rows: [] })

  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '挂车总数',
      value: overview.total,
      description: '当前查询范围内的挂车',
      icon: 'ri:truck-line'
    },
    {
      label: '已关联牵引车',
      value: overview.rows.filter((row) => row.defaultTractorId).length,
      description: '本页已设置默认牵引车',
      icon: 'ri:links-line',
      tone: 'success'
    },
    {
      label: '待完善证照',
      value: overview.rows.filter((row) => !row.licenseFrontUrl || !row.licenseBackUrl).length,
      description: '本页缺少行驶证主页或副页',
      icon: 'ri:file-warning-line',
      tone: 'warning'
    }
  ])
  const searchItems = computed<SearchFormItem[]>(() => [
    { label: '车牌号', key: 'plateNo', type: 'input' }
  ])
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() => [
    {
      permission: 'TrailerManage:Add',
      type: 'add',
      label: '添加挂车',
      onClick: () => dialogRef.value?.handleOpen()
    }
  ])

  const referenceRecordId = computed(() =>
    typeof route.query.recordId === 'string' && route.query.fromMasterDelete === '1'
      ? route.query.recordId
      : ''
  )
  const fetchTableData = async (params: { current: number; size: number; plateNo?: string }) => {
    if (referenceRecordId.value) {
      const result = await fetchTrailerDetail(referenceRecordId.value)
      return {
        data: result.data ? [result.data] : [],
        total: result.data ? 1 : 0,
        error: result.error
      }
    }
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    return await fetchTrailerList({ from, to, plateNo: params.plateNo })
  }
  watch(referenceRecordId, () => void tableQueryRef.value?.refreshData())
  const textOrDash = (value: string | number | null | undefined) =>
    value == null || value === '' ? '—' : String(value)
  const licenseStatus = (row: TrailerRecord) => {
    if (!row.inspectionValidUntil) return '未维护'
    const days = dayjs(row.inspectionValidUntil).startOf('day').diff(dayjs().startOf('day'), 'day')
    if (days < 0) return '已过期'
    if (days <= 30) return '即将到期'
    return '有效'
  }
  const columnsFactory = (): ColumnOption<TrailerRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 70 },
    {
      prop: 'plateNo',
      label: '车牌号',
      minWidth: 145,
      fixed: 'left',
      formatter: (row) =>
        h(
          'strong',
          { class: 'font-semibold text-[var(--art-gray-900)]', title: row.plateNo },
          row.plateNo
        )
    },
    {
      prop: 'plateColor',
      label: '车牌颜色',
      width: 100,
      dict: { code: 'vehiclePlateColor', display: 'auto' }
    },
    {
      prop: 'ownership',
      label: '业务关系',
      minWidth: 120,
      dict: { code: 'vehicleOwnership', display: 'auto' }
    },
    {
      prop: 'companyName',
      label: '所属组织',
      minWidth: 150,
      formatter: (row) => textOrDash(row.companyName)
    },
    { prop: 'trailerType', label: '挂车类型', minWidth: 170 },
    {
      prop: 'curbWeightKg',
      label: '整备质量 (kg)',
      width: 132,
      align: 'right',
      formatter: (row) => textOrDash(row.curbWeightKg)
    },
    {
      prop: 'approvedLoadKg',
      label: '核定载质量 (kg)',
      width: 148,
      align: 'right',
      formatter: (row) => textOrDash(row.approvedLoadKg)
    },
    {
      prop: 'lengthMm',
      label: '车长 (mm)',
      width: 122,
      align: 'right',
      formatter: (row) => textOrDash(row.lengthMm)
    },
    {
      prop: 'defaultTractorPlateNo',
      label: '牵引车',
      minWidth: 140,
      formatter: (row) => textOrDash(row.defaultTractorPlateNo)
    },
    {
      prop: 'licenseStatus',
      label: '行驶证状态',
      width: 120,
      formatter: (row) => licenseStatus(row)
    },
    {
      prop: 'inspectionValidUntil',
      label: '行驶证有效期',
      width: 140,
      formatter: (row) =>
        row.inspectionValidUntil ? formatWithDayjs(row.inspectionValidUntil) : '—'
    },
    { prop: 'source', label: '来源', width: 105, formatter: (row) => textOrDash(row.source) },
    { prop: 'remark', label: '备注', minWidth: 160, formatter: (row) => textOrDash(row.remark) },
    {
      prop: 'operation',
      label: '操作',
      width: 100,
      fixed: 'right',
      formatter: (row) => (
        <ArtButtonTable
          type="edit"
          permission="TrailerManage:Edit"
          onClick={() => dialogRef.value?.handleOpen(row)}
        />
      )
    }
  ]
  const handleTableSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (rows, response) => {
    overview.rows = rows as TrailerRecord[]
    overview.total = response.total ?? rows.length
  }
  const handleSaveSuccess = () => {
    void tableQueryRef.value?.refreshData()
  }
</script>
