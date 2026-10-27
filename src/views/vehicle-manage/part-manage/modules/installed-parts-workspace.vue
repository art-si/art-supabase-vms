<template>
  <div class="vehicle-part-usage-page art-full-height min-w-0 gap-3">
    <BusinessWorkspaceHeader
      eyebrow="PARTS LIFECYCLE"
      title="车辆零部件"
      description="跟踪零部件装车、RFID、质保、使用年限与里程状态，让关键部件全生命周期可追溯。"
      icon="ri:settings-5-line"
      :tags="[
        { label: '一件一档', type: 'primary' },
        { label: '寿命可追踪', type: 'info' }
      ]"
      :metrics="workspaceMetrics"
    >
      <template #actions>
        <BusinessTableWorkspaceActions :table="tableQueryRef" />
      </template>
    </BusinessWorkspaceHeader>

    <ArtTableQuery
      ref="tableQueryRef"
      v-model="table.searchQuery"
      :search-items="table.searchItems"
      :api-fn="fetchTableData"
      :columns-factory="table.columnsFactory"
      :header-actions="table.headerActions"
      header-actions-placement="workspace"
      :search-bar-props="{ span: 6, labelWidth: 90 }"
      :table-props="{
        rowKey: 'id',
        tableLayout: 'fixed',
        emptyText: '暂无车辆零部件记录',
        emptyDescription: '可新增装车零部件，或调整车辆、类别、名称、RFID 和状态后重新查询。'
      }"
      :on-success="handleTableSuccess"
      focusable
    />

    <VehiclePartUsageDialog ref="dialogRef" @success="handleSaveSuccess" />
    <MasterDataDeleteGuard ref="deleteGuardRef" />
  </div>
</template>

