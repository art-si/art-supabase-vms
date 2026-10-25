<template>
  <div class="maintenance-record-page art-full-height min-w-0 gap-3">
    <BusinessWorkspaceHeader
      eyebrow="MAINTENANCE CONTROL"
      title="维修保养记录"
      description="统一跟踪车辆维修、保养、工期、费用与承修机构，沉淀完整的车辆健康履历。"
      icon="ri:tools-line"
      :tags="[
        { label: '维保闭环', type: 'primary' },
        { label: '成本可追踪', type: 'info' }
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
      :search-bar-props="{ span: 6, labelWidth: 100 }"
      :table-props="{
        rowKey: 'id',
        tableLayout: 'fixed',
        emptyText: '暂无维修保养记录',
        emptyDescription: '可新增维保记录，或调整车辆、维修单号、类型和创建时间后重新查询。'
      }"
      :on-success="handleTableSuccess"
      focusable
    />

    <MaintenanceRecordDialog ref="dialogRef" @success="handleSaveSuccess" />
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
    ArtTableQueryExcelColumn,
    ArtTableQueryHeaderAction,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption, DialogType } from '@/types'
  import {
    deleteVehicleMaintenance,
    deleteVehicleMaintenanceBatch,
    exportVehicleMaintenanceList,
    fetchVehicleMaintenanceList
  } from '@vms/api'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { formatWithDayjs } from '@/utils/time'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import MaintenanceRecordDialog from './modules/maintenance-record-dialog.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import {
    canViewField,
    mergeFieldAccessMaps,
    formatSensitiveNumberWithAffix
  } from '@/utils/field-permission'

  defineOptions({ name: 'VehicleMaintenance' })

  const { deleteGuardRef, deleteRecord, deleteRecords } = useRecordDeleteGuard(
    'vehicle_maintenance_record',
    '维修保养记录'
  )

  type MaintenanceRecord = Api.Vms.VehicleManage.VehicleMaintenanceRecord
  type SearchParams = Api.Vms.VehicleManage.VehicleMaintenanceSearchParams
  type TableParams = SearchParams & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  interface DialogExpose {
    handleOpen: (row?: MaintenanceRecord) => Promise<void>
  }

  interface TableGroup {
    searchQuery: SearchParams
    searchItems: ComputedRef<SearchFormItem[]>
    headerActions: ComputedRef<ArtTableQueryHeaderAction[]>
    columnsFactory: () => ColumnOption<MaintenanceRecord>[]
  }

  const router = useRouter()
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<DialogExpose>()
  const maintenanceTypeOptions = useDictionaryOptions('vehicleMaintenanceType')
  const overview = reactive<{ total: number; rows: MaintenanceRecord[] }>({ total: 0, rows: [] })
  const listFieldAccess = ref<Api.Vms.VehicleManage.VehicleMaintenanceFieldAccessMap>({})
  const effectiveFieldAccess = computed(() =>
    mergeFieldAccessMaps(listFieldAccess.value, ...overview.rows.map((row) => row.fieldAccess))
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '维保记录',
      value: overview.total,
      description: '当前筛选条件下的维修保养记录',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '本页已完工',
      value: overview.rows.filter((row) => row.endTime).length,
      description: '已登记结束时间',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    },
    {
      label: canViewField(effectiveFieldAccess.value, 'totalCost') ? '本页费用待核' : '本页进行中',
      value: canViewField(effectiveFieldAccess.value, 'totalCost')
        ? overview.rows.filter((row) => row.costAmount === null || row.costAmount === undefined)
            .length
        : overview.rows.filter((row) => !row.endTime).length,
      description: canViewField(effectiveFieldAccess.value, 'totalCost')
        ? '尚未登记维保费用'
        : '尚未登记结束时间',
      icon: 'ri:money-cny-circle-line',
      tone: 'warning'
    }
  ])

  const createInitialSearch = (): SearchParams => ({
    companyName: '',
    plateNo: '',
    maintenanceNo: '',
    maintenanceType: '',
    createTimeRange: []
  })

  const dateRangeProps = {
    type: 'daterange',
    valueFormat: 'YYYY-MM-DD',
    startPlaceholder: '开始日期',
    endPlaceholder: '结束日期',
    class: '!w-full'
  }

  const table: UnwrapNestedRefs<TableGroup> = reactive<TableGroup>({
    searchQuery: createInitialSearch(),
    searchItems: computed<SearchFormItem[]>(() => [
      { label: '所属公司', key: 'companyName', type: 'input' },
      { label: '车牌号', key: 'plateNo', type: 'input' },
      ...(canViewField(effectiveFieldAccess.value, 'maintenanceIdentifiers')
        ? [{ label: '维修单号', key: 'maintenanceNo', type: 'input' }]
        : []),
      {
        label: '维修类型',
        key: 'maintenanceType',
        type: 'select',
        props: { options: maintenanceTypeOptions }
      },
      { label: '创建时间', key: 'createTimeRange', type: 'date', props: dateRangeProps }
    ]),
    headerActions: computed<ArtTableQueryHeaderAction[]>(() => [
      { type: 'add', permission: 'VehicleMaintenance:Add', onClick: () => openDialog() },
      {
        type: 'export',
        permission: 'VehicleMaintenance:Export',
        exportFilename: '维修保养记录',
        exportSheetName: '维修保养记录',
        exportColumns: maintenanceExcelColumns.value,
        exportApi: ({ selectedIds, searchParams, maxRows }) =>
          exportVehicleMaintenanceList({
            ...(searchParams as SearchParams),
            ids: selectedIds.map(String),
            maxRows
          })
      },
      {
        type: 'delete',
        permission: 'VehicleMaintenance:Delete',
        confirm: false,
        onClick: async ({ selectedRows }) => {
          const resources = selectedRows.map((row) => ({
            id: String(row.id ?? ''),
            label: String(row.maintenanceNo || row.plateNo || '维修保养记录')
          }))
          await deleteRecords({
            resources,
            permission: 'VehicleMaintenance:Delete',
            remove: () => deleteVehicleMaintenanceBatch(resources.map((resource) => resource.id)),
            onDeleted: async () => {
              await tableQueryRef.value?.refreshRemove()
            }
          })
        }
      }
    ]),
    columnsFactory: () => [
      { type: 'selection', width: 50, fixed: 'left', reserveSelection: true },
      { type: 'globalIndex', label: '序号', width: 72 },
      { prop: 'companyName', label: '所属公司', minWidth: 150 },
      {
        prop: 'plateNo',
        label: '车牌号',
        width: 120,
        link: { permission: 'VehicleMaintenance:View', onClick: viewDetail }
      },
      ...(canViewField(effectiveFieldAccess.value, 'maintenanceIdentifiers')
        ? [{ prop: 'maintenanceNo', label: '维修单号', minWidth: 150 }]
        : []),
      {
        prop: 'maintenanceType',
        label: '维修类型',
        width: 110,
        dict: { code: 'vehicleMaintenanceType', display: 'auto' }
      },
      { prop: 'initiator', label: '发起人', width: 120 },
      {
        prop: 'tripStartTime',
        label: '行驶时间',
        minWidth: 290,
        formatter: (row) => formatDrivingTime(row)
      },
      { prop: 'driverName', label: '司机', width: 110 },
      { prop: 'waybillNo', label: '运单号', minWidth: 150 },
      {
        prop: 'departureMileage',
        label: '发车里程（KM）',
        width: 145,
        align: 'right',
        formatter: (row) => formatMileage(row.departureMileage)
      },
      {
        prop: 'arrivalMileage',
        label: '收车里程（KM）',
        width: 145,
        align: 'right',
        formatter: (row) => formatMileage(row.arrivalMileage)
      },
      {
        prop: 'drivingMileage',
        label: '行驶里程（KM）',
        width: 145,
        align: 'right',
        formatter: (row) => formatMileage(row.drivingMileage)
      },
      {
        prop: 'startTime',
        label: '开始时间',
        width: 170,
        formatter: (row) => formatWithDayjs(row.startTime)
      },
      {
        prop: 'endTime',
        label: '结束时间',
        width: 170,
        formatter: (row) => formatWithDayjs(row.endTime)
      },
      ...(canViewField(effectiveFieldAccess.value, 'totalCost')
        ? [
            {
              prop: 'costAmount',
              label: '费用金额',
              width: 120,
              align: 'right',
              formatter: (row: MaintenanceRecord) =>
                formatSensitiveNumberWithAffix(row.costAmount, { suffix: ' 元' })
            }
          ]
        : []),
      { prop: 'workshop', label: '维修厂', minWidth: 160 },
      {
        prop: 'createTime',
        label: '创建时间',
        width: 170,
        formatter: (row) => formatWithDayjs(row.createTime)
      },
      { prop: 'createBy', label: '创建人', width: 130 },
      {
        prop: 'operation',
        label: '操作',
        width: 120,
        fixed: 'right',
        formatter: (row) => (
          <div class="flex">
            <ArtButtonTable
              type="edit"
              permission="VehicleMaintenance:Edit"
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

  const maintenanceExcelColumns = computed<ArtTableQueryExcelColumn[]>(() => [
    { key: 'companyName', title: '所属公司' },
    { key: 'plateNo', title: '车牌号', required: true },
    ...(canViewField(effectiveFieldAccess.value, 'maintenanceIdentifiers')
      ? [{ key: 'maintenanceNo', title: '维修单号', required: true }]
      : []),
    { key: 'maintenanceType', title: '维修类型' },
    { key: 'initiator', title: '发起人' },
    { key: 'tripStartTime', title: '行驶时间' },
    { key: 'driverName', title: '司机' },
    { key: 'waybillNo', title: '运单号' },
    { key: 'departureMileage', title: '发车里程（KM）' },
    { key: 'arrivalMileage', title: '收车里程（KM）' },
    { key: 'drivingMileage', title: '行驶里程（KM）' },
    { key: 'startTime', title: '开始时间' },
    { key: 'endTime', title: '结束时间' },
    ...(canViewField(effectiveFieldAccess.value, 'totalCost')
      ? [{ key: 'costAmount', title: '费用金额' }]
      : []),
    { key: 'workshop', title: '维修厂' },
    { key: 'remark', title: '备注' }
  ])

  const fetchTableData = async (params: TableParams) => {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const result = await fetchVehicleMaintenanceList({ ...params, from, to })
    listFieldAccess.value = result.fieldAccess ?? {}
    return result
  }

  const handleTableSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (rows, response) => {
    overview.rows = rows as MaintenanceRecord[]
    overview.total = response.total ?? rows.length
  }

  const openDialog = (row?: MaintenanceRecord): void => {
    void dialogRef.value?.handleOpen(row)
  }

  const viewDetail = (row: MaintenanceRecord): void => {
    if (!row.id) return
    void router.push(`/vms/vehicle-manage/maintenance-record-detail/${row.id}`)
  }
  const getMoreActions = (): ButtonMoreItem[] => [
    { key: 'view', label: '查看', icon: 'ri:eye-line', auth: 'VehicleMaintenance:View' },
    {
      key: 'delete',
      label: '删除',
      icon: 'ri:delete-bin-5-line',
      auth: 'VehicleMaintenance:Delete',
      color: '#f56c6c'
    }
  ]

  const handleMoreAction = (item: ButtonMoreItem, row: MaintenanceRecord): void => {
    if (item.key === 'view') {
      viewDetail(row)
      return
    }
    if (item.key === 'delete') void handleDelete(row)
  }

  const handleSaveSuccess = (type: DialogType): void => {
    void (type === 'add'
      ? tableQueryRef.value?.refreshCreate()
      : tableQueryRef.value?.refreshUpdate())
  }

  const handleDelete = async (row: MaintenanceRecord): Promise<void> => {
    if (!row.id) return
    const id = row.id
    await deleteRecord({
      resource: { id, label: row.maintenanceNo || row.plateNo || '维修保养记录' },
      permission: 'VehicleMaintenance:Delete',
      remove: () => deleteVehicleMaintenance(id),
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
      }
    })
  }

  const formatMileage = (value?: number | string | null): string =>
    formatSensitiveNumberWithAffix(value, { suffix: ' KM' })

  const formatDrivingTime = (row: MaintenanceRecord): string => {
    if (!row.tripStartTime) return '--'
    if (row.tripStartTime === '***') return '***'
    const start = formatWithDayjs(row.tripStartTime)
    const end =
      row.tripEndTime && row.tripEndTime !== '***' ? formatWithDayjs(row.tripEndTime) : '--'
    return `${start} ~ ${end}`
  }
</script>
