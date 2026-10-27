<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col gap-3">
    <div class="art-card-xs shrink-0 px-5 pt-2">
      <ElTabs v-model="activeTab" aria-label="车辆配件记录业务视图">
        <ElTabPane label="领用归还" name="issues" />
        <ElTabPane label="库存台账" name="inventory" />
        <ElTabPane label="装车档案" name="installed" />
      </ElTabs>
    </div>
    <PartIssueWorkspace v-if="activeTab === 'issues'" class="min-h-0 flex-1" />
    <PartInventoryWorkspace v-else-if="activeTab === 'inventory'" class="min-h-0 flex-1" />
    <InstalledPartsWorkspace v-else class="min-h-0 flex-1" />
  </div>
</template>

<script setup lang="ts">
  import InstalledPartsWorkspace from './modules/installed-parts-workspace.vue'
  import PartInventoryWorkspace from './modules/part-inventory-workspace.vue'
  import PartIssueWorkspace from './modules/part-issue-workspace.vue'

  defineOptions({ name: 'VehiclePartsManage' })

  type PartTab = 'issues' | 'inventory' | 'installed'
  const activeTab = ref<PartTab>('issues')
</script>
