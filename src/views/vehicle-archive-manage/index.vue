<template>
  <div class="vehicle-archive-manage art-full-height">
    <BusinessWorkspaceHeader
      eyebrow="FLEET ASSET CONTROL"
      title="车辆档案管理"
      description="统一完成车辆档案录入、维护与审批状态跟踪；审批处理集中在审批工作台。"
      icon="ri:truck-line"
      :tags="[
        { label: '录入管理一体', type: 'primary' },
        { label: '流程统一处理', type: 'info' }
      ]"
      :metrics="workspaceMetrics"
    >
      <template #actions>
        <BusinessTableWorkspaceActions :table="tableQueryRef" />
      </template>
    </BusinessWorkspaceHeader>

    <div class="vehicle-archive-manage__workspace">
      <ArtSectionCard
        class="vehicle-archive-manage__navigation"
        title="车辆分类"
        subtitle="按车辆归属和车型筛选"
        aria-label="按车辆归属和车型筛选"
        :show-scrollbar="false"
        body-class="vehicle-archive-manage__navigation-body"
        :loading="navigationLoading"
        loading-mode="mask"
        :error="navigationError"
        error-title="车辆分类加载失败"
        :empty="!navigationLoading && !navigationError && !navigationRows.length"
        empty-title="暂无车辆档案"
        empty-description="新增车辆档案后，会按车辆归属和车型显示在这里。"
        :min-height="0"
        @retry="loadNavigation"
      >
        <template #actions>
          <ArtTreeExpandToggle
            :tree="navigationTreeRef"
            :data="navigationTree"
            node-key="key"
            label="车辆分类"
            :default-expanded="navigationRows.length < 24"
          />
          <ArtIconButton icon="ri:refresh-line" label="刷新车辆分类" @click="loadNavigation" />
        </template>

        <ElInput
          v-model="navigationKeyword"
          clearable
          placeholder="搜索归属或车型"
          aria-label="搜索车辆分类"
        >
          <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
        </ElInput>

        <button
          type="button"
          class="vehicle-archive-manage__navigation-all"
          :class="{ 'is-current': navigationKey === 'all' }"
          @click="handleNavigationClick()"
        >
          <span class="vehicle-archive-manage__navigation-icon" aria-hidden="true">
            <ArtSvgIcon icon="ri:apps-2-line" />
          </span>
          <span class="vehicle-archive-manage__navigation-copy">
            <strong>全部车辆</strong>
            <small>{{ navigationRows.length }} 辆车</small>
          </span>
          <ArtSvgIcon v-if="navigationKey === 'all'" icon="ri:check-line" aria-hidden="true" />
        </button>

        <ElScrollbar class="vehicle-archive-manage__navigation-scroll">
          <ElTree
            ref="navigationTreeRef"
            :data="navigationTree"
            node-key="key"
            :default-expand-all="navigationRows.length < 24"
            highlight-current
            :expand-on-click-node="false"
            :current-node-key="navigationKey === 'all' ? undefined : navigationKey"
            :filter-node-method="filterNavigationNode"
            @node-click="handleNavigationClick"
          >
            <template #default="{ data }">
              <span class="vehicle-archive-manage__navigation-node">
                <ArtSvgIcon
                  class="vehicle-archive-manage__navigation-node-icon"
                  :icon="data.vehicleType ? 'ri:truck-line' : 'ri:folder-3-line'"
                  aria-hidden="true"
                />
                <span :title="data.label">{{ data.label }}</span>
                <small :aria-label="`${data.count} 辆车`">{{ data.count }}</small>
              </span>
            </template>
            <template #empty>
              <ArtEmptyState
                title="未找到匹配项"
                description="请调整关键词或清空筛选条件。"
                size="compact"
                :visual-size="64"
              />
            </template>
          </ElTree>
        </ElScrollbar>
      </ArtSectionCard>

      <ArtTableQuery
        ref="tableQueryRef"
        v-model="table.searchQuery"
        :search-items="table.searchItems"
        :api-fn="fetchTableData"
        :columns-factory="table.columnsFactory"
        :header-actions="table.headerActions"
        header-actions-placement="workspace"
        :search-bar-props="table.searchBarProps"
        :table-props="table.props"
        :immediate="table.immediate"
        :on-success="handleTableSuccess"
        focus-scope-selector=".vehicle-archive-manage__workspace"
        focusable
      />
    </div>

    <MasterDataDeleteGuard ref="deleteGuardRef" @cleared="handleDeleteGuardCleared" />
    <WorkflowBusinessHistoryDrawer ref="approvalHistoryRef" />
    <VehicleQuickCreateDialog ref="quickCreateRef" @created="handleQuickCreated" />
  </div>