<script setup lang="tsx">
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import type { ComputedRef, UnwrapNestedRefs } from 'vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption, DialogType } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { formatWithDayjs } from '@/utils/time'
  import {
    deleteVehiclePartUsage,
    deleteVehiclePartUsageBatch,
    fetchPartsCategoryTree,
    fetchVehiclePartUsageList
  } from '@vms/api'
  import { useUserStore } from '@/store/modules/user'
  import VehiclePartUsageDialog from './vehicle-part-usage-dialog.vue'
  import { formatVehiclePartWarranty } from './vehicle-part-display'
  import { getVehicleUsageYears } from '@vms/views/vehicle-manage/modules/vehicle-lifecycle'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import {
    isReadableFieldAccess,
    canViewField,
    getFieldAccess,
    mergeFieldAccessMaps
  } from '@/utils/field-permission'

  defineOptions({ name: 'VmsInstalledPartsWorkspace' })

  const { deleteGuardRef, deleteRecord, deleteRecords } = useRecordDeleteGuard(
    'vehicle_part_usage',
    '装车配件记录'
  )

  type Usage = Api.Vms.VehicleManage.VehiclePartUsage
  type SearchParams = Api.Vms.VehicleManage.VehiclePartUsageSearchParams
  type TableParams = SearchParams & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  interface DialogExpose {
    handleOpen: (row?: Usage) => Promise<void>
  }

  interface TableGroup {
    searchQuery: SearchParams
    searchItems: ComputedRef<SearchFormItem[]>
    headerActions: ComputedRef<ArtTableQueryHeaderAction[]>
    columnsFactory: () => ColumnOption<Usage>[]
  }

  const router = useRouter()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const overview = reactive<{ total: number; rows: Usage[] }>({ total: 0, rows: [] })
  const listFieldAccess = ref<Api.Vms.VehicleManage.VehiclePartUsageFieldAccessMap>({})
  const effectiveFieldAccess = computed(() =>
    mergeFieldAccessMaps(listFieldAccess.value, ...overview.rows.map((row) => row.fieldAccess))
  )
  const visibleTraceabilityRows = computed(() =>
    overview.rows.filter((row) => canViewField(row.fieldAccess, 'traceabilityTag'))
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '装车零部件',
      value: overview.total,
      description: '当前筛选条件下的使用记录',
      icon: 'ri:settings-5-line'
    },
    ...(visibleTraceabilityRows.value.length
      ? [
          {
            label: '本页可见 RFID 已绑定',
            value: visibleTraceabilityRows.value.filter((row) => row.rfidTag).length,
            description: '仅统计当前有权查看的标签',
            icon: 'ri:rfid-line',
            tone: 'success' as const
          },
          {
            label: '本页可见 RFID 待绑定',
            value: visibleTraceabilityRows.value.filter((row) => !row.rfidTag).length,
            description: '仅统计当前有权查看的记录',
            icon: 'ri:link-unlink-m',
            tone: 'warning' as const
          }
        ]
      : [])
  ])

  const table: UnwrapNestedRefs<TableGroup> = reactive<TableGroup>({
    searchQuery: {
      companyName: '',
      plateNo: '',
      partType: undefined,
      categoryId: undefined,
      partName: '',
      rfidTag: '',
      status: undefined,
      createTimeRange: []
    },
    searchItems: computed<SearchFormItem[]>(() => [
      { label: '所属公司', key: 'companyName', type: 'input' },
      { label: '车牌号', key: 'plateNo', type: 'input' },
      {
        label: '零部件类型',
        key: 'partType',
        type: 'select',
        props: { options: getDictMap.value.vehiclePartType ?? [] }
      },
      {
        label: '零部件类别',
        key: 'categoryId',
        type: 'treeSelect',
        api: fetchPartsCategoryTree,
        resultField: 'data',
        labelField: 'categoryName',
        valueField: 'id',
        childrenField: 'children',
        props: { checkStrictly: true }
      },
      { label: '零部件名称', key: 'partName', type: 'input' },
      ...(isReadableFieldAccess(getFieldAccess(listFieldAccess.value, 'traceabilityTag'))
        ? [{ label: 'RFID标签', key: 'rfidTag', type: 'input' as const }]
        : []),
      {
        label: '状态',
        key: 'status',
        type: 'select',
        props: { options: getDictMap.value.vehiclePartUsageStatus ?? [] }
      },
      {
        label: '创建时间',
        key: 'createTimeRange',
        type: 'date',
        props: {
          type: 'daterange',
          valueFormat: 'YYYY-MM-DD',
          startPlaceholder: '开始日期',
          endPlaceholder: '结束日期',
          class: '!w-full'
        }
      }
    ]),
    headerActions: computed<ArtTableQueryHeaderAction[]>(() => [
      {
        type: 'add',
        permission: 'VehiclePartUsage:Add',
        onClick: () => openDialog()
      },
      {
        type: 'delete',
        permission: 'VehiclePartUsage:Delete',
        confirm: false,
        onClick: async ({ selectedRows }) => {
          const resources = selectedRows
            .filter((row): row is Usage & { id: string } => typeof row.id === 'string')
            .map((row) => ({ id: row.id, label: `${row.plateNo} / ${row.partName}` }))
          await deleteRecords({
            resources,
            permission: 'VehiclePartUsage:Delete',
            remove: () => deleteVehiclePartUsageBatch(resources.map((row) => row.id)),
            onDeleted: async () => {
              await tableQueryRef.value?.refreshRemove()
            }
          })
        }
      }
    ]),
    columnsFactory: (): ColumnOption<Usage>[] => [
      { type: 'selection', width: 50, fixed: 'left', reserveSelection: true },
      { type: 'globalIndex', label: '序号', width: 70 },
      { prop: 'companyName', label: '所属公司', minWidth: 150 },
      { prop: 'plateNo', label: '车牌号', width: 120 },
      {
        prop: 'partType',
        label: '零部件类型',
        width: 120,
        dict: { code: 'vehiclePartType', display: 'auto' }
      },
      {
        prop: 'partName',
        label: '零部件名称',
        minWidth: 170,
        link: { permission: 'VehiclePartUsage:View', onClick: viewDetail }
      },
      { prop: 'categoryName', label: '类别', minWidth: 130 },
      { prop: 'brand', label: '品牌', width: 110 },
      { prop: 'model', label: '型号', minWidth: 130 },
      ...(canViewField(effectiveFieldAccess.value, 'traceabilityTag')
        ? [{ prop: 'rfidTag', label: 'RFID标签', minWidth: 150 } as ColumnOption<Usage>]
        : []),
      ...(canViewField(effectiveFieldAccess.value, 'lifecycleLimits')
        ? ([
            {
              prop: 'enableDate',
              label: '启用日期',
              width: 120,
              formatter: (row) => (row.lifecycleLimitsMasked ? '***' : row.enableDate || '--')
            },
            {
              prop: 'warrantySummary',
              label: '质保期',
              minWidth: 200,
              formatter: formatVehiclePartWarranty
            },
            {
              prop: 'serviceYears',
              label: '使用年限（年）',
              width: 130,
              formatter: (row) => (row.lifecycleLimitsMasked ? '***' : (row.serviceYears ?? '--'))
            },
            {
              prop: 'usedYears',
              label: '已使用时长（年）',
              width: 140,
              formatter: (row) =>
                row.lifecycleLimitsMasked
                  ? '***'
                  : (getVehicleUsageYears(row.enableDate)?.toFixed(1) ?? '--')
            },
            {
              prop: 'serviceMileage',
              label: '可使用里程（公里）',
              width: 155,
              formatter: (row) => (row.lifecycleLimitsMasked ? '***' : (row.serviceMileage ?? '--'))
            },
            {
              prop: 'usedMileage',
              label: '已使用里程（公里）',
              width: 155,
              formatter: (row) => (row.lifecycleLimitsMasked ? '***' : (row.usedMileage ?? '--'))
            }
          ] as ColumnOption<Usage>[])
        : []),
      {
        prop: 'status',
        label: '状态',
        width: 100,
        dict: { code: 'vehiclePartUsageStatus', display: 'badge' }
      },
      {
        prop: 'createTime',
        label: '创建时间',
        width: 180,
        formatter: (row) => formatWithDayjs(row.createTime)
      },
      { prop: 'createBy', label: '创建人', width: 140 },
      {
        prop: 'operation',
        label: '操作',
        width: 120,
        fixed: 'right',
        formatter: (row) => (
          <div class="flex">
            <ArtButtonTable
              type="edit"
              permission="VehiclePartUsage:Edit"
              onClick={() => openDialog(row)}
            />
            <ArtButtonMore
              list={getMoreActions()}
              onClick={(item: ButtonMoreItem) => handleMoreAction(item, row)}
            />
          </div>
        )
      }
    ]
  })

  const fetchTableData = async (params: TableParams) => {
    const { from, to } = buildSupabasePageRange({
      current: params.current,
      size: params.size
    })
    const result = await fetchVehiclePartUsageList({ ...params, from, to })
    listFieldAccess.value = result.fieldAccess ?? {}
    return result
  }

  const handleTableSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (rows, response) => {
    overview.rows = rows as Usage[]
    overview.total = response.total ?? rows.length
  }

  const openDialog = (row?: Usage): void => {
    void dialogRef.value?.handleOpen(row)
  }

  const viewDetail = (row: Usage): void => {
    if (!row.id) return
    void router.push(`/vms/vehicle-manage/part-manage-detail/${row.id}`)
  }

  const getMoreActions = (): ButtonMoreItem[] => [
    {
      key: 'view',
      label: '查看',
      icon: 'ri:eye-line',
      auth: 'VehiclePartUsage:View'
    },
    {
      key: 'delete',
      label: '删除',
      icon: 'ri:delete-bin-5-line',
      auth: 'VehiclePartUsage:Delete',
      color: '#f56c6c'
    }
  ]

  const handleMoreAction = (item: ButtonMoreItem, row: Usage): void => {
    if (item.key === 'view') {
      viewDetail(row)
      return
    }
    if (item.key === 'delete') {
      void handleDelete(row)
    }
  }

  const handleSaveSuccess = (type: DialogType): void => {
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  }

  const handleDelete = async (row: Usage): Promise<void> => {
    if (!row.id) return
    await deleteRecord({
      resource: { id: row.id, label: `${row.plateNo} / ${row.partName}` },
      permission: 'VehiclePartUsage:Delete',
      remove: () => deleteVehiclePartUsage(row.id as string),
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
      }
    })
  }
</script>
