<template>
  <ArtSectionCard
    class="parts-category-filter h-full"
    title="零部件类别"
    :subtitle="`${categoryCount} 个类别 · 包含下级`"
    :loading="loading"
    :error="error"
    :empty="!loading && !error && !categories.length"
    empty-title="暂无零部件类别"
    empty-description="请先在零部件类别中维护分类，再返回筛选。"
    :empty-visual-size="64"
    :min-height="140"
    retryable
    @retry="emit('refresh')"
  >
    <template #actions>
      <ArtTreeExpandToggle
        v-if="categories.length"
        :tree="treeRef"
        :data="categories"
        label="零部件类别树"
        :default-expanded="categories.length < 18"
      />
      <ArtIconButton icon="ri:refresh-line" label="刷新零部件类别" @click="emit('refresh')" />
    </template>
    <template #toolbar>
      <div class="grid gap-3">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="搜索类别名称或编码"
          aria-label="搜索零部件类别"
        >
          <template #prefix><ArtSvgIcon icon="ri:search-line" /></template>
        </ElInput>
        <button
          type="button"
          class="art-master-group-all-button flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left"
          :class="{ 'is-current': !selectedId }"
          :aria-pressed="!selectedId"
          @click="emit('select', '')"
        >
          <ArtSvgIcon icon="ri:apps-2-line" aria-hidden="true" />
          <span class="min-w-0 flex-1 font-medium">全部零部件</span>
          <ArtSvgIcon v-if="!selectedId" icon="ri:check-line" aria-hidden="true" />
        </button>
      </div>
    </template>
    <ElTree
      ref="treeRef"
      :data="categories"
      :props="{ label: 'categoryName', children: 'children' }"
      :filter-node-method="filterNode"
      :current-node-key="selectedId || undefined"
      :default-expand-all="categories.length < 18"
      node-key="id"
      highlight-current
      :expand-on-click-node="false"
      @node-click="handleNodeClick"
    >
      <template #default="{ data }">
        <span class="flex min-w-0 flex-1 items-center gap-2" :title="data.categoryName">
          <ArtSvgIcon icon="ri:folder-3-line" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ data.categoryName }}</span>
          <small class="truncate text-xs text-[var(--art-gray-600)]">{{ data.categoryCode }}</small>
        </span>
      </template>
      <template #empty>
        <ArtEmptyState
          title="未找到匹配类别"
          description="请调整关键词或清空搜索。"
          size="compact"
          :visual-size="64"
        />
      </template>
    </ElTree>
  </ArtSectionCard>
</template>

<script setup lang="ts">
  import type { ElTree } from 'element-plus'
  import TreeUtils from '@/utils/tree'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtTreeExpandToggle from '@/components/core/widget/art-tree-expand-toggle/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'

  type PartsCategory = Api.Vms.BasicInfo.PartsCategory

  const props = defineProps<{
    categories: PartsCategory[]
    selectedId: string
    loading: boolean
    error: string
  }>()
  const emit = defineEmits<{ select: [id: string]; refresh: [] }>()
  const keyword = ref('')
  const treeRef = ref<InstanceType<typeof ElTree>>()
  const treeUtils = new TreeUtils({ parentKey: 'parentId' })
  const categoryCount = computed(() => treeUtils.treeToList(props.categories).length)
  const filterNode = (value: string, data: Record<string, unknown>): boolean =>
    !value ||
    `${String(data.categoryName ?? '')} ${String(data.categoryCode ?? '')}`
      .toLowerCase()
      .includes(value.toLowerCase())
  const handleNodeClick = (data: PartsCategory): void => emit('select', data.id ?? '')

  watch(keyword, (value) => treeRef.value?.filter(value))
  watch(
    () => props.selectedId,
    async (id) => {
      await nextTick()
      treeRef.value?.setCurrentKey(id || undefined)
      let parent = id ? treeRef.value?.getNode(id)?.parent : undefined
      while (parent) {
        parent.expanded = true
        parent = parent.parent
      }
    },
    { immediate: true }
  )
</script>
