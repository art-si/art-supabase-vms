<template>
  <div class="vehicle-reminder-risk">
    <BusinessWorkspaceHeader
      v-if="!overviewHidden"
      eyebrow="VEHICLE RISK CONTROL"
      :title="`${title}风险概览`"
      :description="description"
      icon="ri:alarm-warning-line"
      :tags="overviewTags"
      :metrics="workspaceMetrics"
      @metric-click="handleMetricClick"
    >
      <template v-if="table" #actions>
        <BusinessTableWorkspaceActions :table="table" />
      </template>
    </BusinessWorkspaceHeader>
    <div v-else-if="table" class="flex justify-end">
      <BusinessTableWorkspaceActions :table="table" />
    </div>

    <div
      v-if="!overviewHidden && overview.error"
      class="vehicle-reminder-risk__error art-card-xs"
      role="alert"
    >
      <div>
        <ArtSvgIcon icon="ri:error-warning-line" />
        <span>风险数据暂时无法加载，不影响下方提醒列表。</span>
      </div>
      <ElButton link type="primary" :disabled="overview.loading" @click="loadOverview"
        >重新加载</ElButton
      >
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { ArtTableQueryExpose } from '@/components/core/tables/art-table-query/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric,
    type BusinessWorkspaceTag
  } from '@/components/business/business-workspace-header/index.vue'

  defineOptions({ name: 'VehicleReminderRiskOverview' })

  type ReminderSearchParams = Api.Vms.ReminderManage.VehicleReminderSearchParams
  type RiskBand = Api.Vms.ReminderManage.VehicleReminderRiskBand
  type RiskOverview = Api.Vms.ReminderManage.VehicleReminderRiskOverview

  interface RiskOverviewResponse {
    data?: RiskOverview | null
  }

  interface Props {
    table?: ArtTableQueryExpose | null
    overviewHidden?: boolean
    title: string
    description: string
    fetchFn: (params: ReminderSearchParams) => Promise<RiskOverviewResponse>
  }

  interface MetricCard extends BusinessWorkspaceMetric {
    key: string
    label: string
    value: number
    band: RiskBand
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{ select: [band: RiskBand] }>()
  const appliedSearch = computed(() => props.table?.dataState.appliedSearchParams.value ?? null)
  const activeRiskBand = computed<RiskBand>(() => {
    const band = appliedSearch.value?.riskBand
    return band === 'overdue' || band === 'due_7' || band === 'due_30' ? band : 'all'
  })
  const readFilterText = (value: unknown): string | undefined =>
    typeof value === 'string' ? value || undefined : undefined
  const overviewFilters = computed<Pick<ReminderSearchParams, 'companyName' | 'plateNo'> | null>(
    (previous) => {
      const search = appliedSearch.value
      if (!search || props.overviewHidden) return null

      const companyName = readFilterText(search.companyName)
      const plateNo = readFilterText(search.plateNo)
      // 风险区间切换和翻页不改变概览统计范围。
      return previous && previous.companyName === companyName && previous.plateNo === plateNo
        ? previous
        : { companyName, plateNo }
    }
  )
  const overview = reactive<{ loading: boolean; error: Error | null; data: RiskOverview }>({
    loading: false,
    error: null,
    data: { total: 0, overdue: 0, dueWithin7Days: 0, dueWithin30Days: 0, stable: 0 }
  })
  const overviewBusy = computed(
    () =>
      overview.loading || (!overviewFilters.value && (props.table?.dataState.loading.value ?? true))
  )
  const canSelectMetric = computed(
    () => Boolean(overviewFilters.value) && !overview.error && !overview.loading
  )

  const metricCards = computed<MetricCard[]>(() => [
    {
      key: 'total',
      label: '全部提醒',
      value: overview.data.total,
      description: '当前查询范围',
      icon: 'ri:radar-line',
      tone: 'info',
      band: 'all'
    },
    {
      key: 'overdue',
      label: '已逾期',
      value: overview.data.overdue,
      description: '需要立即确认并处置',
      icon: 'ri:alarm-warning-line',
      tone: 'danger',
      band: 'overdue'
    },
    {
      key: 'seven-days',
      label: '7 天内到期',
      value: overview.data.dueWithin7Days,
      description: '建议本周完成处理安排',
      icon: 'ri:timer-flash-line',
      tone: 'warning',
      band: 'due_7'
    },
    {
      key: 'thirty-days',
      label: '8–30 天到期',
      value: overview.data.dueWithin30Days,
      description: '进入近期准备窗口',
      icon: 'ri:calendar-check-line',
      tone: 'primary',
      band: 'due_30'
    }
  ])

  const workspaceMetrics = computed<BusinessWorkspaceMetric[]>(() =>
    metricCards.value.map((item) => ({
      ...item,
      value: !overviewFilters.value || overview.error ? '—' : item.value,
      interactive: canSelectMetric.value,
      selected: Boolean(overviewFilters.value) && activeRiskBand.value === item.band,
      loading: overviewBusy.value
    }))
  )
  const overviewTags = computed<BusinessWorkspaceTag[]>(() => [
    {
      label: !overviewFilters.value
        ? '等待列表结果'
        : overview.error
          ? '风险统计暂不可用'
          : overview.loading
            ? '正在检查风险'
            : `状态稳定 ${overview.data.stable}`,
      type: overview.error
        ? 'warning'
        : !overviewFilters.value || overview.loading
          ? 'info'
          : 'success',
      effect: 'plain'
    },
    { label: '支持风险区间筛选', type: 'info', effect: 'plain' }
  ])

  const handleMetricClick = (metric: BusinessWorkspaceMetric): void => {
    if (!canSelectMetric.value) return
    const target = metricCards.value.find((item) => item.key === metric.key)
    if (target) emit('select', target.band)
  }

  let requestId = 0
  onBeforeUnmount(() => {
    requestId += 1
  })

  async function loadOverview(): Promise<void> {
    const currentRequestId = ++requestId
    const filters = overviewFilters.value
    overview.loading = Boolean(filters)
    overview.error = null
    if (!filters) return

    try {
      const result = await props.fetchFn(filters)
      if (currentRequestId !== requestId) return
      if (!result.data) throw new Error('风险概览加载失败')
      overview.data = result.data
    } catch (error) {
      if (currentRequestId === requestId) {
        overview.error = error instanceof Error ? error : new Error('风险概览加载失败')
      }
    } finally {
      if (currentRequestId === requestId) overview.loading = false
    }
  }

  watch(overviewFilters, () => void loadOverview(), { immediate: true, flush: 'sync' })

  defineExpose({ loadOverview })
</script>

<style scoped lang="scss">
  .vehicle-reminder-risk {
    display: grid;
    gap: 12px;
    margin-bottom: 12px;

    &__error,
    &__error > div {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    &__error {
      justify-content: space-between;
      min-height: 54px;
      padding: 10px 14px;
      color: var(--el-color-warning);
      background: var(--el-color-warning-light-9);
      border-radius: var(--el-border-radius-base);
    }

    @media (width <= 680px) {
      &__error {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  }
</style>

<style lang="scss">
  .el-table__body tr.vehicle-reminder-row--overdue > td.el-table__cell {
    background: color-mix(in srgb, var(--el-color-danger) 4%, var(--el-bg-color));
  }

  .el-table__body tr.vehicle-reminder-row--overdue > td.el-table__cell:first-child {
    box-shadow: inset 3px 0 0 var(--el-color-danger);
  }

  .el-table__body tr.vehicle-reminder-row--urgent > td.el-table__cell {
    background: color-mix(in srgb, var(--el-color-warning) 4%, var(--el-bg-color));
  }

  .el-table__body tr.vehicle-reminder-row--urgent > td.el-table__cell:first-child {
    box-shadow: inset 3px 0 0 var(--el-color-warning);
  }
</style>
