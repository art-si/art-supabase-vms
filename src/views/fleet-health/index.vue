<template>
  <ArtPermissionGuard permission="VehicleFleetHealth:View">
    <div class="fleet-health-page business-workspace-page art-full-height">
      <BusinessWorkspaceHeader
        eyebrow="FLEET HEALTH CONTROL"
        title="车队健康中心"
        description="聚合保险、年检、维保、事故、例检与提醒工单，按风险优先级安排车务处置。"
        icon="ri:heart-pulse-line"
        :tags="[
          { label: '规则化评分', type: 'primary' },
          { label: '租户数据隔离', type: 'success' },
          { label: '风险优先', type: 'warning' }
        ]"
        :metrics="metrics"
        refreshable
        refresh-label="刷新车队健康"
        @refresh="tableRef?.refreshData()"
      />

      <section class="fleet-health-page__workspace art-card-xs">
        <ArtTableQuery
          ref="tableRef"
          v-model="table.search"
          :search-items="searchItems"
          :api-fn="fetchTableData"
          :columns-factory="columnsFactory"
          :search-bar-props="{ span: 8, labelWidth: 82 }"
          :table-props="{
            rowKey: 'vehicleId',
            tableLayout: 'fixed',
            emptyText: '暂无符合条件的车辆',
            emptyDescription: '可调整车牌、公司或风险等级后重新查询。'
          }"
          focusable
        />
      </section>
    </div>
  </ArtPermissionGuard>
</template>

