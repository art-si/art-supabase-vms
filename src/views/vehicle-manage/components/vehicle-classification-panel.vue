<template>
  <ArtSectionCard
    class="vehicle-classification-panel"
    title="车辆分类"
    :subtitle="selectedLabel ? `当前：${selectedLabel}` : '按车辆归属和车型筛选'"
    aria-label="按车辆归属和车型筛选"
    :loading="loading"
    loading-mode="mask"
    :error="error"
    error-title="车辆分类加载失败"
    :empty="!loading && !error && !rows.length"
    empty-title="暂无车辆档案"
    empty-description="新增车辆档案后，会按车辆归属和车型显示在这里。"
    :min-height="0"
    @retry="refresh"
  >
    <template #actions>
      <ArtTreeExpandToggle
        :tree="treeRef"
        :data="tree"
        node-key="key"
        label="车辆分类"
        :default-expanded="rows.length < 24"
      />
      <ArtIconButton icon="ri:refresh-line" label="刷新车辆分类" @click="refresh" />
    </template>
    <template #toolbar>
      <div class="grid gap-2.5">
        <ElInput v-model="keyword" clearable placeholder="搜索归属或车型" aria-label="搜索车辆分类">
          <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
        </ElInput>
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-light)] px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-color)]"
          :aria-current="selectedKey === 'all' ? 'true' : undefined"
          @click="select()"
        >
          <ArtSvgIcon icon="ri:apps-2-line" class="shrink-0 text-[var(--theme-color)]" />
          <span class="min-w-0 flex-1"
            ><strong class="block text-sm">全部车辆</strong
            ><small class="text-xs text-[var(--el-text-color-secondary)]"
              >{{ rows.length }} 辆车</small
            ></span
          >
          <ArtSvgIcon v-if="selectedKey === 'all'" icon="ri:check-line" aria-hidden="true" />
        </button>
      </div>
    </template>
    <ElTree
      ref="treeRef"
      :data="tree"
      node-key="key"
      :default-expand-all="rows.length < 24"
      highlight-current
      :expand-on-click-node="false"
      :current-node-key="selectedKey === 'all' ? undefined : selectedKey"
      :filter-node-method="filterNode"
      @node-click="select"
    >
      <template #default="{ data }">
        <span class="flex min-w-0 flex-1 items-center gap-2">
          <ArtSvgIcon
            :icon="data.vehicleType ? 'ri:truck-line' : 'ri:folder-3-line'"
            class="shrink-0"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 truncate" :title="data.label">{{ data.label }}</span>
          <small
            class="pr-[3ch] tabular-nums text-[var(--el-text-color-secondary)]"
            :aria-label="`${data.count} 辆车`"
            >{{ data.count }}</small
          >
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
  </ArtSectionCard>
</template>

<script setup lang="ts">
  import { ElTree } from 'element-plus'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { fetchVehicleArchiveNavigation, type VehicleArchiveNavigationItem } from '@vms/api'
  import {
    buildVehicleClassificationTree,
    filterClassifiedVehicles,
    type VehicleClassificationNode
  } from './vehicle-classification'

  export interface VehicleClassificationSelection {
    vehicleOwnership?: string
    vehicleType?: string
    vehicleIds?: string[]
  }
  const emit = defineEmits<{ select: [selection: VehicleClassificationSelection] }>()
  const userStore = useUserStore()
  const rows = ref<VehicleArchiveNavigationItem[]>([])
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const keyword = ref('')
  const selectedKey = ref('all')
  const selectedLabel = ref('')
  const loading = ref(false)
  const error = shallowRef<Error | null>(null)
  let refreshSequence = 0
  const tree = computed(() =>
    buildVehicleClassificationTree(
      rows.value,
      (code, value) => userStore.getDictItemByValue(code, value)?.label
    )
  )
  const filterNode = (value: string, node: Record<string, unknown>): boolean =>
    !value ||
    String(node.searchText ?? '')
      .toLocaleLowerCase()
      .includes(value.toLocaleLowerCase())
  watch(keyword, (value) => treeRef.value?.filter(value.trim()))
  const refresh = async (): Promise<void> => {
    const sequence = ++refreshSequence
    loading.value = true
    error.value = null
    try {
      const result = await fetchVehicleArchiveNavigation()
      if (sequence !== refreshSequence) return
      if (result.error) throw result.error
      rows.value = result.data ?? []
      if (
        selectedKey.value !== 'all' &&
        !tree.value.some(
          (node) =>
            node.key === selectedKey.value ||
            node.children?.some((child) => child.key === selectedKey.value)
        )
      )
        select()
      await nextTick()
      treeRef.value?.filter(keyword.value.trim())
    } catch (cause) {
      if (sequence === refreshSequence)
        error.value = cause instanceof Error ? cause : new Error('车辆分类加载失败')
    } finally {
      if (sequence === refreshSequence) loading.value = false
    }
  }
  const select = (node?: VehicleClassificationNode): void => {
    selectedKey.value = node?.key ?? 'all'
    selectedLabel.value = node?.label ?? ''
    if (!node) treeRef.value?.setCurrentKey(undefined)
    emit(
      'select',
      node
        ? {
            vehicleOwnership: node.vehicleOwnership,
            vehicleType: node.vehicleType,
            vehicleIds: filterClassifiedVehicles(rows.value, node).map((row) => row.id)
          }
        : {}
    )
  }
  onMounted(async () => {
    await Promise.all(
      ['vehicleOwnership', 'vehicleType'].map((code) => userStore.ensureDictLoaded(code))
    )
    await refresh()
  })
  onActivated(() => void refresh())
  defineExpose({ refresh })
</script>

<style scoped lang="scss">
  .vehicle-classification-panel {
    min-width: 0;
    min-height: 0;

    :deep(.el-tree) {
      min-width: 0;
    }

    :deep(.el-tree-node__content) {
      min-height: 36px;
      padding-right: 12px;
    }
  }
</style>
