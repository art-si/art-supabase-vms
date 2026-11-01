<template>
  <ArtSectionCard
    class="parts-category-tree-card h-full"
    title="零部件类别"
    :loading="loading"
    loading-mode="mask"
    :error="loadError"
    :empty="!loading && !loadError && treeData.length === 0"
    empty-title="暂无类别"
    empty-description="请调整当前范围或稍后刷新。"
    :empty-visual-size="64"
    :min-height="0"
    @retry="refreshTree"
  >
    <template #actions>
      <ElButton
        v-auth="'PartsCategory:Add'"
        type="primary"
        aria-label="新增一级类别"
        title="新增一级类别"
        @click="handleAddRoot"
      >
        <ArtSvgIcon icon="ri:add-fill" />
      </ElButton>
    </template>
    <template #toolbar>
      <ElInput v-model="keyword" placeholder="请输入类别名称" clearable @input="debounceFetch" />
    </template>
    <ElTree
      ref="treeRef"
      :data="treeData"
      :props="treeProps"
      node-key="id"
      default-expand-all
      highlight-current
      empty-text="暂无类别"
      @node-click="handleNodeClick"
    >
      <template #default="{ data }">
        <div class="tree-node">
          <div class="label">
            <span class="name">{{ data.categoryName }}</span>
            <ElTag size="small" type="info">{{ data.categoryCode }}</ElTag>
          </div>
          <div class="actions" :class="{ 'is-current': currentId === data.id }" @click.stop>
            <ArtIconButton
              v-auth="'PartsCategory:Add'"
              class="size-6.5! text-base!"
              icon="ri:add-line"
              label="新增子类别"
              @click.stop="handleAddChild(data)"
            />
            <ArtIconButton
              v-auth="'PartsCategory:Edit'"
              class="size-6.5! text-base!"
              icon="ri:pencil-line"
              label="编辑类别"
              @click.stop="handleEdit(data)"
            />
            <ArtButtonMore
              trigger="click"
              :list="deleteActions"
              @click="(item) => item.key === 'delete' && handleDelete(data)"
            />
          </div>
        </div>
      </template>
      <template #empty>
        <ArtEmptyState
          title="暂无可显示内容"
          description="请调整当前范围或稍后刷新。"
          size="compact"
          :visual-size="64"
        />
      </template>
    </ElTree>
  </ArtSectionCard>

  <PartsCategoryDialog ref="dialogRef" @success="handleDialogSuccess" />
  <MasterDataDeleteGuard ref="deleteGuardRef" />
</template>

<script setup lang="ts">
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'
  import MasterDataDeleteGuard from '@/components/business/master-data-delete-guard/index.vue'
  import { useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import { fetchPartsCategoryChildReferences } from './parts-category-delete-references'
  import { debounce, noop } from 'lodash-es'
  import { useAsyncState } from '@vueuse/core'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import type { ElTree } from 'element-plus'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import { deletePartsCategory, fetchPartsCategoryTree } from '@vms/api'
  import PartsCategoryDialog from './parts-category-dialog.vue'

  type PartsCategory = Api.Vms.BasicInfo.PartsCategory

  interface Emits {
    (e: 'tree-node-click', node?: PartsCategory): void
    (e: 'data-change'): void
  }

  interface DialogExpose {
    handleOpen: (row?: PartsCategory, parent?: PartsCategory) => Promise<void>
  }

  const emit = defineEmits<Emits>()
  const { deleteGuardRef, deleteRecord } = useRecordDeleteGuard(
    'mdm_part_category',
    '零部件类别',
    {},
    fetchPartsCategoryChildReferences
  )
  const deleteActions = [
    { key: 'delete', label: '删除', icon: 'ri:delete-bin-5-line', auth: 'PartsCategory:Delete' }
  ]

  const treeRef = ref<InstanceType<typeof ElTree>>()
  const dialogRef = ref<DialogExpose>()
  const keyword = ref('')
  const tenantScope = useTenantScopeStore()
  let requestController: AbortController | undefined
  const {
    state: treeData,
    isLoading: loading,
    error: rawError,
    executeImmediate
  } = useAsyncState(
    async (categoryName: string): Promise<PartsCategory[]> => {
      requestController?.abort()
      const controller = new AbortController()
      requestController = controller
      const { data, error } = await fetchPartsCategoryTree(
        { categoryName },
        { signal: controller.signal, showErrorMessage: false }
      )
      if (error || !data) throw new Error('类别树加载失败，请重试', { cause: error })
      return data
    },
    [] as PartsCategory[],
    { immediate: false, resetOnExecute: false, onError: noop }
  )
  const loadError = computed(() =>
    rawError.value ? new Error('类别树加载失败，请重试', { cause: rawError.value }) : null
  )
  const currentId = ref<string>()

  const treeProps = {
    children: 'children',
    label: 'categoryName'
  }

  const getCurrentCategory = computed<PartsCategory | undefined>(() => {
    return treeRef.value?.getCurrentNode() as PartsCategory | undefined
  })

  const handleNodeClick = (node: PartsCategory): void => {
    currentId.value = node.id
    emit('tree-node-click', node)
  }

  const refreshTree = async (): Promise<void> => {
    await executeImmediate(keyword.value)
  }

  const debounceFetch = debounce(() => {
    void refreshTree()
  }, 400)

  const handleAddRoot = (): void => {
    void dialogRef.value?.handleOpen()
  }

  const handleAddChild = (parent: PartsCategory): void => {
    void dialogRef.value?.handleOpen(undefined, parent)
  }

  const handleEdit = (row: PartsCategory): void => {
    void dialogRef.value?.handleOpen(row)
  }

  const handleDelete = async (row: PartsCategory): Promise<void> => {
    const id = row.id ?? ''
    await deleteRecord({
      resource: { id, label: row.categoryName || row.categoryCode || '零部件类别' },
      permission: 'PartsCategory:Delete',
      remove: () => deletePartsCategory(id),
      onDeleted: async () => {
        if (currentId.value === id) {
          currentId.value = undefined
          emit('tree-node-click', undefined)
        }
        await refreshTree()
        emit('data-change')
      }
    })
  }

  const handleDialogSuccess = async (): Promise<void> => {
    await refreshTree()
    emit('data-change')
  }

  onMounted(() => {
    void refreshTree()
  })

  watch(
    () => tenantScope.effectiveTenantId,
    () => {
      debounceFetch.cancel()
      treeData.value = []
      currentId.value = undefined
      emit('tree-node-click', undefined)
      void refreshTree()
    }
  )
  onBeforeUnmount(() => {
    debounceFetch.cancel()
    requestController?.abort()
  })

  defineExpose({
    getCurrentCategory,
    refreshTree
  })
</script>

<style scoped lang="scss">
  .parts-category-tree-card {
    .el-tree {
      :deep(.el-tree-node__content) {
        height: 38px;
        margin-top: 2px;
        border-radius: var(--art-control-radius);
      }
    }

    .tree-node {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-width: 0;
      height: 100%;
      padding-right: 8px;

      .label {
        display: flex;
        column-gap: 8px;
        align-items: center;
        min-width: 0;

        .name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .actions {
        position: absolute;
        right: 8px;
        display: none;
        gap: var(--art-control-icon-gap);
        align-items: center;
      }

      &:hover .actions,
      &:focus-within .actions,
      .actions.is-current {
        display: inline-flex;
      }
    }
  }
</style>