</template>

<script setup lang="tsx">
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import { getFriendlySupabaseErrorMessage } from '@/utils/supabase'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import type { ComputedRef, UnwrapNestedRefs } from 'vue'
  import { ElMessage, ElTag, ElTree } from 'element-plus'
  import { groupBy } from 'lodash-es'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import { RouterLink } from 'vue-router'
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
  import type { ColumnOption } from '@/types'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { formatWithDayjs } from '@/utils/time'
  import {
    deleteVehicleArchive,
    exportVehicleArchiveList,
    fetchCarrierOptions,
    fetchVehicleArchiveList,
    fetchVehicleArchiveNavigation,
    importVehicleArchives,
    type VehicleArchiveNavigationItem,
    type VmsCarrierReference
  } from '@vms/api'
  import MasterDataDeleteGuard, {
    type MasterDataDeleteGuardOpenOptions
  } from '@/components/business/master-data-delete-guard/index.vue'
  import WorkflowBusinessHistoryDrawer from '@/components/business/workflow-business-history/workflow-business-history-drawer.vue'
  import type { WorkflowBusinessHistoryDrawerExpose } from '@/components/business/workflow-business-history/types'
  import { useUserStore } from '@/store/modules/user'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { useAuth } from '@/hooks/core/useAuth'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import { canViewField, mergeFieldAccessMaps } from '@/utils/field-permission'
  import VehicleQuickCreateDialog from './modules/vehicle-quick-create-dialog.vue'
  import {
    vehicleCertificateRiskDisplay,
    vehicleCertificateRiskNeedsAttention
  } from './modules/vehicle-certificate-risk'

  defineOptions({ name: 'VehicleArchiveManage' })

  const { deleteRecords } = useRecordDeleteGuard('mdm_vehicle', '车辆档案')
  const { hasAllAuth, hasAuth } = useAuth()

  type VehicleArchive = Api.Vms.ArchiveManage.VehicleArchive
  type CarrierOption = VmsCarrierReference
  type SearchParams = Api.Vms.ArchiveManage.VehicleArchiveSearchParams
  type TableParams = SearchParams & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  interface MasterDataDeleteGuardExpose {
    inspect: (options: MasterDataDeleteGuardOpenOptions) => Promise<boolean>
  }

  interface TableGroup {
    searchQuery: SearchParams
    searchItems: ComputedRef<SearchFormItem[]>
    headerActions: ComputedRef<ArtTableQueryHeaderAction[]>
    columnsFactory: () => ColumnOption<VehicleArchive>[]
    immediate: boolean
    searchBarProps: {
      span: number
      labelWidth: number
    }
    props: {
      rowKey: string
      tableLayout: 'fixed'
      emptyText: string
      emptyDescription: string
      rowClassName: ({ row }: { row: Record<string, unknown>; rowIndex: number }) => string
    }
  }

  const router = useRouter()
  const route = useRoute()
  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const { getDictMap } = storeToRefs(userStore)
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const deleteGuardRef = ref<MasterDataDeleteGuardExpose>()
  const approvalHistoryRef = ref<WorkflowBusinessHistoryDrawerExpose>()
  const quickCreateRef = ref<{ handleOpen: () => Promise<void> }>()
  const initialCarrierId = String(route.query.carrierId || '')
  const initialRecordId = String(route.query.recordId || '')
  const overview = reactive<{ total: number; rows: VehicleArchive[] }>({
    total: 0,
    rows: []
  })
  interface NavigationNode {
    key: string
    label: string
    count: number
    ownership?: string
    vehicleType?: string
    children?: NavigationNode[]
    searchText?: string
  }
  const navigationRows = ref<VehicleArchiveNavigationItem[]>([])
  const navigationTreeRef = ref<InstanceType<typeof ElTree>>()
  const navigationKeyword = ref('')
  const navigationLoading = ref(false)
  const navigationError = shallowRef<Error | null>(null)
  const navigationKey = ref('all')
  const selectedNavigation = ref<Pick<NavigationNode, 'ownership' | 'vehicleType'>>({})
  const navigationIds = computed(() =>
    navigationRows.value
      .filter(
        (row) =>
          (!selectedNavigation.value.ownership ||
            (row.vehicleOwnership || 'unassigned') === selectedNavigation.value.ownership) &&
          (!selectedNavigation.value.vehicleType ||
            (row.vehicleType || 'unassigned') === selectedNavigation.value.vehicleType)
      )
      .map((row) => row.id)
  )
  const navigationTree = computed<NavigationNode[]>(() =>
    Object.entries(
      groupBy(navigationRows.value, (row) => row.vehicleOwnership || 'unassigned')
    ).map(([ownership, rows]) => {
      const label =
        userStore.getDictItemByValue('vehicleOwnership', ownership)?.label ??
        (ownership === 'unassigned' ? '归属未设置' : ownership)
      const children = Object.entries(groupBy(rows, (row) => row.vehicleType || 'unassigned')).map(
        ([vehicleType, typeRows]) => {
          const typeLabel =
            userStore.getDictItemByValue('vehicleType', vehicleType)?.label ??
            (vehicleType === 'unassigned' ? '车型未设置' : vehicleType)
          return {
            key: `type:${ownership}:${vehicleType}`,
            label: typeLabel,
            count: typeRows.length,
            ownership,
            vehicleType,
            searchText: `${label} ${typeLabel}`
          }
        }
      )
      return {
        key: `ownership:${ownership}`,
        label,
        count: rows.length,
        ownership,
        children,
        searchText: `${label} ${children.map((child) => child.label).join(' ')}`
      }
    })
  )

  const filterNavigationNode = (keyword: string, node: Record<string, unknown>): boolean =>
    !keyword ||
    String(node.searchText ?? '')
      .toLocaleLowerCase()
      .includes(keyword.toLocaleLowerCase())

  watch(navigationKeyword, (keyword) => navigationTreeRef.value?.filter(keyword.trim()))
  watch(
    navigationTree,
    async () => {
      await nextTick()
      navigationTreeRef.value?.filter(navigationKeyword.value.trim())
    },
    { flush: 'post' }
  )

  const loadNavigation = async (): Promise<void> => {
    navigationLoading.value = true
    navigationError.value = null
    try {
      const result = await fetchVehicleArchiveNavigation()
      if (result.error) throw result.error
      navigationRows.value = result.data ?? []
    } catch (error) {
      navigationError.value = error instanceof Error ? error : new Error('车辆分类加载失败')
    } finally {
      navigationLoading.value = false
    }
  }

  const handleNavigationClick = (node?: NavigationNode): void => {
    navigationKey.value = node?.key ?? 'all'
    selectedNavigation.value = { ownership: node?.ownership, vehicleType: node?.vehicleType }
    if (!node) navigationTreeRef.value?.setCurrentKey(undefined)
    tableQueryRef.value?.clearSelection()
    void tableQueryRef.value?.refreshContext()
  }
  const listFieldAccess = ref<Api.Vms.ArchiveManage.VehicleArchiveFieldAccessMap>({})
  const effectiveFieldAccess = computed(() =>
    mergeFieldAccessMaps(listFieldAccess.value, ...overview.rows.map((row) => row.fieldAccess))
  )
  const operatingCount = computed(
    () => overview.rows.filter((row) => row.operationStatus === 'operating').length
  )
  const incompleteCount = computed(
    () =>
      overview.rows.filter(
        (row) =>
          row.auditStatus === 'draft' ||
          !row.companyName?.trim() ||
          !row.manufacturer?.trim() ||
          (canViewField(row.fieldAccess, 'vehicleIdentifiers') && !row.vin?.trim())
      ).length
  )
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前结果',
      value: overview.total,
      description: '随筛选条件实时更新',
      icon: 'ri:database-2-line'
    },
    {
      label: '本页营运中',
      value: operatingCount.value,
      description: '当前页可投入运营车辆',
      icon: 'ri:route-line',
      tone: 'success'
    },
    {
      label: '本页资料待完善',
      value: incompleteCount.value,
      description: canViewField(effectiveFieldAccess.value, 'vehicleIdentifiers')
        ? '草稿或公司、厂商、VIN 信息缺失'
        : '草稿或公司、厂商信息缺失',
      icon: 'ri:file-warning-line',
      tone: 'warning'
    }
  ])

  const archiveExcelColumns = computed<ArtTableQueryExcelColumn[]>(() => [
    { key: 'companyName', title: '所属公司' },
    { key: 'plateNo', title: '车牌号', required: true },
    { key: 'vehicleType', title: '车型', required: true },
    { key: 'manufacturer', title: '车辆厂商' },
    ...(canViewField(effectiveFieldAccess.value, 'vehicleIdentifiers')
      ? [
          { key: 'chassisNo', title: '底盘号' },
          { key: 'vin', title: '车架号（VIN）' }
        ]
      : []),
    { key: 'operationStatus', title: '营运状态' },
    { key: 'auditStatus', title: '审核状态' },
    { key: 'createTime', title: '创建时间' },
    { key: 'createBy', title: '创建人' }
  ])

  const archiveImportColumns = computed<ArtTableQueryExcelColumn[]>(() => [
    ...(tenantScopeStore.isAllTenants
      ? [{ key: 'tenantCode', title: '所属租户编码', required: true }]
      : []),
    { key: 'plateNo', title: '车牌号', required: true },
    { key: 'vehicleType', title: '车型', required: true },
    { key: 'vehicleOwnership', title: '车辆归属' },
    { key: 'manufacturer', title: '车辆厂商' },
    { key: 'vin', title: '车架号（VIN）' },
    { key: 'operationStatus', title: '营运状态' }
  ])

  const normalizeImportDictionaryValue = (code: string, value: unknown): string => {
    const text = String(value ?? '').trim()
    return (
      getDictMap.value[code]?.find((item) => item.label === text || item.value === text)?.value ??
      text
    )
  }

  const parseImportRows = async (rows: Array<Record<string, unknown>>) => {
    await Promise.all(
      ['vehicleType', 'vehicleOwnership', 'vehicleOperationStatus'].map((code) =>
        userStore.ensureDictLoaded(code)
      )
    )
    if (tenantScopeStore.isAllTenants) await tenantScopeStore.loadTenantOptions()
    if (rows.length > 500) throw new Error('一次最多导入 500 条车辆档案')
    return rows.map((row, index) => {
      const read = (key: string, title: string) => String(row[title] ?? row[key] ?? '').trim()
      const plateNo = read('plateNo', '车牌号')
      const vehicleType = read('vehicleType', '车型')
      if (!plateNo || !vehicleType) throw new Error(`第 ${index + 2} 行缺少车牌号或车型`)
      const tenantCode = read('tenantCode', '所属租户编码')
      const tenantId = tenantScopeStore.isAllTenants
        ? tenantScopeStore.tenantOptions.find((tenant) => tenant.tenantCode === tenantCode)?.id
        : tenantScopeStore.effectiveTenantId
      if (!tenantId) throw new Error(`第 ${index + 2} 行所属租户编码无效`)
      return {
        tenantId,
        plateNo,
        vehicleType: normalizeImportDictionaryValue('vehicleType', vehicleType),
        vehicleOwnership:
          normalizeImportDictionaryValue(
            'vehicleOwnership',
            read('vehicleOwnership', '车辆归属')
          ) || null,
        manufacturer: read('manufacturer', '车辆厂商') || null,
        vin: read('vin', '车架号（VIN）') || null,
        operationStatus:
          normalizeImportDictionaryValue(
            'vehicleOperationStatus',
            read('operationStatus', '营运状态')
          ) || 'operating'
      }
    })
  }

  const withSelectedCarrierOption = async (result: unknown) => {
    const carrierResult = result as Awaited<ReturnType<typeof fetchCarrierOptions>>
    const selectedCarrierId = table.searchQuery.carrierId
    const options = carrierResult.data ?? []

    if (!selectedCarrierId || options.some((option) => option.id === selectedCarrierId)) {
      return carrierResult
    }

    const selectedResult = await fetchCarrierOptions({ ids: [selectedCarrierId] })
    const carrier = selectedResult.data?.[0]
    if (!carrier?.id) return carrierResult

    return {
      ...carrierResult,
      data: [carrier as CarrierOption, ...options]
    }
  }

  const table: UnwrapNestedRefs<TableGroup> = reactive<TableGroup>({
    searchQuery: {
      carrierId: initialCarrierId,
      recordId: initialRecordId,
      companyName: '',
      plateNo: '',
      manufacturer: '',
      vin: '',
      operationStatus: '',
      auditStatus: undefined
    },
    searchItems: computed<SearchFormItem[]>(() => [
      {
        label: '所属承运商',
        key: 'carrierId',
        type: 'select',
        api: fetchCarrierOptions,
        afterFetch: withSelectedCarrierOption,
        resultField: 'data',
        labelField: 'companyName',
        valueField: 'id',
        labelFn: (option) => {
          const carrier = option as CarrierOption
          return carrier.carrierCode
            ? `${carrier.companyName}（${carrier.carrierCode}）`
            : carrier.companyName
        },
        props: {
          clearable: true,
          filterable: true,
          placeholder: '请选择承运商'
        }
      },
      { label: '车牌号', key: 'plateNo', type: 'input', props: { clearable: true } },
      { label: '车辆厂商', key: 'manufacturer', type: 'input', props: { clearable: true } },
      ...(canViewField(effectiveFieldAccess.value, 'vehicleIdentifiers')
        ? [
            {
              label: '车架号（VIN）',
              key: 'vin',
              type: 'input' as const,
              props: { clearable: true }
            }
          ]
        : []),
      {
        label: '营运状态',
        key: 'operationStatus',
        type: 'select',
        props: {
          options: getDictMap.value.vehicleOperationStatus ?? [],
          clearable: true
        }
      },
      {
        label: '审核状态',
        key: 'auditStatus',
        type: 'select',
        props: {
          options: getDictMap.value.vehicleAuditStatus ?? [],
          clearable: true
        }
      }
    ]),
    headerActions: computed<ArtTableQueryHeaderAction[]>(() => [
      {
        type: 'add',
        permission: 'VehicleArchive:Add',
        onClick: () => openCreatePage()
      },
      ...(hasAllAuth(['VehicleArchive:Import', 'VehicleArchive:Add'])
        ? [
            {
              type: 'import' as const,
              permission: 'VehicleArchive:Import',
              importColumns: archiveImportColumns.value,
              importTransformer: parseImportRows,
              importApi: async (rows: Array<Record<string, unknown>>) => {
                const result = await importVehicleArchives(rows)
                if (result.error) throw result.error
                await loadNavigation()
              },
              onImportSuccess: (rows: Array<Record<string, unknown>>) => {
                ElMessage.success(`成功导入 ${rows.length} 条车辆档案`)
              },
              onImportError: (error: Error) => {
                ElMessage.error(getFriendlySupabaseErrorMessage(error, '车辆档案导入失败'))
              }
            }
          ]
        : []),
      {
        type: 'export',
        permission: 'VehicleArchive:Export',
        exportFilename: '车辆档案',
        exportSheetName: '车辆档案',
        exportColumns: () => archiveExcelColumns.value,
        exportApi: async ({ selectedIds, searchParams, maxRows }) => {
          if (navigationKey.value !== 'all' && !navigationIds.value.length) {
            return { data: [], total: 0, fieldAccess: listFieldAccess.value }
          }
          const result = await exportVehicleArchiveList({
            ...(searchParams as SearchParams),
            ids: selectedIds.length
              ? selectedIds.map(String)
              : navigationKey.value === 'all'
                ? undefined
                : navigationIds.value,
            maxRows
          })
          syncVehicleFieldAccess(result)
          return result
        }
      }
    ]),
    immediate: !initialCarrierId && !initialRecordId,
    columnsFactory: (): ColumnOption<VehicleArchive>[] => [
      { type: 'globalIndex', label: '序号', width: 64 },
      {
        prop: 'vehicleIdentity',
        label: '车辆档案',
        minWidth: 250,
        formatter: (row) => renderVehicleIdentity(row)
      },
      {
        prop: 'ownership',
        label: '资产归属',
        minWidth: 190,
        formatter: (row) => renderOwnership(row)
      },
      {
        prop: 'vehicleType',
        label: '车型',
        width: 120,
        dict: { code: 'vehicleType', display: 'auto' }
      },
      {
        prop: 'operationStatus',
        label: '营运状态',
        width: 110,
        dict: { code: 'vehicleOperationStatus', display: 'auto' }
      },
      {
        prop: 'certificateRisk',
        label: '证件状态',
        width: 162,
        formatter: (row) => renderCertificateRisk(row)
      },
      {
        prop: 'auditStatus',
        label: '审核状态',
        width: 110,
        dict: { code: 'vehicleAuditStatus', display: 'auto' }
      },
      {
        prop: 'updateTime',
        label: '最近更新',
        width: 168,
        formatter: (row) => formatWithDayjs(row.updateTime || row.createTime)
      },
      {
        prop: 'operation',
        label: '操作',
        width: 164,
        fixed: 'right',
        formatter: (row) => (
          <div class="vehicle-archive-manage__operation">
            <ArtButtonTable
              type="edit"
              permission="VehicleArchive:Edit"
              label={row.auditStatus === 'draft' ? '完善资料' : '编辑'}
              showLabel={row.auditStatus === 'draft'}
              onClick={() => openEditPage(row)}
            />
            <ArtButtonMore
              list={getMoreActions()}
              onClick={(item: ButtonMoreItem) => handleMoreAction(item, row)}
            />
          </div>
        )
      }
    ],
    searchBarProps: {
      span: 8,
      labelWidth: 90
    },
    props: {
      rowKey: 'id',
      tableLayout: 'fixed',
      emptyText: '暂无符合条件的车辆档案',
      emptyDescription: '可调整筛选条件，或新增车辆档案后完善资料。',
      rowClassName: ({ row }: { row: Record<string, unknown>; rowIndex: number }) =>
        row.certificateRisk === 'expired' ? 'vehicle-archive-manage__expired' : ''
    }
  })

  onMounted(async () => {
    await tenantScopeStore.loadTenantOptions()
    await Promise.all(
      ['vehicleOwnership', 'vehicleType', 'vehicleOperationStatus', 'vehicleAuditStatus'].map(
        (code) => userStore.ensureDictLoaded(code)
      )
    )
    await loadNavigation()
    if (!initialCarrierId && !initialRecordId) return
    await nextTick()
    await tableQueryRef.value?.getData()
  })

  watch(
    () => route.fullPath,
    async () => {
      const carrierId = String(route.query.carrierId || '')
      const recordId = String(route.query.recordId || '')
      if (table.searchQuery.carrierId === carrierId && table.searchQuery.recordId === recordId) {
        return
      }
      Object.assign(table.searchQuery, { carrierId, recordId })
      await nextTick()
      await tableQueryRef.value?.getData()
    },
    { flush: 'post' }
  )

  onActivated(() => {
    void loadNavigation()
    void tableQueryRef.value?.getData()
  })

  const fetchTableData = async (params: TableParams) => {
    if (navigationKey.value !== 'all' && !navigationIds.value.length) {
      return { data: [], total: 0, fieldAccess: listFieldAccess.value }
    }
    const { from, to } = buildSupabasePageRange({
      current: params.current,
      size: params.size
    })
    const result = await fetchVehicleArchiveList({
      ...params,
      ids: navigationKey.value === 'all' ? undefined : navigationIds.value,
      from,
      to
    })
    syncVehicleFieldAccess(result)
    return result
  }

  const syncVehicleFieldAccess = (result: {
    fieldAccess?: Api.Vms.ArchiveManage.VehicleArchiveFieldAccessMap
    data?: VehicleArchive[] | null
  }): void => {
    listFieldAccess.value = result.fieldAccess ?? {}
  }

  const handleTableSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (rows, response) => {
    overview.rows = rows as VehicleArchive[]
    overview.total = response.total ?? rows.length
  }

  const renderVehicleIdentity = (row: VehicleArchive) => {
    const riskDisplay = vehicleCertificateRiskDisplay(row)
    return (
      <div class="vehicle-archive-manage__vehicle-cell">
        <div>
          {row.id ? (
            <RouterLink
              class="vehicle-archive-manage__plate-link"
              to={`/vms/vehicle-archive-detail/${row.id}`}
              title={`查看车辆 ${row.plateNo || '未录入车牌'} 详情`}
            >
              {row.plateNo || '未录入车牌'}
            </RouterLink>
          ) : (
            <strong>{row.plateNo || '未录入车牌'}</strong>
          )}
          {vehicleCertificateRiskNeedsAttention(row.certificateRisk) ? (
            <ElTag
              class="vehicle-archive-manage__risk-flag"
              type={riskDisplay.tone}
              effect="light"
              size="small"
            >
              {riskDisplay.label}
            </ElTag>
          ) : null}
          <span class="vehicle-archive-manage__manufacturer" title={row.manufacturer}>
            {row.manufacturer || '厂商待补充'}
          </span>
        </div>
        {canViewField(row.fieldAccess, 'vehicleIdentifiers') ? (
          <small title={row.vin}>{row.vin || 'VIN 待补充'}</small>
        ) : null}
      </div>
    )
  }

  const renderCertificateRisk = (row: VehicleArchive) => {
    const display = vehicleCertificateRiskDisplay(row)
    const content = (
      <span class="vehicle-archive-manage__certificate-content">
        <ElTag type={display.tone} effect="light" size="small">
          {display.label}
        </ElTag>
        <small title={display.detail}>{display.detail}</small>
      </span>
    )

    return row.id && hasAuth('CertificateCenter:View') ? (
      <RouterLink
        class="vehicle-archive-manage__certificate-link"
        to={{
          path: '/vms/certificate-center',
          query: { subjectType: 'vehicle', subjectId: row.id }
        }}
        title={`查看 ${row.plateNo || '车辆'} 的证件`}
      >
        {content}
      </RouterLink>
    ) : (
      content
    )
  }

  const renderOwnership = (row: VehicleArchive) => (
    <div class="vehicle-archive-manage__ownership">
      <strong title={row.companyName}>{row.companyName || '所属公司待补充'}</strong>
      <small>
        {row.carrier?.carrierCode
          ? `承运商编码 ${row.carrier.carrierCode}`
          : row.selfNo
            ? `自编号 ${row.selfNo}`
            : '资产编号待补充'}
      </small>
    </div>
  )

  const openCreatePage = (): void => {
    void quickCreateRef.value?.handleOpen()
  }

  const handleQuickCreated = (id: string): void => {
    void loadNavigation()
    void tableQueryRef.value?.getData()
    void router.push(`/vms/vehicle-archive-edit/${id}`)
  }

  const openDetailPage = (row: VehicleArchive): void => {
    if (!row.id) return
    void router.push(`/vms/vehicle-archive-detail/${row.id}`)
  }

  const openEditPage = (row: VehicleArchive): void => {
    if (!row.id) return
    void router.push(`/vms/vehicle-archive-edit/${row.id}`)
  }

  const openCopyPage = (row: VehicleArchive): void => {
    if (!row.id) return
    void router.push({ path: '/vms/vehicle-archive-edit', query: { copyFrom: row.id } })
  }

  const getMoreActions = (): ButtonMoreItem[] => [
    {
      key: 'view',
      label: '查看',
      icon: 'ri:eye-line',
      auth: 'VehicleArchive:View'
    },
    ...(hasAllAuth(['VehicleArchive:Copy', 'VehicleArchive:Add'])
      ? [{ key: 'copy', label: '复制', icon: 'ri:file-copy-line', auth: 'VehicleArchive:Copy' }]
      : []),
    {
      key: 'approvalHistory',
      label: '审批记录',
      icon: 'ri:file-history-line',
      auth: 'VehicleArchive:View'
    },
    {
      key: 'delete',
      label: '删除',
      icon: 'ri:delete-bin-5-line',
      auth: 'VehicleArchive:Delete',
      color: '#f56c6c'
    }
  ]

  const handleMoreAction = (item: ButtonMoreItem, row: VehicleArchive): void => {
    if (item.key === 'view') {
      openDetailPage(row)
      return
    }
    if (item.key === 'copy') {
      openCopyPage(row)
      return
    }
    if (item.key === 'approvalHistory') {
      void openApprovalHistory(row)
      return
    }
    if (item.key === 'delete') {
      void handleDelete(row)
    }
  }

  const openApprovalHistory = async (row: VehicleArchive): Promise<void> => {
    if (!row.id) return
    await approvalHistoryRef.value?.handleOpen({
      businessType: 'vehicle_archive',
      businessId: row.id,
      businessTitle: row.plateNo || '车辆档案'
    })
  }

  const handleDelete = async (row: VehicleArchive): Promise<void> => {
    if (!row.id) return
    await deleteRecords({
      resources: [{ id: String(row.id), label: row.plateNo }],
      permission: 'VehicleArchive:Delete',
      inspectReferences: async (resources) => {
        if (!deleteGuardRef.value) throw new Error('关联检查尚未就绪，请刷新列表后重试')
        return deleteGuardRef.value.inspect({
          resourceType: 'vehicle',
          resourceLabel: '车辆档案',
          resources
        })
      },
      remove: () => deleteVehicleArchive(String(row.id)),
      onDeleted: async () => {
        await tableQueryRef.value?.refreshRemove()
        await loadNavigation()
      }
    })
  }

  const handleDeleteGuardCleared = (): void => {
    void tableQueryRef.value?.getData()
    void loadNavigation()
  }
