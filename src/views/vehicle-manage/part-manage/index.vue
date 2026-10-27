<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col gap-3">
    <ElAlert
      v-if="navigationError"
      :title="navigationError"
      type="warning"
      :closable="false"
      show-icon
    />
    <div v-if="canIssue || canInventory || canInstalled" class="art-card-xs shrink-0 px-5 pt-2">
      <ElTabs v-model="activeTab" aria-label="车辆配件记录业务视图">
        <ElTabPane v-if="canIssue" label="领用归还" name="issues" />
        <ElTabPane v-if="canInventory" label="库存台账" name="inventory" />
        <ElTabPane v-if="canInstalled" label="装车档案" name="installed" />
      </ElTabs>
    </div>
    <PartIssueWorkspace
      v-if="canIssue && activeTab === 'issues'"
      :open-issue-id="openIssueId"
      class="min-h-0 flex-1"
    />
    <PartInventoryWorkspace
      v-else-if="canInventory && activeTab === 'inventory'"
      :initial-part-id="initialPartId"
      class="min-h-0 flex-1"
    />
    <InstalledPartsWorkspace v-else-if="canInstalled" class="min-h-0 flex-1" />
    <ElEmpty v-else description="当前账号无权查看车辆配件记录，请联系管理员配置权限。" />
  </div>
</template>

<script setup lang="ts">
  import InstalledPartsWorkspace from './modules/installed-parts-workspace.vue'
  import PartInventoryWorkspace from './modules/part-inventory-workspace.vue'
  import PartIssueWorkspace from './modules/part-issue-workspace.vue'
  import { fetchVehiclePartReferenceDestination, type VehiclePartReferenceSource } from '@vms/api'
  import { useAuth } from '@/hooks/core/useAuth'

  defineOptions({ name: 'VehiclePartsManage' })

  type PartTab = 'issues' | 'inventory' | 'installed'
  const { hasAuth } = useAuth()
  const canIssue = computed(() => hasAuth('VmsPartIssue:View'))
  const canInventory = computed(() => hasAuth('VmsPartInventory:View'))
  const canInstalled = computed(() => hasAuth('VehiclePartUsage:View'))
  const route = useRoute()
  const requestedTab: PartTab =
    route.query.tab === 'inventory' || route.query.tab === 'installed' ? route.query.tab : 'issues'
  const availableTab = (tab: PartTab): boolean =>
    tab === 'issues'
      ? canIssue.value
      : tab === 'inventory'
        ? canInventory.value
        : canInstalled.value
  const firstAvailableTab = (): PartTab =>
    canIssue.value ? 'issues' : canInventory.value ? 'inventory' : 'installed'
  const activeTab = ref<PartTab>(availableTab(requestedTab) ? requestedTab : firstAvailableTab())
  const openIssueId = ref<string | undefined>()
  const initialPartId = ref<string | undefined>()
  const navigationError = ref('')
  const partReferenceSources: VehiclePartReferenceSource[] = [
    'vms_part_issue_line',
    'vms_part_stock_movement',
    'vms_part_stock'
  ]
  watch(
    () => [route.query.referenceSourceTable, route.query.referenceRecordId] as const,
    async ([source, recordId]) => {
      if (
        typeof source !== 'string' ||
        typeof recordId !== 'string' ||
        !partReferenceSources.includes(source as VehiclePartReferenceSource)
      )
        return
      navigationError.value = ''
      try {
        const destination = await fetchVehiclePartReferenceDestination(
          source as VehiclePartReferenceSource,
          recordId
        )
        if (!destination) {
          navigationError.value = '关联配件记录已不存在或无权查看，请刷新来源页面后重试。'
          return
        }
        activeTab.value = availableTab(destination.tab) ? destination.tab : firstAvailableTab()
        openIssueId.value = destination.issueId
        initialPartId.value = destination.partId
      } catch {
        navigationError.value = '关联配件记录定位失败，请重试。'
      }
    },
    { immediate: true }
  )
  watch([canIssue, canInventory, canInstalled], () => {
    if (!availableTab(activeTab.value)) activeTab.value = firstAvailableTab()
  })
</script>
