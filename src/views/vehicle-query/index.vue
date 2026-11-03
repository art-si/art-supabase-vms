<template>
  <div class="vehicle-query-page business-workspace-page art-full-height">
    <BusinessWorkspaceHeader
      class="vehicle-query-page__overview"
      eyebrow="FLEET INTELLIGENCE"
      title="车辆全景查询"
      description="以车辆档案为主线，集中核验审核、运营、里程、保险、年检与维保资料。"
      icon="ri:roadster-line"
      :tags="[
        { label: '覆盖全部审核状态', type: 'info', effect: 'light' },
        { label: '一车一档', type: 'primary', effect: 'plain' }
      ]"
      :metrics="workspaceMetrics"
    >
      <template #actions>
        <BusinessTableWorkspaceActions :table="tableQueryRef" />
      </template>
    </BusinessWorkspaceHeader>

    <div class="vehicle-query-page__workspace">
      <ArtWorkspaceSplitter primary-size="264px" primary-min="248px" :breakpoint="900">
        <template #primary>
          <ArtSectionCard
            class="vehicle-query-page__navigation"
            title="车辆分类"
            :subtitle="
              navigationKey === 'all' ? '按车辆归属和车型筛选' : `当前：${navigationLabel}`
            "
            :loading="navigationLoading"
            loading-mode="mask"
            :error="navigationError"
            error-title="车辆分类加载失败"
            :empty="!navigationLoading && !navigationError && !navigationRows.length"
            empty-title="暂无车辆档案"
            empty-description="车辆档案会按归属和车型显示在这里。"
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
            <template #toolbar>
              <div class="grid gap-2.5">
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
                  class="vehicle-query-page__navigation-all"
                  :class="{ 'is-current': navigationKey === 'all' }"
                  @click="handleNavigationClick()"
                >
                  <ArtSvgIcon icon="ri:apps-2-line" aria-hidden="true" />
                  <span
                    ><strong>全部车辆</strong><small>{{ navigationRows.length }} 辆车</small></span
                  >
                </button>
              </div>
            </template>
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
                <span class="vehicle-query-page__navigation-node">
                  <ArtSvgIcon
                    :icon="data.vehicleType ? 'ri:truck-line' : 'ri:folder-3-line'"
                    aria-hidden="true"
                  />
                  <span :title="data.label">{{ data.label }}</span>
                  <small :aria-label="`${data.count} 辆车`">{{ data.count }}</small>
                </span>
              </template>
              <template #empty
                ><ArtEmptyState
                  title="未找到匹配项"
                  description="请调整关键词或清空筛选条件。"
                  size="compact"
                  :visual-size="64"
              /></template>
            </ElTree>
          </ArtSectionCard>
        </template>
        <ArtTableQuery
          ref="tableQueryRef"
          v-model="table.searchQuery"
          :search-items="table.searchItems"
          :api-fn="fetchTableData"
          :columns-factory="table.columnsFactory"
          :header-actions="headerActions"
          header-actions-placement="workspace"
          :search-bar-props="{ span: 6, labelWidth: 90 }"
          :table-props="table.props"
          :on-success="handleTableSuccess"
          focus-scope-selector=".vehicle-query-page__workspace"
          focusable
        >
          <template #vehicleType="{ row }">
            <ArtDictDisplay
              dict-code="vehicleType"
              :value="row.vehicleType"
              :unknown-text="getVehicleTypeFallbackLabel(row.vehicleType)"
            />
          </template>
        </ArtTableQuery>
      </ArtWorkspaceSplitter>
    </div>
  </div>
</template>

