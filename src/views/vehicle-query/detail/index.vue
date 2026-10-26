<template>
  <ArtPageShell
    class="vehicle-query-detail"
    :loading="page.loading"
    loading-mode="skeleton"
    :error="page.error"
    :empty="!page.vehicle"
    empty-text="未找到车辆信息"
    empty-description="请返回车辆查询重新选择，或刷新后重试。"
    @retry="loadVehicle"
  >
    <ArtPageHeader
      :title="page.vehicle?.plateNo || '车辆综合查询'"
      :subtitle="vehicleSubtitle"
      show-back
      @back="goBack"
    />

    <VehicleQuerySummary
      v-if="page.vehicle"
      :vehicle="page.vehicle"
      :summary="page.summary"
      @analyze="openHealthAdvisor"
    />

    <ArtSectionCard
      v-if="page.vehicle"
      class="vehicle-query-detail__current"
      title="当前承运"
      subtitle="从运输执行关系查看这辆车正在承运的订单和司机"
      :loading="execution.loading"
      :error="execution.error"
      error-title="当前承运信息加载失败"
      :empty="!execution.current.length"
      empty-title="当前暂无在运订单"
      empty-description="车辆有新的运输执行记录后，将在这里显示关联订单与司机。"
      :min-height="152"
      @retry="loadCurrentExecution"
    >
      <div class="grid gap-3 lg:grid-cols-2">
        <div
          v-for="relation in execution.current"
          :key="relation.waybillId || relation.orderId"
          class="grid min-w-0 gap-3 rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-light)] p-4 sm:grid-cols-2"
        >
          <div class="min-w-0">
            <span class="text-xs text-[var(--el-text-color-secondary)]">运输订单</span>
            <RouterLink
              v-if="canViewOrder && relation.orderId"
              class="mt-1 block truncate font-semibold text-[var(--el-color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-color-primary)]"
              :title="relation.orderNo"
              :to="`/tms/order-query/detail/${relation.orderId}`"
              >{{ relation.orderNo }}</RouterLink
            >
            <strong v-else class="mt-1 block truncate" :title="relation.orderNo">{{
              relation.orderNo
            }}</strong>
            <small class="mt-1 block truncate text-[var(--el-text-color-secondary)]">
              {{ relation.waybillNo || '待生成执行运单' }}
            </small>
          </div>
          <div class="min-w-0">
            <span class="text-xs text-[var(--el-text-color-secondary)]">承运司机</span>
            <RouterLink
              v-if="canViewDriver && relation.driverId"
              class="mt-1 block truncate font-semibold text-[var(--el-color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--el-color-primary)]"
              :title="relation.driverName || '未分配司机'"
              :to="`/tms/driver-query/detail/${relation.driverId}`"
              >{{ relation.driverName || '未分配司机' }}</RouterLink
            >
            <strong
              v-else
              class="mt-1 block truncate"
              :title="relation.driverName || '未分配司机'"
              >{{ relation.driverName || '未分配司机' }}</strong
            >
            <small class="mt-1 block text-[var(--el-text-color-secondary)]">
              <ArtDictDisplay dict-code="tmsWaybillStatus" :value="relation.waybillStatus" />
            </small>
          </div>
        </div>
      </div>
    </ArtSectionCard>

    <div v-if="page.vehicle" class="vehicle-query-detail__body art-card-xs">
      <VehicleQuerySideTabs v-model="page.activeTab" :tabs="tabs" />
      <main class="vehicle-query-detail__content">
        <TransportOrdersPanel
          v-if="page.activeTab === 'orders' && page.vehicle.id"
          :vehicle-id="page.vehicle.id || ''"
        />
        <FuelExecutionPanel
          v-else-if="page.activeTab === 'fuel' && page.vehicle.id"
          :vehicle-id="page.vehicle.id || ''"
        />
        <FuelCardSourcePanel
          v-else-if="page.activeTab === 'fuelCard'"
          kind="archive"
          :vehicle-id="page.vehicle.id || ''"
        />
        <FuelCardSourcePanel
          v-else-if="page.activeTab === 'fuelLedger'"
          kind="ledger"
          :vehicle-id="page.vehicle.id || ''"
        />
        <MainlineCostsPanel
          v-else-if="page.activeTab === 'costs' && page.vehicle.id"
          scope="vehicle"
          :record-id="page.vehicle.id"
        />
        <component v-else :is="activePanel" :vehicle="page.vehicle" />
      </main>
    </div>

    <VehicleHealthAdvisorDrawer ref="healthAdvisorRef" />

    <template #empty-action>
      <ElButton type="primary" plain @click="goBack">返回车辆查询</ElButton>
    </template>
  </ArtPageShell>