<script setup lang="tsx">
  import type { TableRequestOptions } from '@/hooks/core/useTable'
  import { ElProgress, ElTag } from 'element-plus'
  import ArtTooltip from '@/components/core/feedback/art-tooltip/index.vue'
  import { storeToRefs } from 'pinia'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type { ArtTableQueryExpose } from '@/components/core/tables/art-table-query/index.vue'
  import type { ColumnOption } from '@/types'
  import BusinessRecordLink from '@/components/business/business-record-link/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import { useUserStore } from '@/store/modules/user'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { fetchFleetHealthWorkspace } from '@vms/api'

  defineOptions({ name: 'VehicleFleetHealth' })

  type FleetHealthRecord = Api.Vms.VehicleManage.FleetHealthRecord
  type SearchParams = Api.Vms.VehicleManage.FleetHealthSearchParams
  type TableParams = SearchParams & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  const router = useRouter()
  const { hasAuth } = useAuth()
  const tableRef = ref<ArtTableQueryExpose>()
  const { getDictMap } = storeToRefs(useUserStore())
  const overview = reactive<Api.Vms.VehicleManage.FleetHealthOverview>({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    openWorkOrders: 0
  })
  const table = reactive<{ search: SearchParams }>({
    search: { keyword: '', riskLevel: '' }
  })
  const canViewVehicle = computed(() => hasAuth('VehicleQuery:View'))

  const searchItems = computed<SearchFormItem[]>(() => [
    {
      label: '风险等级',
      key: 'riskLevel',
      type: 'select',
      props: {
        options: getDictMap.value.vmsFleetHealthRisk ?? [],
        clearable: true,
        placeholder: '全部风险'
      }
    },
    {
      label: '车辆检索',
      key: 'keyword',
      type: 'input',
      props: { clearable: true, placeholder: '车牌号或所属公司' }
    }
  ])

  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '在册车辆',
      value: overview.total,
      description: '已审核车辆档案',
      icon: 'ri:truck-line',
      tone: 'primary'
    },
    {
      label: '严重风险',
      value: overview.critical,
      description: overview.critical ? '建议立即安排处置' : '当前无严重风险',
      icon: 'ri:alarm-warning-line',
      tone: overview.critical ? 'danger' : 'success'
    },
    {
      label: '高风险 / 需关注',
      value: `${overview.high} / ${overview.medium}`,
      description: '按证照、维保与安全事件评分',
      icon: 'ri:shield-flash-line',
      tone: overview.high ? 'warning' : 'info'
    },
    {
      label: '待处理工单',
      value: overview.openWorkOrders,
      description: '提醒工单待办与处理中',
      icon: 'ri:clipboard-line',
      tone: overview.openWorkOrders ? 'warning' : 'success'
    }
  ])

  const formatDays = (value: number | null, missingLabel: string): string => {
    if (value === null) return missingLabel
    if (value < 0) return `已逾期 ${Math.abs(value)} 天`
    return `剩余 ${value} 天`
  }

  const renderDueState = (value: number | null, missingLabel: string) => {
    const danger = value === null || value < 0
    const warning = value !== null && value >= 0 && value <= 30
    return (
      <ElTag type={danger ? 'danger' : warning ? 'warning' : 'success'} effect="light" size="small">
        {formatDays(value, missingLabel)}
      </ElTag>
    )
  }

  const columnsFactory = (): ColumnOption<FleetHealthRecord>[] => [
    {
      prop: 'plateNo',
      label: '车辆',
      minWidth: 190,
      fixed: 'left',
      formatter: (row) => (
        <BusinessRecordLink
          label={row.plateNo || '未录入车牌'}
          meta={row.companyName || '所属公司待补充'}
          title={`查看车辆 ${row.plateNo || '未录入车牌'} 详情`}
          to={canViewVehicle.value ? `/vms/vehicle-query/detail/${row.vehicleId}` : undefined}
          compact
        />
      )
    },
    {
      prop: 'riskLevel',
      label: '风险等级',
      width: 108,
      formatter: (row) => (
        <ArtDictDisplay dictCode="vmsFleetHealthRisk" value={row.riskLevel} display="tag" />
      )
    },
    {
      prop: 'healthScore',
      label: '健康分',
      width: 150,
      formatter: (row) => (
        <div class="fleet-health-page__score">
          <ElProgress
            percentage={row.healthScore}
            strokeWidth={7}
            status={
              row.healthScore < 50 ? 'exception' : row.healthScore < 70 ? 'warning' : 'success'
            }
          />
        </div>
      )
    },
    {
      prop: 'insuranceDaysRemaining',
      label: '保险',
      width: 138,
      formatter: (row) => renderDueState(row.insuranceDaysRemaining, '保险待补')
    },
    {
      prop: 'inspectionDaysRemaining',
      label: '年检',
      width: 138,
      formatter: (row) => renderDueState(row.inspectionDaysRemaining, '年检待补')
    },
    {
      prop: 'daysSinceMaintenance',
      label: '保养间隔',
      width: 120,
      formatter: (row) =>
        row.daysSinceMaintenance === null ? '记录待补' : `${row.daysSinceMaintenance} 天`
    },
    {
      prop: 'issues',
      label: '风险依据',
      minWidth: 300,
      formatter: (row) =>
        row.issues.length ? (
          <ArtTooltip content={row.issues.join('；')} placement="top" showAfter={250}>
            <div class="fleet-health-page__issues">
              {row.issues.slice(0, 2).map((issue) => (
                <ElTag type="warning" effect="plain" size="small">
                  {issue}
                </ElTag>
              ))}
              {row.issues.length > 2 ? <span>+{row.issues.length - 2}</span> : null}
            </div>
          </ArtTooltip>
        ) : (
          <ElTag type="success" effect="plain" size="small">
            未发现显著风险
          </ElTag>
        )
    },
    {
      prop: 'operation',
      label: '操作',
      width: 88,
      fixed: 'right',
      formatter: (row) => (
        <ArtButtonTable
          type="view"
          label="查看车辆"
          permission="VehicleQuery:View"
          onClick={() => router.push(`/vms/vehicle-query/detail/${row.vehicleId}`)}
        />
      )
    }
  ]

  async function fetchTableData(params: TableParams, options?: TableRequestOptions) {
    const { from, to } = buildSupabasePageRange(params)
    const result = await fetchFleetHealthWorkspace({ ...params, from, to })
    if (!options?.signal?.aborted) Object.assign(overview, result.overview)
    return result
  }
</script>

<style scoped lang="scss">
  .fleet-health-page {
    min-width: 0;

    &__workspace {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
      padding: 18px;
    }

    :deep(.fleet-health-page__score) {
      min-width: 110px;
    }

    :deep(.fleet-health-page__issues) {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      min-width: 0;
      padding-block: 4px;

      .el-tag {
        max-width: 132px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      > span {
        flex: 0 0 auto;
        font-size: 12px;
        color: var(--art-gray-600);
      }
    }

    :deep(.art-table-query) {
      height: 100%;
      min-height: 0;
    }

    @media (width <= 760px) {
      height: auto;

      &__workspace {
        min-height: 620px;
        padding: 14px;
      }
    }
  }
</style>