<script setup lang="tsx">
  import type { ComputedRef, UnwrapNestedRefs } from 'vue'
  import { ElTree } from 'element-plus'
  import {
    buildVehicleClassificationTree,
    filterClassifiedVehicles,
    type VehicleClassificationNode as NavigationNode
  } from '@vms/views/vehicle-manage/components/vehicle-classification'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import { getVehicleTypeFallbackLabel } from '@/utils/business/vehicle-type-display'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryExcelColumn,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import {
    exportVehicleArchiveList,
    fetchCarrierOptions,
    fetchVehicleArchiveList,
    fetchVehicleArchiveNavigation,
    type VehicleArchiveNavigationItem,
    type VmsCarrierReference
  } from '@vms/api'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { formatDate, formatMileage } from './modules/query-format'
  import { loadVehicleQuerySummaries } from './modules/load-vehicle-query-summary'
  import type { VehicleQueryCoverage } from './modules/vehicle-query-summary'
  import type { VehicleArchive, VehicleQuerySummary } from './modules/types'
  import { isNil } from 'lodash-es'
  import { canViewField, mergeFieldAccessMaps } from '@/utils/field-permission'
  import { getVehicleUsageYears } from '@vms/views/vehicle-manage/modules/vehicle-lifecycle'
  import { formatVehicleAge } from '@vms/views/vehicle-archive-edit/modules/vehicle-age'

  defineOptions({ name: 'VehicleQuery' })

  type SearchParams = Api.Vms.ArchiveManage.VehicleArchiveSearchParams
  type TableParams = SearchParams & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  interface VehicleQueryRow extends VehicleArchive, VehicleQuerySummary, VehicleQueryCoverage {
    operationYears?: number | null
    threeGuaranteeReady: boolean
    warrantyReady: boolean
  }

  interface TableGroup {
    searchQuery: SearchParams
    searchItems: ComputedRef<SearchFormItem[]>
    columnsFactory: () => ColumnOption<VehicleQueryRow>[]
    props: {
      rowKey: string
      tableLayout: 'fixed'
      emptyText: string
      emptyDescription: string
    }
  }

  const router = useRouter()
  const tableQueryRef = ref<ArtTableQueryExpose>()
  const { getDictMap } = storeToRefs(useUserStore())
  const overview = reactive<{ total: number; rows: VehicleQueryRow[] }>({
    total: 0,
    rows: []
  })
  const userStore = useUserStore()
  const navigationRows = ref<VehicleArchiveNavigationItem[]>([])
  const navigationTreeRef = ref<InstanceType<typeof ElTree>>()
  const navigationKeyword = ref('')
  const navigationLoading = ref(false)
  const navigationError = shallowRef<Error | null>(null)
  const navigationKey = ref('all')
  const navigationLabel = ref('')
  const selectedNavigation = ref<Pick<NavigationNode, 'vehicleOwnership' | 'vehicleType'>>({})
  const navigationIds = computed(() =>
    filterClassifiedVehicles(navigationRows.value, selectedNavigation.value).map((row) => row.id)
  )
  const navigationTree = computed<NavigationNode[]>(() =>
    buildVehicleClassificationTree(
      navigationRows.value,
      (dictionary, value) => userStore.getDictItemByValue(dictionary, value)?.label
    )
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
    navigationLabel.value = node?.label ?? ''
    selectedNavigation.value = {
      vehicleOwnership: node?.vehicleOwnership,
      vehicleType: node?.vehicleType
    }
    if (!node) navigationTreeRef.value?.setCurrentKey(undefined)
    tableQueryRef.value?.clearSelection()
    void tableQueryRef.value?.refreshContext()
  }
  onMounted(async () => {
    await Promise.all(
      ['vehicleOwnership', 'vehicleType'].map((code) => userStore.ensureDictLoaded(code))
    )
    await loadNavigation()
  })
  onActivated(() => {
    void loadNavigation()
  })
  const listFieldAccess = ref<Api.Vms.ArchiveManage.VehicleArchiveFieldAccessMap>({})
  const effectiveFieldAccess = computed(() =>
    mergeFieldAccessMaps(listFieldAccess.value, ...overview.rows.map((row) => row.fieldAccess))
  )
  const coverageCompleteCount = computed(
    () =>
      overview.rows.filter(
        (row) => row.insuranceReady && row.inspectionReady && row.maintenanceReady
      ).length
  )
  const coverageMissingCount = computed(() => overview.rows.length - coverageCompleteCount.value)
  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前结果',
      value: overview.total,
      description: '随筛选条件实时更新',
      icon: 'ri:truck-line'
    },
    {
      label: '本页运营资料齐全',
      value: coverageCompleteCount.value,
      description: '保险、年检与保养均有记录',
      icon: 'ri:shield-check-line',
      tone: 'success'
    },
    {
      label: '本页资料待补',
      value: coverageMissingCount.value,
      description: '至少一项运营保障记录缺失',
      icon: 'ri:file-warning-line',
      tone: 'warning'
    }
  ])

  const exportColumns: ArtTableQueryExcelColumn[] = [
    { key: 'plateNo', title: '车牌号' },
    { key: 'companyName', title: '所属公司' },
    { key: 'vehicleType', title: '车型' },
    { key: 'manufacturer', title: '车辆厂商' },
    { key: 'operationStatus', title: '营运状态' },
    { key: 'auditStatus', title: '审核状态' }
  ]
  const headerActions: ArtTableQueryHeaderAction[] = [
    {
      type: 'export',
      permission: 'VehicleQuery:Export',
      exportFilename: '车辆综合查询',
      exportSheetName: '车辆综合查询',
      exportColumns,
      exportApi: ({ selectedIds, searchParams, maxRows }) =>
        exportVehicleArchiveList({
          ...(searchParams as SearchParams),
          ids: selectedIds.map(String),
          maxRows
        })
    }
  ]

  const table: UnwrapNestedRefs<TableGroup> = reactive<TableGroup>({
    searchQuery: {
      carrierId: '',
      companyName: '',
      plateNo: '',
      manufacturer: '',
      vin: '',
      operationStatus: undefined,
      auditStatus: undefined
    },
    searchItems: computed<SearchFormItem[]>(() => [
      {
        label: '所属承运商',
        key: 'carrierId',
        type: 'select',
        api: fetchCarrierOptions,
        resultField: 'data',
        labelField: 'companyName',
        valueField: 'id',
        labelFn: (option) => {
          const carrier = option as VmsCarrierReference
          return carrier.carrierCode
            ? `${carrier.companyName}（${carrier.carrierCode}）`
            : carrier.companyName
        },
        props: { clearable: true, filterable: true, placeholder: '请选择承运商' }
      },
      {
        label: '所属公司',
        key: 'companyName',
        type: 'input',
        props: { clearable: true }
      },
      {
        label: '车牌号',
        key: 'plateNo',
        type: 'input',
        props: { clearable: true }
      },
      {
        label: '车辆厂商',
        key: 'manufacturer',
        type: 'input',
        props: { clearable: true }
      },
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
        props: { options: getDictMap.value.vehicleOperationStatus ?? [], clearable: true }
      },
      {
        label: '审核状态',
        key: 'auditStatus',
        type: 'select',
        props: { options: getDictMap.value.vehicleAuditStatus ?? [], clearable: true }
      }
    ]),
    columnsFactory: () => [
      { type: 'globalIndex', label: '序号', width: 64 },
      {
        prop: 'vehicleIdentity',
        label: '车辆档案',
        minWidth: 240,
        link: { permission: 'VehicleQuery:View', onClick: openDetail },
        formatter: (row) => renderVehicleIdentity(row)
      },
      {
        prop: 'vehiclePhotoUrl',
        label: '图片',
        width: 88,
        formatter: (row) =>
          row.vehiclePhotoUrl ? (
            <img
              class="vehicle-query-page__photo"
              src={row.vehiclePhotoUrl}
              alt={`${row.plateNo} 车辆图片`}
              width="52"
              height="40"
            />
          ) : (
            '--'
          )
      },
      {
        prop: 'vehicleOwnership',
        label: '车辆归属',
        width: 112,
        dict: { code: 'vehicleOwnership', display: 'auto' }
      },
      {
        prop: 'primaryDriver',
        label: '主司机',
        minWidth: 148,
        formatter: (row) => row.primaryDriver?.driverName || row.driverOneName || '--'
      },
      {
        prop: 'carrier',
        label: '所属承运商',
        minWidth: 190,
        formatter: (row) => row.carrier?.companyName || '--'
      },
      { prop: 'companyName', label: '所属公司', minWidth: 170, showOverflowTooltip: true },
      {
        prop: 'plateColor',
        label: '车牌颜色',
        width: 110,
        dict: { code: 'vehiclePlateColor', display: 'text' }
      },
      {
        prop: 'specLengthM',
        label: '规格/车长(米)',
        width: 128,
        formatter: (row) => row.specLengthM ?? '--'
      },
      {
        prop: 'volumeM3',
        label: '容积(立方米)',
        width: 118,
        formatter: (row) => row.volumeM3 ?? '--'
      },
      { prop: 'loadTons', label: '载重(吨)', width: 110, formatter: (row) => row.loadTons ?? '--' },
      {
        prop: 'defaultTrailerPlateNo',
        label: '默认挂车',
        minWidth: 120,
        formatter: (row) => row.defaultTrailerPlateNo || '--'
      },
      {
        prop: 'purchaseDate',
        label: '购置时间',
        width: 124,
        formatter: (row) => formatDate(row.purchaseDate)
      },
      {
        prop: 'vehicleAge',
        label: '车辆年限',
        width: 112,
        formatter: (row) => formatVehicleAge(row.purchaseDate)
      },
      {
        prop: 'vehicleType',
        label: '车型',
        width: 110,
        dict: { code: 'vehicleType', display: 'auto' },
        useSlot: true
      },
      {
        prop: 'operationStatus',
        label: '营运状态',
        width: 110,
        dict: { code: 'vehicleOperationStatus', display: 'auto' }
      },
      {
        prop: 'auditStatus',
        label: '审核状态',
        width: 110,
        dict: { code: 'vehicleAuditStatus', display: 'auto' }
      },
      {
        prop: 'lifecycle',
        label: '车辆周期',
        minWidth: 190,
        formatter: (row) => renderLifecycle(row)
      },
      {
        prop: 'runningMileage',
        label: '累计里程',
        width: 130,
        formatter: (row) => (
          <span class="vehicle-query-page__mileage">{formatMileage(row.runningMileage)}</span>
        )
      },
      {
        prop: 'operationCoverage',
        label: '运营保障资料',
        minWidth: 230,
        formatter: (row) =>
          renderDocumentStatus([
            { label: '保险', ready: row.insuranceReady },
            { label: '年检', ready: row.inspectionReady },
            { label: '保养', ready: row.maintenanceReady }
          ])
      },
      {
        prop: 'warrantyCoverage',
        label: '质保资料',
        minWidth: 165,
        formatter: (row) =>
          renderDocumentStatus([
            { label: '三包', ready: row.threeGuaranteeReady },
            { label: '包修', ready: row.warrantyReady }
          ])
      },
      {
        prop: 'operation',
        label: '操作',
        width: 96,
        fixed: 'right',
        formatter: (row) => (
          <div class="vehicle-query-page__operation">
            <ArtButtonTable
              type="view"
              permission="VehicleQuery:View"
              onClick={() => openDetail(row)}
            />
          </div>
        )
      }
    ],
    props: {
      rowKey: 'id',
      tableLayout: 'fixed',
      emptyText: '暂无符合条件的车辆档案',
      emptyDescription: '可调整公司、车牌号、厂商或营运状态后重新查询。'
    }
  })

  const fetchTableData = async (params: TableParams) => {
    if (navigationKey.value !== 'all' && !navigationIds.value.length) {
      return { data: [], total: 0, fieldAccess: listFieldAccess.value }
    }
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    const result = await fetchVehicleArchiveList({
      ...params,
      ids: navigationKey.value === 'all' ? undefined : navigationIds.value,
      from,
      to
    })
    listFieldAccess.value = result.fieldAccess ?? {}

    return {
      ...result,
      data: await createQueryRows(result.data ?? [])
    }
  }

  const createQueryRows = async (rows: VehicleArchive[]): Promise<VehicleQueryRow[]> => {
    const summaries = await loadVehicleQuerySummaries(
      rows.flatMap((row) => (row.id ? [row.id] : []))
    )
    return rows.map((row) => ({
      ...row,
      ...(row.id ? summaries[row.id]?.summary : undefined),
      insuranceReady: row.id ? (summaries[row.id]?.coverage.insuranceReady ?? false) : false,
      inspectionReady: row.id ? (summaries[row.id]?.coverage.inspectionReady ?? false) : false,
      maintenanceReady: row.id ? (summaries[row.id]?.coverage.maintenanceReady ?? false) : false,
      operationYears: getVehicleUsageYears(row.startUseDate, false),
      threeGuaranteeReady: !isNil(row.threeGuaranteeMileage) || !isNil(row.threeGuaranteeDuration),
      warrantyReady: !isNil(row.warrantyMileage) || !isNil(row.warrantyDuration)
    }))
  }

  const openDetail = (row: VehicleArchive): void => {
    if (!row.id) return
    void router.push(`/vms/vehicle-query/detail/${row.id}`)
  }

  const handleTableSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (rows, response) => {
    overview.rows = rows as VehicleQueryRow[]
    overview.total = response.total ?? rows.length
  }

  const renderVehicleIdentity = (row: VehicleQueryRow) => (
    <div class="vehicle-query-page__vehicle-cell">
      <div>
        <strong>{row.plateNo || '未录入车牌'}</strong>
        <span>{row.manufacturer || '厂商待补充'}</span>
      </div>
      {canViewField(row.fieldAccess, 'vehicleIdentifiers') ? (
        <small title={row.vin}>{row.vin || 'VIN 待补充'}</small>
      ) : null}
    </div>
  )

  const renderLifecycle = (row: VehicleQueryRow) => (
    <div class="vehicle-query-page__lifecycle">
      <p>
        <span>启用</span>
        <strong>{formatDate(row.startUseDate)}</strong>
      </p>
      <small>
        购入 {formatDate(row.invoiceDate)} · 已运营 {formatDecimal(row.operationYears)} 年
      </small>
    </div>
  )

  const renderDocumentStatus = (items: Array<{ label: string; ready: boolean }>) => (
    <div class="vehicle-query-page__document-status">
      {items.map((item) => (
        <span
          class={item.ready ? 'is-ready' : 'is-missing'}
          title={`${item.label}${item.ready ? '已有记录' : '待补充记录'}`}
        >
          <i aria-hidden="true"></i>
          {item.label}
        </span>
      ))}
    </div>
  )

  const formatDecimal = (value?: number | null): string => {
    if (isNil(value)) return '--'
    return String(value)
  }