</template>

<script setup lang="ts">
  import { fetchVehicleArchiveDetail } from '@vms/api'
  import {
    fetchTransportMainlineRelations,
    type TransportMainlineRelation
  } from '@/api/transport-mainline'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import { RouterLink } from 'vue-router'
  import VehicleQuerySummary from '../modules/vehicle-query-summary.vue'
  import VehicleQuerySideTabs from '../modules/vehicle-query-side-tabs.vue'
  import VehicleViewPanel from '../modules/vehicle-view-panel.vue'
  import ArchivePanel from '../modules/archive-panel.vue'
  import DocumentsPanel from '../modules/documents-panel.vue'
  import DriverPanel from '../modules/driver-panel.vue'
  import TransportOrdersPanel from '../modules/transport-orders-panel.vue'
  import FuelExecutionPanel from '../modules/fuel-execution-panel.vue'
  import FuelCardSourcePanel from '../modules/fuel-card-source-panel.vue'
  import MainlineCostsPanel from '@/components/business/mainline-costs-panel/index.vue'
  import PartsPanel from '../modules/parts-panel.vue'
  import InsurancePanel from '../modules/insurance-panel.vue'
  import InspectionPanel from '../modules/inspection-panel.vue'
  import ViolationPanel from '../modules/violation-panel.vue'
  import AccidentPanel from '../modules/accident-panel.vue'
  import MaintenancePanel from '../modules/maintenance-panel.vue'
  import RoutineInspectionPanel from '../modules/routine-inspection-panel.vue'
  import MileagePanel from '../modules/mileage-panel.vue'
  import DevicePanel from '../modules/device-panel.vue'
  import VehicleHealthAdvisorDrawer from '../modules/vehicle-health-advisor-drawer.vue'
  import type {
    VehicleArchive,
    VehicleQuerySummary as VehicleSummaryData,
    VehicleQueryTab,
    VehicleQueryTabKey
  } from '../modules/types'
  import { loadVehicleQuerySummary } from '../modules/load-vehicle-query-summary'

  defineOptions({ name: 'VehicleQueryDetail' })

  interface PageState {
    loading: boolean
    error: Error | null
    activeTab: VehicleQueryTabKey
    vehicle?: VehicleArchive
    summary: VehicleSummaryData
  }

  interface HealthAdvisorExpose {
    handleOpen: (data: { vehicleId: string; plateNo: string }) => Promise<void>
  }

  const route = useRoute()
  const router = useRouter()
  const { hasAuth } = useAuth()
  const healthAdvisorRef = ref<HealthAdvisorExpose>()

  const page = reactive<PageState>({
    loading: false,
    error: null,
    activeTab: 'view',
    summary: {}
  })
  const canViewOrder = computed(() => hasAuth('TmsOrderQuery:View'))
  const canViewDriver = computed(() => hasAuth('TmsDriverQuery:View'))
  const execution = reactive<{
    loading: boolean
    error: string | null
    current: TransportMainlineRelation[]
  }>({ loading: false, error: null, current: [] })

  const tabs: VehicleQueryTab[] = [
    { key: 'view', label: '车辆视图' },
    { key: 'archive', label: '车辆档案' },
    { key: 'documents', label: '车辆证件' },
    { key: 'driver', label: '司机管理' },
    { key: 'orders', label: '运输订单' },
    { key: 'fuel', label: '油耗与加油' },
    { key: 'fuelCard', label: '油卡档案' },
    { key: 'fuelLedger', label: '油卡流水' },
    { key: 'costs', label: '费用流水' },
    { key: 'parts', label: '车辆零部件' },
    { key: 'insurance', label: '车辆保险' },
    { key: 'inspection', label: '车辆年检' },
    { key: 'violation', label: '车辆违章' },
    { key: 'accident', label: '事故记录' },
    { key: 'maintenance', label: '维修保养记录' },
    { key: 'routine', label: '例检记录' },
    { key: 'mileage', label: '里程记录' },
    { key: 'device', label: '绑定设备' }
  ]

  const panelMap = {
    view: VehicleViewPanel,
    archive: ArchivePanel,
    documents: DocumentsPanel,
    driver: DriverPanel,
    orders: TransportOrdersPanel,
    fuel: FuelExecutionPanel,
    fuelCard: FuelCardSourcePanel,
    fuelLedger: FuelCardSourcePanel,
    costs: MainlineCostsPanel,
    parts: PartsPanel,
    insurance: InsurancePanel,
    inspection: InspectionPanel,
    violation: ViolationPanel,
    accident: AccidentPanel,
    maintenance: MaintenancePanel,
    routine: RoutineInspectionPanel,
    mileage: MileagePanel,
    device: DevicePanel
  }

  const activePanel = computed(() => panelMap[page.activeTab])
  const vehicleSubtitle = computed(() => {
    if (!page.vehicle) return '集中查看车辆档案、合规、运营、维保与设备信息'
    return [page.vehicle.companyName, page.vehicle.vin].filter(Boolean).join(' / ') || '--'
  })

  const openHealthAdvisor = (): void => {
    const vehicleId = page.vehicle?.id
    const plateNo = page.vehicle?.plateNo
    if (!vehicleId || !plateNo) return
    void healthAdvisorRef.value?.handleOpen({ vehicleId, plateNo })
  }

  onMounted(() => {
    void loadVehicle()
  })

  const loadVehicle = async (): Promise<void> => {
    const id = String(route.params.id || '')
    if (!id) {
      page.error = new Error('缺少车辆档案标识')
      return
    }

    page.loading = true
    page.error = null
    try {
      const { data } = await fetchVehicleArchiveDetail(id)
      if (!data) {
        page.vehicle = undefined
        page.summary = {}
        return
      }

      const { summary } = await loadVehicleQuerySummary(id)
      page.vehicle = data
      page.summary = summary
      void loadCurrentExecution()
    } catch (error) {
      page.vehicle = undefined
      page.summary = {}
      page.error = error instanceof Error ? error : new Error('车辆综合信息加载失败')
    } finally {
      page.loading = false
    }
  }

  const goBack = (): void => {
    void router.push('/vms/vehicle-query')
  }

  const loadCurrentExecution = async (): Promise<void> => {
    const vehicleId = page.vehicle?.id
    if (!vehicleId) return
    execution.loading = true
    execution.error = null
    try {
      const result = await fetchTransportMainlineRelations({ vehicleId, from: 0, to: 49 })
      execution.current = result.data
        .filter(
          (relation) =>
            !relation.completedAt &&
            ['pending', 'accepted', 'loading', 'transporting', 'unloading'].includes(
              relation.waybillStatus || ''
            )
        )
        .slice(0, 4)
    } catch {
      execution.current = []
      execution.error = '暂时无法读取当前承运关系，请重试。'
    } finally {
      execution.loading = false
    }
  }
</script>

<style scoped lang="scss">
  .vehicle-query-detail {
    min-height: 100%;
    padding: var(--art-space-4);
    background: var(--default-box-color);

    &__body {
      display: grid;
      grid-template-columns: 136px minmax(0, 1fr);
      min-height: calc(100vh - 330px);
      margin-top: var(--art-space-4);
    }

    &__current {
      margin-top: var(--art-space-4);
    }

    &__content {
      min-width: 0;
      padding: 28px 40px 48px;
      overflow: hidden;
    }

    :deep(.vehicle-query-summary) {
      margin-top: var(--art-space-4);
    }
  }

  @media (width <= 900px) {
    .vehicle-query-detail {
      &__body {
        grid-template-columns: 1fr;
      }

      &__content {
        padding: 20px 16px 32px;
      }
    }
  }
</style>
