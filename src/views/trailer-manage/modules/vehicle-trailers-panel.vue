<template>
  <section class="vehicle-trailers-panel" aria-label="关联挂车">
    <ArtTableQuery
      v-if="canView"
      ref="tableQueryRef"
      v-model="searchQuery"
      :search-items="searchItems"
      :api-fn="fetchTableData"
      :columns-factory="columnsFactory"
      :header-actions="headerActions"
      :table-props="{
        rowKey: 'id',
        tableLayout: 'fixed',
        emptyText: '暂无关联挂车',
        emptyDescription: '该车辆尚未关联挂车。'
      }"
    />
    <ArtEmptyState
      v-else
      title="暂无挂车查看权限"
      description="请联系管理员开通车辆或挂车查看权限。"
    />
    <TrailerDialog ref="dialogRef" @success="refresh" />
    <MasterDataDeleteGuard ref="deleteGuardRef" @cleared="refresh" />
  </section>
</template>

<script setup lang="tsx">
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import { useAuth } from '@/hooks/core/useAuth'
  import { fetchVehicleTrailers } from '@vms/api'
  import type { TrailerRecord } from '@vms/types/trailer'
  import TrailerDialog from './trailer-dialog.vue'
  import { useTrailerDeletion } from './use-trailer-deletion'

  const props = withDefaults(defineProps<{ vehicleId: string; readOnly?: boolean }>(), {
    readOnly: false
  })
  const emit = defineEmits<{ changed: [] }>()
  const { hasAuth } = useAuth()
  const canView = computed(() =>
    ['VehicleQuery:View', 'VehicleArchive:View', 'TrailerManage:View'].some(hasAuth)
  )
  const canAdd = computed(
    () => !props.readOnly && hasAuth('VehicleArchive:Edit') && hasAuth('TrailerManage:Add')
  )
  const canEdit = computed(
    () => !props.readOnly && hasAuth('VehicleArchive:Edit') && hasAuth('TrailerManage:Edit')
  )
  const canDelete = computed(
    () => !props.readOnly && hasAuth('VehicleArchive:Edit') && hasAuth('TrailerManage:Delete')
  )
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<{
    handleOpen: (row?: TrailerRecord, vehicleId?: string) => Promise<void>
  }>()
  const { deleteGuardRef, remove } = useTrailerDeletion()
  const searchQuery = ref({ plateNo: '' })
  const searchItems: SearchFormItem[] = [{ label: '挂车车牌号', key: 'plateNo', type: 'input' }]
  const headerActions = computed<ArtTableQueryHeaderAction[]>(() =>
    canAdd.value
      ? [
          {
            permission: 'TrailerManage:Add',
            type: 'add',
            label: '添加挂车',
            onClick: () => dialogRef.value?.handleOpen(undefined, props.vehicleId)
          }
        ]
      : []
  )
  const fetchTableData = async (params: { current: number; size: number; plateNo?: string }) => {
    const result = await fetchVehicleTrailers(props.vehicleId)
    const keyword = params.plateNo?.trim().toLocaleLowerCase() ?? ''
    const rows = (result.data ?? []).filter(
      (row) => !keyword || row.plateNo.toLocaleLowerCase().includes(keyword)
    )
    return {
      data: rows.slice((params.current - 1) * params.size, params.current * params.size),
      total: rows.length,
      error: result.error
    }
  }
  const columnsFactory = (): ColumnOption<TrailerRecord>[] => [
    { type: 'globalIndex', label: '序号', width: 72 },
    { prop: 'plateNo', label: '挂车车牌号', minWidth: 145, fixed: 'left' },
    { prop: 'trailerType', label: '挂车类型', minWidth: 140 },
    {
      prop: 'ownership',
      label: '车辆归属',
      minWidth: 120,
      dict: { code: 'vehicleOwnership', display: 'auto' }
    },
    { prop: 'carrierName', label: '所属承运商', minWidth: 160 },
    { prop: 'companyName', label: '所属公司', minWidth: 160 },
    { prop: 'defaultTractorPlateNo', label: '默认牵引车', minWidth: 140 },
    { prop: 'inspectionValidUntil', label: '行驶证有效期', minWidth: 140 },
    ...(canEdit.value || canDelete.value
      ? [
          {
            prop: 'operation',
            label: '操作',
            width: 108,
            fixed: 'right' as const,
            formatter: (row: TrailerRecord) => (
              <BusinessTableRowActions row={row}>
                {canEdit.value ? (
                  <ArtButtonTable
                    type="edit"
                    permission="TrailerManage:Edit"
                    onClick={() => dialogRef.value?.handleOpen(row)}
                  />
                ) : null}
                {canDelete.value ? (
                  <ArtButtonTable
                    type="delete"
                    permission="TrailerManage:Delete"
                    onClick={() => remove(row, async () => refresh())}
                  />
                ) : null}
              </BusinessTableRowActions>
            )
          }
        ]
      : [])
  ]
  const refresh = () => {
    void tableQueryRef.value?.refreshData()
    emit('changed')
  }
  watch(() => props.vehicleId, refresh)
</script>

<style scoped lang="scss">
  .vehicle-trailers-panel {
    min-width: 0;
    min-height: 320px;
  }
</style>