</script>

<style scoped lang="scss">
  .vehicle-query-page {
    min-width: 0;

    &__workspace {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    &__navigation {
      min-width: 0;
      min-height: 0;
      overflow: hidden;

      :deep(.el-tree) {
        background: transparent;
      }

      :deep(.el-tree-node__content) {
        min-height: 42px;
        border-radius: var(--el-border-radius-base);
      }

      :deep(.el-tree-node.is-current > .el-tree-node__content) {
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 10%, var(--default-box-color));
        box-shadow: inset 3px 0 0 var(--theme-color);
      }
    }

    &__navigation-all {
      display: flex;
      gap: 10px;
      align-items: center;
      width: 100%;
      min-height: 56px;
      padding: 8px 10px;
      font: inherit;
      text-align: left;
      cursor: pointer;
      background: var(--art-gray-100);
      border: 1px solid transparent;
      border-radius: var(--el-border-radius-base);

      &.is-current {
        color: var(--theme-color);
        background: color-mix(in srgb, var(--theme-color) 9%, var(--default-box-color));
        box-shadow: inset 3px 0 0 var(--theme-color);
      }

      &:focus-visible {
        outline: 2px solid var(--theme-color);
        outline-offset: 2px;
      }

      span {
        display: grid;
      }

      small {
        color: var(--el-text-color-secondary);
      }
    }

    &__navigation-node {
      display: flex;
      gap: 7px;
      align-items: center;
      width: 100%;
      min-width: 0;

      > span {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      small {
        flex: none;
        margin-right: 21px;
        font-variant-numeric: tabular-nums;
        color: var(--el-text-color-secondary);
      }
    }

    :deep(.vehicle-query-page__photo) {
      width: 52px;
      height: 40px;
      object-fit: cover;
      border-radius: var(--el-border-radius-small);
    }

    :deep(.art-table-query) {
      min-width: 0;
    }

    &__overview {
      flex: 0 0 auto;
      min-width: 0;
      overflow: hidden;
    }

    &__hero,
    &__identity,
    &__hero-status,
    &__metrics article,
    &__brand,
    &__metric-icon {
      display: flex;
      align-items: center;
    }

    &__hero {
      gap: 20px;
      justify-content: space-between;
      padding: 20px 24px 18px;
      background: radial-gradient(
        circle at 92% 0%,
        var(--el-color-primary-light-9),
        transparent 34%
      );
    }

    &__identity {
      min-width: 0;

      > div:last-child {
        min-width: 0;
      }

      > div > span {
        display: block;
        margin-bottom: 3px;
        font-size: 10px;
        font-weight: 700;
        color: var(--el-color-primary);
        letter-spacing: 0.14em;
      }

      h1 {
        margin: 0 0 3px;
        font-size: 22px;
        line-height: 1.35;
        color: var(--el-text-color-primary);
      }

      p {
        margin: 0;
        font-size: 13px;
        line-height: 1.6;
        color: var(--el-text-color-secondary);
        overflow-wrap: anywhere;
      }
    }

    &__brand {
      flex: 0 0 50px;
      justify-content: center;
      width: 50px;
      height: 50px;
      margin-right: 16px;
      color: white;
      background: linear-gradient(145deg, var(--el-color-primary), var(--el-color-primary-dark-2));
      border-radius: var(--custom-radius);

      :deep(svg) {
        width: 23px;
        height: 23px;
      }
    }

    &__hero-status {
      flex: none;
      gap: 8px;
    }

    &__metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border-top: 1px solid var(--el-border-color-lighter);

      article {
        gap: 12px;
        min-width: 0;
        padding: 14px 24px;

        &:not(:last-child) {
          border-right: 1px solid var(--el-border-color-lighter);
        }

        > div:last-child {
          display: grid;
          min-width: 0;
        }

        span,
        small {
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--el-text-color-secondary);
          white-space: nowrap;
        }

        span {
          font-size: 12px;
        }

        strong {
          margin: 1px 0;
          font-size: 20px;
          line-height: 1.25;
          color: var(--el-text-color-primary);
        }

        small {
          font-size: 11px;
        }
      }
    }

    &__metric-icon {
      flex: 0 0 38px;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: var(--el-border-radius-base);

      :deep(svg) {
        width: 18px;
        height: 18px;
      }

      &.is-primary {
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
      }

      &.is-success {
        color: var(--el-color-success);
        background: var(--el-color-success-light-9);
      }

      &.is-warning {
        color: var(--el-color-warning-dark-2);
        background: var(--el-color-warning-light-9);
      }
    }

    :deep(.vehicle-query-page__vehicle-cell),
    :deep(.vehicle-query-page__lifecycle) {
      display: grid;
      min-width: 0;
      line-height: 20px;
    }

    :deep(.vehicle-query-page__vehicle-cell > div) {
      display: flex;
      gap: 8px;
      align-items: center;
      min-width: 0;
    }

    :deep(.vehicle-query-page__vehicle-cell strong) {
      flex: none;
      padding: 1px 8px;
      font-weight: 700;
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9);
      border: 1px solid var(--el-color-primary-light-7);
      border-radius: var(--art-surface-radius);
    }

    :deep(.vehicle-query-page__vehicle-cell span),
    :deep(.vehicle-query-page__vehicle-cell small),
    :deep(.vehicle-query-page__lifecycle small) {
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      white-space: nowrap;
    }

    :deep(.vehicle-query-page__lifecycle p) {
      display: flex;
      gap: 6px;
      margin: 0;

      span {
        color: var(--el-text-color-secondary);
      }

      strong {
        color: var(--el-text-color-primary);
      }
    }

    :deep(.vehicle-query-page__mileage) {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--el-text-color-primary);
    }

    :deep(.vehicle-query-page__document-status) {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;

      span {
        display: inline-flex;
        gap: 5px;
        align-items: center;
        padding: 2px 7px;
        font-size: 12px;
        line-height: 20px;
        border-radius: 999px;

        i {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
      }

      .is-ready {
        color: var(--el-color-success-dark-2);
        background: var(--el-color-success-light-9);

        i {
          background: var(--el-color-success);
        }
      }

      .is-missing {
        color: var(--el-text-color-secondary);
        background: var(--el-fill-color-light);

        i {
          background: var(--el-text-color-placeholder);
        }
      }
    }

    :deep(.vehicle-query-page__operation) {
      display: flex;
      gap: 8px;
      align-items: center;

      .art-button-table {
        margin-right: 0;
      }
    }

    @media (width <= 900px) {
      &__navigation {
        max-height: 300px;
      }

      &__hero {
        align-items: flex-start;
      }

      &__hero-status {
        flex-direction: column;
        align-items: flex-end;
      }

      &__metrics article {
        padding-inline: 16px;
      }
    }

    @media (width <= 640px) {
      &__hero {
        flex-direction: column;
        padding: 18px;
      }

      &__hero-status {
        flex-direction: row;
        align-items: center;
        margin-left: 66px;
      }

      &__metrics {
        grid-template-columns: 1fr;

        article:not(:last-child) {
          border-right: 0;
          border-bottom: 1px solid var(--el-border-color-lighter);
        }
      }
    }
  }
</style>