</script>

<style scoped lang="scss">
  .vehicle-archive-manage {
    gap: 12px;
    min-width: 0;

    &__workspace {
      display: grid;
      flex: 1;
      grid-template-columns: minmax(248px, 264px) minmax(0, 1fr);
      gap: 12px;
      min-width: 0;
      min-height: 0;
    }

    &__navigation {
      display: flex;
      flex-direction: column;
      min-width: 0;
      height: 100%;
      min-height: 0;
      overflow: hidden;

      :deep(.vehicle-archive-manage__navigation-body) {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 10px;
        min-height: 0;
      }

      :deep(.el-tree) {
        --el-tree-node-hover-bg-color: color-mix(
          in srgb,
          var(--theme-color) 7%,
          var(--default-box-color)
        );

        background: transparent;
      }

      :deep(.el-tree-node__content) {
        min-height: 42px;
        padding-right: 7px;
        margin-bottom: 2px;
        border-radius: var(--el-border-radius-base);
      }

      :deep(.el-tree-node__content:focus-visible) {
        outline: 2px solid var(--theme-color);
        outline-offset: -2px;
      }

      :deep(.el-tree-node.is-current > .el-tree-node__content) {
        font-weight: 600;
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
        box-shadow: inset 3px 0 0 var(--theme-color);
      }
    }

    &__navigation-scroll {
      flex: 1;
      min-height: 0;
    }

    &__navigation-all {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) 18px;
      gap: 9px;
      align-items: center;
      width: 100%;
      min-height: 58px;
      padding: 7px 9px;
      font: inherit;
      color: var(--el-text-color-regular);
      text-align: left;
      cursor: pointer;
      background: var(--art-gray-100);
      border: 1px solid transparent;
      border-radius: var(--el-border-radius-base);

      &:hover,
      &.is-current {
        background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
        border-color: color-mix(in srgb, var(--theme-color) 22%, transparent);
      }

      &.is-current {
        box-shadow: inset 3px 0 0 var(--theme-color);
      }

      &:focus-visible {
        outline: 2px solid var(--theme-color);
        outline-offset: 2px;
      }
    }

    &__navigation-icon {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      color: var(--theme-color);
      background: var(--default-box-color);
      border-radius: var(--el-border-radius-base);
    }

    &__navigation-copy {
      display: grid;
      min-width: 0;

      strong {
        font-size: 13px;
        color: var(--el-text-color-primary);
      }

      small {
        margin-top: 1px;
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    &__navigation-node {
      display: flex;
      gap: 7px;
      align-items: center;
      width: 100%;
      min-width: 0;

      &-icon {
        flex: none;
        font-size: 16px;
        color: var(--el-text-color-secondary);
      }

      span {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        flex: none;
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        color: var(--el-text-color-placeholder);
      }
    }

    :deep(.art-table-query) {
      min-width: 0;
    }

    :deep(.vehicle-archive-manage__vehicle-cell),
    :deep(.vehicle-archive-manage__ownership) {
      display: grid;
      min-width: 0;
      line-height: 20px;
    }

    :deep(.vehicle-archive-manage__vehicle-cell > div) {
      display: flex;
      gap: 8px;
      align-items: center;
      min-width: 0;
    }

    :deep(.vehicle-archive-manage__plate-link),
    :deep(.vehicle-archive-manage__vehicle-cell strong) {
      flex: none;
      max-width: 128px;
      padding: 1px 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 700;
      color: var(--el-color-primary);
      white-space: nowrap;
      text-decoration: none;
      background: var(--el-color-primary-light-9);
      border: 1px solid var(--el-color-primary-light-7);
      border-radius: var(--el-border-radius-small);
    }

    :deep(.vehicle-archive-manage__plate-link:hover) {
      color: var(--el-color-primary-dark-2);
      background: var(--el-color-primary-light-8);
      border-color: var(--el-color-primary-light-5);
    }

    :deep(.vehicle-archive-manage__plate-link:focus-visible) {
      outline: 2px solid var(--el-color-primary);
      outline-offset: 2px;
    }

    :deep(.vehicle-archive-manage__manufacturer),
    :deep(.vehicle-archive-manage__vehicle-cell small),
    :deep(.vehicle-archive-manage__ownership strong),
    :deep(.vehicle-archive-manage__ownership small) {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :deep(.vehicle-archive-manage__manufacturer),
    :deep(.vehicle-archive-manage__vehicle-cell small),
    :deep(.vehicle-archive-manage__ownership small) {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    :deep(.vehicle-archive-manage__manufacturer) {
      flex: 1;
      min-width: 0;
    }

    :deep(.vehicle-archive-manage__risk-flag) {
      flex: none;
      padding-inline: 5px;
      font-size: 11px;
    }

    :deep(.vehicle-archive-manage__ownership strong) {
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    :deep(.vehicle-archive-manage__expired td:first-child) {
      box-shadow: inset 3px 0 0 var(--el-color-danger);
    }

    :deep(.vehicle-archive-manage__certificate-link),
    :deep(.vehicle-archive-manage__certificate-content) {
      display: grid;
      gap: 3px;
      justify-items: start;
      min-width: 0;
    }

    :deep(.vehicle-archive-manage__certificate-link) {
      text-decoration: none;

      &:focus-visible {
        outline: 2px solid var(--theme-color);
        outline-offset: 2px;
      }
    }

    :deep(.vehicle-archive-manage__certificate-content small) {
      display: block;
      max-width: 142px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 11px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
    }

    :deep(.vehicle-archive-manage__operation) {
      display: flex;
      gap: 8px;
      align-items: center;

      .art-button-table {
        margin-right: 0;
      }
    }
  }

  @media (width <= 1160px) {
    .vehicle-archive-manage {
      :deep(.art-search-bar .el-row > .el-col) {
        flex: 0 0 100%;
        max-width: 100%;
      }
    }
  }

  @media (width <= 900px) {
    .vehicle-archive-manage {
      &__workspace {
        grid-template-columns: minmax(0, 1fr);
      }

      &__navigation {
        height: 260px;
      }
    }
  }
</style>
