<template>
  <div class="vehicle-type-tab">
    <div class="vehicle-type-tab__toolbar">
      <div>
        <h3>车型配置</h3>
        <p>按车型分类维护规格、容积和载重，车辆参选后自动带入。</p>
      </div>
      <span v-if="selectedTenantId" class="vehicle-type-tab__total">
        已配置 {{ profiles.length }} 项规格
      </span>
    </div>

    <ArtAsyncState
      v-if="!selectedTenantId"
      empty
      empty-text="当前账号缺少租户信息"
      empty-description="请刷新页面；若问题持续，请联系管理员检查账号归属。"
    />
    <ArtAsyncState v-else :loading="loading" :error="error" :min-height="360" @retry="loadProfiles">
      <ArtWorkspaceSplitter
        class="vehicle-type-tab__layout"
        :style="{ height: splitterHeight }"
        primary-size="258px"
        primary-min="218px"
        primary-max="360px"
        secondary-min="480px"
        :breakpoint="TREE_STACK_BREAKPOINT"
        stacked-primary-size="auto"
        stacked-secondary-min-size="0px"
      >
        <template #primary>
          <ArtSectionCard
            title="车型层级"
            subtitle="展开分类后选择具体规格"
            root-class="vehicle-type-tab__tree-card"
            :show-scrollbar="false"
          >
            <template #actions>
              <ArtIconButton
                :icon="allExpanded ? 'ri:contract-up-down-line' : 'ri:expand-up-down-line'"
                :label="allExpanded ? '全部收起车型分类' : '全部展开车型分类'"
                :disabled="!expandableKeys.length"
                @click="toggleAllExpanded"
              />
            </template>
            <div class="vehicle-type-tab__tree-viewport" :style="{ height: stackedTreeHeight }">
              <ElAutoResizer>
                <template #default="{ height }">
                  <ElTreeV2
                    ref="treeRef"
                    :data="treeNodes"
                    :props="{ value: 'key', label: 'label', children: 'children' }"
                    :height="height"
                    :item-size="40"
                    :default-expanded-keys="expandedKeys"
                    highlight-current
                    @node-click="handleTreeNodeClick"
                    @node-expand="handleTreeNodeExpand"
                    @node-collapse="handleTreeNodeCollapse"
                  >
                    <template #default="{ data }">
                      <span class="vehicle-type-tab__node">
                        <VehicleTypeArt v-if="!data.profile" :category="data.category" />
                        <span class="vehicle-type-tab__node-label" :title="data.label">{{
                          data.label
                        }}</span>
                        <small class="vehicle-type-tab__node-meta">
                          {{
                            data.profile
                              ? data.profile.status === '1'
                                ? '启用'
                                : '禁用'
                              : (data.children?.length ?? 0)
                          }}
                        </small>
                      </span>
                    </template>
                    <template #empty>
                      <ArtEmptyState
                        title="暂无可显示内容"
                        description="请调整当前范围或稍后刷新。"
                        size="compact"
                        :visual-size="64"
                      />
                    </template>
                  </ElTreeV2>
                </template>
              </ElAutoResizer>
            </div>
          </ArtSectionCard>
        </template>

        <template #default>
          <div ref="rightWorkspaceRef" class="vehicle-type-tab__workspace">
            <ArtSectionCard :title="selectedCategory" subtitle="已配置的车型规格">
              <template #actions>
                <ElButton
                  v-auth="'VehicleArchive:TypeAdd'"
                  type="primary"
                  plain
                  @click="selectCategory(selectedCategory, true)"
                >
                  <ArtSvgIcon icon="ri:add-line" aria-hidden="true" />
                  新增规格
                </ElButton>
              </template>
              <div class="vehicle-type-tab__spec-list">
                <button
                  v-for="profile in categoryProfiles(selectedCategory)"
                  :key="profile.id"
                  type="button"
                  class="vehicle-type-tab__spec"
                  :class="{ 'is-active': selectedId === profile.id }"
                  :aria-pressed="selectedId === profile.id"
                  @click="selectProfile(profile)"
                >
                  <span class="vehicle-type-tab__spec-heading">
                    <strong>{{ vehicleTypeProfileLabel(profile) }}</strong>
                    <ArtDictDisplay
                      dict-code="commonEnabledStatus"
                      :value="profile.status === '1' ? 'enabled' : 'disabled'"
                      display="tag"
                    />
                  </span>
                  <span>
                    容积 {{ profile.volumeM3 == null ? '未配置' : `${profile.volumeM3} 立方米` }} ·
                    载重 {{ profile.loadTons == null ? '未配置' : `${profile.loadTons} 吨` }}
                  </span>
                </button>
                <div
                  v-if="!categoryProfiles(selectedCategory).length"
                  class="vehicle-type-tab__spec-empty"
                >
                  当前分类暂无规格，点击右上角新增。
                </div>
              </div>
            </ArtSectionCard>

            <ArtSectionCard
              :title="selectedId ? '规格详情' : '新增车型规格'"
              :subtitle="
                selectedId ? '维护当前规格参数与展示信息' : `为${selectedCategory}配置新规格`
              "
            >
              <template #actions>
                <ElButton
                  v-if="selectedId"
                  v-auth="'VehicleArchive:TypeDelete'"
                  type="danger"
                  plain
                  :disabled="saving || deleteBusy"
                  @click="handleDelete"
                >
                  <template #icon><ArtSvgIcon icon="ri:delete-bin-line" /></template>
                  删除规格
                </ElButton>
                <ElButton
                  v-auth="selectedId ? 'VehicleArchive:TypeEdit' : 'VehicleArchive:TypeAdd'"
                  type="primary"
                  :loading="saving"
                  :disabled="deleteBusy || !formControlsReady"
                  @click="handleSave"
                >
                  <ArtSvgIcon :icon="selectedId ? 'ri:save-3-line' : 'ri:add-line'" />
                  {{ selectedId ? '保存更改' : '创建规格' }}
                </ElButton>
              </template>
              <div class="vehicle-type-tab__detail">
                <div class="vehicle-type-tab__form">
                  <ArtForm
                    ref="formRef"
                    :model-value="form"
                    @update:model-value="replaceReactiveModel(form, $event)"
                    :items="formItems"
                    :rules="rules"
                    :span="12"
                    :gutter="16"
                    label-position="top"
                    :disabled="!canEdit"
                    :show-reset="false"
                    :show-submit="false"
                  >
                    <template #lengthM>
                      <div class="vehicle-type-tab__metric-field">
                        <div class="vehicle-type-tab__metric-input">
                          <ElInputNumber
                            v-model="form.lengthM"
                            :min="0.01"
                            :precision="2"
                            :step="0.1"
                            :controls="false"
                            :disabled="!canEdit"
                            placeholder="输入实际车长"
                            aria-label="车长，单位米"
                          />
                          <span>米</span>
                        </div>
                        <div v-if="selectedCategory === '半挂车'" class="vehicle-type-tab__presets">
                          <span>常用车长</span>
                          <div>
                            <ElButton
                              v-for="value in SEMI_TRAILER_LENGTHS"
                              :key="value"
                              class="vehicle-type-tab__preset-button"
                              :type="form.lengthM === value ? 'primary' : 'default'"
                              :disabled="!canEdit"
                              @click="applyPreset(value)"
                            >
                              {{ value }} 米
                            </ElButton>
                            <ElButton
                              class="vehicle-type-tab__preset-button"
                              :disabled="!canEdit"
                              @click="form.lengthM = null"
                            >
                              其他 / 自定义
                            </ElButton>
                          </div>
                        </div>
                      </div>
                    </template>
                    <template #loadTons>
                      <div class="vehicle-type-tab__metric-field">
                        <div class="vehicle-type-tab__metric-input">
                          <ElInputNumber
                            v-model="form.loadTons"
                            :min="0.01"
                            :precision="2"
                            :step="0.1"
                            :controls="false"
                            :disabled="!canEdit"
                            placeholder="输入实际载重"
                            aria-label="载重，单位吨"
                          />
                          <span>吨</span>
                        </div>
                        <div v-if="selectedCategory === '按载重'" class="vehicle-type-tab__presets">
                          <span>常用载重</span>
                          <div>
                            <ElButton
                              v-for="value in LOAD_CAPACITY_PRESETS"
                              :key="value"
                              class="vehicle-type-tab__preset-button"
                              :type="form.loadTons === value ? 'primary' : 'default'"
                              :disabled="!canEdit"
                              @click="applyPreset(value)"
                            >
                              {{ value }} 吨
                            </ElButton>
                            <ElButton
                              class="vehicle-type-tab__preset-button"
                              :disabled="!canEdit"
                              @click="form.loadTons = null"
                            >
                              其他 / 自定义
                            </ElButton>
                          </div>
                        </div>
                      </div>
                    </template>
                  </ArtForm>
                </div>

                <aside class="vehicle-type-tab__visual">
                  <div class="vehicle-type-tab__visual-heading">
                    <strong>车型图片</strong>
                    <span>参选弹窗展示</span>
                  </div>
                  <div class="vehicle-type-tab__preview">
                    <ElImage v-if="form.imageUrl" :src="form.imageUrl" fit="contain" />
                    <VehicleTypeArt v-else :category="selectedCategory" />
                  </div>
                  <p>未上传时使用这套共用车型插画。</p>
                  <ArtUploadImage
                    v-model="form.imageUrl"
                    :resource-tenant-id="selectedTenantId"
                    :disabled="!selectedTenantId"
                    title="上传自定义车型图片"
                    :size="88"
                    :limit="1"
                    :readonly="!canEdit"
                  />
                </aside>
              </div>
            </ArtSectionCard>
          </div>
        </template>
      </ArtWorkspaceSplitter>
    </ArtAsyncState>
    <MasterDataDeleteGuard :key="guardKey" ref="deleteGuardRef" />
  </div>
</template>

<script setup lang="ts">
  import { replaceReactiveModel } from '@/utils/form/model'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import {
    ElButton,
    ElImage,
    ElInputNumber,
    ElMessage,
    ElTreeV2,
    type TreeV2Instance
  } from 'element-plus'
  import { ElAutoResizer } from 'element-plus/es/components/table-v2/index.mjs'
  import { useElementSize, useWindowSize } from '@vueuse/core'
  import { groupBy } from 'lodash-es'
  import type { FormRules } from 'element-plus'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import ArtWorkspaceSplitter from '@/components/core/layouts/art-workspace-splitter/index.vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import VehicleTypeArt from '@/components/business/vehicle-type-profile-picker/vehicle-type-art.vue'
  import MasterDataDeleteGuard, {
    type MasterDataDeleteDependencyMeta,
    type MasterDataDeleteResource
  } from '@/components/business/master-data-delete-guard/index.vue'
  import { recordDeleteGuardOptions, useRecordDeleteGuard } from '@/hooks/core/useRecordDeleteGuard'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { useTenantOperationGuard } from '@/hooks/core/useTenantOperationGuard'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { useAuth } from '@/hooks/core/useAuth'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { useUserStore } from '@/store/modules/user'
  import { storeToRefs } from 'pinia'
  import {
    deleteVehicleTypeProfile,
    fetchVehicleTypeDeleteReferences,
    fetchVehicleTypeProfiles,
    saveVehicleTypeProfile
  } from '@vms/api'
  import {
    LOAD_CAPACITY_PRESETS,
    SEMI_TRAILER_LENGTHS,
    vehicleTypeProfileLabel,
    type VehicleTypeCategory,
    type VehicleTypeProfile
  } from './vehicle-type-catalog'

  interface ProfileForm {
    category: VehicleTypeCategory
    lengthM: number | null
    volumeM3: number | null
    loadTons: number | null
    status: '1' | '2'
    sort: number
    schemeColor: string
    tagStyle: string
    remark: string
    imageUrl: string
  }

  interface VehicleTypeTreeNode {
    key: string
    label: string
    category: VehicleTypeCategory
    profile?: VehicleTypeProfile
    children?: VehicleTypeTreeNode[]
  }

  const props = defineProps<{ tenantId?: string | null }>()
  const emit = defineEmits<{ changed: [] }>()
  const captureTenantOperation = useTenantOperationGuard()
  const { deleteGuardRef, deleteRecord, deleteBusy } = useRecordDeleteGuard(
    'vehicle_type_profile',
    '车型规格'
  )
  const { hasAuth } = useAuth()
  const tenantScopeStore = useTenantScopeStore()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const profileStatusOptions = useDictionaryOptions<'1' | '2'>('commonEnabledStatus', (value) =>
    value === 'enabled' ? '1' : '2'
  )
  const { effectiveTenantId, isAllTenants } = storeToRefs(tenantScopeStore)
  const categories = computed(() =>
    (getDictMap.value.vehicleTypeCategory ?? []).map((option) => option.value).filter(Boolean)
  )
  const selectedTenantId = computed(
    () => props.tenantId || effectiveTenantId.value || userStore.getUserInfo.tenantId || ''
  )
  const guardKey = computed(
    () =>
      `${selectedTenantId.value}:${effectiveTenantId.value}:${tenantScopeStore.revision}:${userStore.getUserInfo.userId}`
  )
  const selectedCategory = ref<VehicleTypeCategory>('半挂车')
  const selectedId = ref<string>()
  const profiles = ref<VehicleTypeProfile[]>([])
  const expandedKeys = ref<string[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<Error | null>(null)
  const formRef = ref<InstanceType<typeof ArtForm>>()
  const formControlsReady = computed(() => Boolean(formRef.value?.controlsReady))
  const treeRef = ref<TreeV2Instance>()
  const rightWorkspaceRef = ref<HTMLElement>()
  let contextRevision = 0
  let loadSequence = 0
  let saveSequence = 0
  let loadController: AbortController | undefined
  const TREE_STACK_BREAKPOINT = 1099
  const { width: viewportWidth, height: viewportHeight } = useWindowSize()
  const { height: rightWorkspaceHeight } = useElementSize(rightWorkspaceRef)

  const initialForm = (): ProfileForm => ({
    category: '半挂车',
    lengthM: null,
    volumeM3: null,
    loadTons: null,
    status: '1',
    sort: 10,
    schemeColor: '',
    tagStyle: 'primary',
    remark: '',
    imageUrl: ''
  })
  const form = reactive<ProfileForm>(initialForm())
  const canEdit = computed(() =>
    hasAuth(selectedId.value ? 'VehicleArchive:TypeEdit' : 'VehicleArchive:TypeAdd')
  )

  const profilesByCategory = computed(() => {
    const groups = new Map(Object.entries(groupBy(profiles.value, 'category')))
    for (const rows of groups.values())
      rows.sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))
    return groups
  })
  const categoryProfiles = (category: VehicleTypeCategory): VehicleTypeProfile[] =>
    profilesByCategory.value.get(category) ?? []

  const categoryNodeKey = (category: VehicleTypeCategory): string => `category:${category}`
  const profileNodeKey = (id: string): string => `profile:${id}`
  const treeNodes = computed<VehicleTypeTreeNode[]>(() =>
    categories.value.map((category) => ({
      key: categoryNodeKey(category),
      label: category,
      category,
      children: categoryProfiles(category).map((profile) => ({
        key: profileNodeKey(profile.id),
        label: vehicleTypeProfileLabel(profile),
        category,
        profile
      }))
    }))
  )
  const expandableKeys = computed(() =>
    treeNodes.value.filter((node) => node.children?.length).map((node) => node.key)
  )
  const allExpanded = computed(
    () =>
      expandableKeys.value.length > 0 &&
      expandableKeys.value.every((key) => expandedKeys.value.includes(key))
  )
  const visibleNodeCount = computed(
    () =>
      treeNodes.value.length +
      treeNodes.value.reduce(
        (count, node) =>
          count + (expandedKeys.value.includes(node.key) ? (node.children?.length ?? 0) : 0),
        0
      )
  )
  const treeContentHeight = computed(() => Math.max(40, visibleNodeCount.value * 40) + 8)
  const treeScrollMaxHeight = computed(() =>
    Math.min(600, Math.max(280, viewportHeight.value - 390))
  )
  const stackedTreeHeight = computed(() =>
    viewportWidth.value <= TREE_STACK_BREAKPOINT
      ? `${Math.min(treeContentHeight.value, treeScrollMaxHeight.value)}px`
      : undefined
  )
  const splitterHeight = computed(() =>
    viewportWidth.value <= TREE_STACK_BREAKPOINT || !rightWorkspaceHeight.value
      ? undefined
      : `${Math.ceil(rightWorkspaceHeight.value)}px`
  )

  const expandCategory = (category: VehicleTypeCategory): void => {
    const key = categoryNodeKey(category)
    if (expandedKeys.value.includes(key)) return
    expandedKeys.value = [...expandedKeys.value, key]
    treeRef.value?.setExpandedKeys(expandedKeys.value)
  }

  const toggleAllExpanded = (): void => {
    expandedKeys.value = allExpanded.value ? [] : expandableKeys.value
    treeRef.value?.setExpandedKeys(expandedKeys.value)
  }

  const handleTreeNodeExpand = (data: Record<string, unknown>): void => {
    if (typeof data.key === 'string' && !expandedKeys.value.includes(data.key))
      expandedKeys.value = [...expandedKeys.value, data.key]
  }

  const handleTreeNodeCollapse = (data: Record<string, unknown>): void => {
    if (typeof data.key === 'string')
      expandedKeys.value = expandedKeys.value.filter((key) => key !== data.key)
  }

  const rules = computed<FormRules<ProfileForm>>(() => ({
    lengthM:
      selectedCategory.value === '按载重'
        ? []
        : [{ required: true, message: '请输入车长', trigger: 'change' }],
    remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }]
  }))

  const formItems = computed<FormItem[]>(() => [
    {
      label: '车长（米）',
      key: 'lengthM',
      type: 'number',
      span: 24
    },
    {
      label: '容积（立方米）',
      key: 'volumeM3',
      type: 'number',
      span: 12,
      props: { min: 0, precision: 2, step: 0.1, controls: false, class: '!w-full' }
    },
    {
      label: '载重（吨）',
      key: 'loadTons',
      type: 'number',
      span: 12
    },
    {
      label: '排序',
      key: 'sort',
      type: 'number',
      span: 12,
      props: { min: 0, precision: 0, controls: false, class: '!w-full' }
    },
    {
      label: '状态',
      key: 'status',
      type: 'segment',
      span: 12,
      options: profileStatusOptions
    },
    { label: '方案颜色', key: 'schemeColor', type: 'colorPicker', span: 12 },
    { label: '标签样式', key: 'tagStyle', type: 'tagStyleSelect', span: 12 },
    {
      label: '备注',
      key: 'remark',
      type: 'textarea',
      span: 24,
      props: { rows: 3, maxlength: 500, showWordLimit: true }
    }
  ])

  const selectCategory = (category: VehicleTypeCategory, createNew = false): void => {
    selectedCategory.value = category
    const firstProfile = categoryProfiles(category)[0]
    if (firstProfile && !createNew) {
      selectProfile(firstProfile)
      return
    }
    selectedId.value = undefined
    Object.assign(form, initialForm(), {
      category,
      sort: Math.max(0, ...categoryProfiles(category).map((profile) => profile.sort)) + 10
    })
    void nextTick(() => {
      formRef.value?.clearValidate()
      treeRef.value?.setCurrentKey(categoryNodeKey(category))
    })
  }

  const handleTreeNodeClick = (data: Record<string, unknown>): void => {
    if (typeof data.key !== 'string') return
    const node = treeNodes.value.find((item) => item.key === data.key)
    if (node) {
      selectCategory(node.category, true)
      return
    }
    const profile = profiles.value.find((item) => profileNodeKey(item.id) === data.key)
    if (profile) selectProfile(profile)
  }

  const applyPreset = (value: number): void => {
    if (selectedCategory.value === '按载重') form.loadTons = value
    else form.lengthM = value
  }

  const selectProfile = (profile: VehicleTypeProfile): void => {
    selectedCategory.value = profile.category
    selectedId.value = profile.id
    Object.assign(form, {
      category: profile.category,
      lengthM: profile.lengthM,
      volumeM3: profile.volumeM3,
      loadTons: profile.loadTons,
      status: profile.status,
      sort: profile.sort,
      schemeColor: profile.schemeColor || '',
      tagStyle: profile.tagStyle || 'primary',
      remark: profile.remark || '',
      imageUrl: profile.imageUrl || ''
    })
    void nextTick(() => {
      formRef.value?.clearValidate()
      expandCategory(profile.category)
      treeRef.value?.setCurrentKey(profileNodeKey(profile.id))
    })
  }

  const captureContext = () => {
    const tenantId = selectedTenantId.value
    const revision = contextRevision
    const isCurrentTenantOperation = captureTenantOperation()
    return {
      tenantId,
      isCurrent: () =>
        revision === contextRevision &&
        selectedTenantId.value === tenantId &&
        isCurrentTenantOperation()
    }
  }

  const loadProfiles = async (): Promise<void> => {
    const context = captureContext()
    const requestId = ++loadSequence
    loadController?.abort()
    const controller = new AbortController()
    loadController = controller
    if (!context.tenantId) {
      loading.value = false
      return
    }
    const isCurrent = () =>
      requestId === loadSequence && !controller.signal.aborted && context.isCurrent()
    loading.value = true
    error.value = null
    try {
      const result = await fetchVehicleTypeProfiles(
        { tenantId: context.tenantId, includeDisabled: true },
        { signal: controller.signal }
      )
      if (!isCurrent()) return
      if (result.error) throw result.error
      const rows = result.data ?? []
      if (rows.some((profile) => profile.tenantId !== context.tenantId))
        throw new Error('车型配置租户不一致，请刷新后重试')
      profiles.value = rows
      const current = rows.find((profile) => profile.id === selectedId.value)
      if (current) selectProfile(current)
      else selectCategory(selectedCategory.value)
    } catch (cause) {
      if (!isCurrent()) return
      error.value = cause instanceof Error ? cause : new Error('车型配置加载失败')
    } finally {
      if (isCurrent()) {
        loading.value = false
        loadController = undefined
      }
    }
  }

  const handleSave = async (): Promise<void> => {
    const context = captureContext()
    const rowId = selectedId.value
    const row = profiles.value.find((profile) => profile.id === rowId)
    const category = selectedCategory.value
    const permission = rowId ? 'VehicleArchive:TypeEdit' : 'VehicleArchive:TypeAdd'
    if (
      !context.tenantId ||
      !canEdit.value ||
      !formControlsReady.value ||
      saving.value ||
      deleteBusy.value ||
      (rowId && row?.tenantId !== context.tenantId)
    )
      return
    const saveId = ++saveSequence
    const isCurrent = () =>
      saveId === saveSequence &&
      context.isCurrent() &&
      selectedId.value === rowId &&
      selectedCategory.value === category &&
      hasAuth(permission)
    saving.value = true
    try {
      try {
        await formRef.value?.validate()
      } catch {
        return
      }
      if (!isCurrent()) return
      const result = await saveVehicleTypeProfile(
        {
          id: rowId,
          ...(isAllTenants.value ? { tenantId: row?.tenantId ?? context.tenantId } : {}),
          category,
          lengthM: form.lengthM,
          volumeM3: form.volumeM3,
          loadTons: form.loadTons,
          status: form.status,
          sort: form.sort,
          schemeColor: form.schemeColor || null,
          tagStyle: form.tagStyle || null,
          remark: form.remark || null,
          imageUrl: form.imageUrl || null
        },
        { showMessage: false, showErrorMessage: false }
      )
      if (!isCurrent()) return
      if (result.error) throw result.error
      if (!result.data?.id || result.data.tenantId !== context.tenantId)
        throw new Error('车型规格保存结果不完整，请刷新后重试')
      selectedId.value = result.data.id
      await loadProfiles()
      if (!context.isCurrent() || saveId !== saveSequence || !hasAuth(permission)) return
      if (error.value) {
        notifyFriendlyError(error.value, '车型规格已保存，但列表刷新失败，请重试')
        return
      }
      ElMessage.success('车型规格已保存')
      emit('changed')
    } catch (cause) {
      if (context.isCurrent() && saveId === saveSequence)
        notifyFriendlyError(cause, '车型规格保存失败，请检查配置后重试')
    } finally {
      if (saveId === saveSequence) saving.value = false
    }
  }

  const handleDelete = async (): Promise<void> => {
    const context = captureContext()
    const row = profiles.value.find((profile) => profile.id === selectedId.value)
    if (!row || row.tenantId !== context.tenantId || saving.value || deleteBusy.value) return
    const resource: MasterDataDeleteResource = {
      id: row.id,
      label: vehicleTypeProfileLabel(row),
      status: row.status === '1' ? 'enabled' : 'disabled',
      statusDictCode: 'commonEnabledStatus'
    }
    const driverIds = new Map<string, string>()
    const referenceMeta: Record<string, Partial<MasterDataDeleteDependencyMeta>> = {
      mdm_vehicle: {
        label: '车辆档案',
        statusDictCode: 'vehicleOperationStatus',
        routeName: 'VehicleArchiveDetail',
        applicationCode: 'vms',
        routePath: '/vms/vehicle-archive-manage',
        canNavigate: () => hasAuth('VehicleArchive:View'),
        routeParams: (record) => ({ id: record.targetId })
      },
      vehicle_trailer: {
        label: '挂车档案',
        routeName: 'TrailerManage',
        applicationCode: 'vms',
        routePath: '/vms/trailer-manage',
        canNavigate: () => hasAuth('TrailerManage:View')
      },
      tms_driver_commission_rule: {
        label: '司机佣金规则',
        routeName: 'TmsDriver',
        applicationCode: 'tms',
        routePath: '/tms/basic-data/driver',
        canNavigate: () => hasAuth('TmsDriver:View'),
        routeQuery: (record) => ({
          driverId: driverIds.get(record.targetId) ?? '',
          commissionRuleId: record.targetId
        })
      }
    }
    const inspectReferences = async (
      resources: MasterDataDeleteResource[],
      constraint?: string
    ): Promise<boolean> => {
      if (!context.isCurrent() || selectedId.value !== row.id) {
        ElMessage.error('车型规格或租户已变化，删除已停止，请重新选择')
        return true
      }
      if (!deleteGuardRef.value) {
        ElMessage.error('关联校验尚未就绪，请刷新页面后重试删除')
        return true
      }
      const options = recordDeleteGuardOptions(
        { table: 'vehicle_type_profile', ids: resources.map((item) => item.id), constraint },
        '车型规格',
        resources,
        referenceMeta
      )
      const fetchDependencies = options.fetchDependencies
      if (!fetchDependencies) {
        ElMessage.error('关联校验暂不可用，请刷新页面后重试删除')
        return true
      }
      return deleteGuardRef.value.inspect({
        ...options,
        resolveResources: async () => {
          if (!context.isCurrent() || selectedId.value !== row.id)
            throw new Error('车型规格或租户已变化，请重新检查')
          const current = profiles.value.find((profile) => profile.id === row.id)
          if (!current || current.tenantId !== context.tenantId)
            throw new Error('车型规格或租户已变化，请重新检查')
          return [{ ...resource, label: vehicleTypeProfileLabel(current) }]
        },
        fetchDependencies: async (resourceIds) => {
          if (!context.isCurrent()) throw new Error('租户范围已变化，请重新检查')
          const requiredViews = [
            ['VehicleArchive:View', '车辆档案'],
            ['TrailerManage:View', '挂车档案'],
            ['TmsDriver:View', '司机佣金规则']
          ] as const
          const missing = requiredViews.filter(([permission]) => !hasAuth(permission))
          if (missing.length)
            throw new Error(
              `缺少${missing.map(([, label]) => label).join('、')}查看权限，请联系管理员授权后重试`
            )
          const references = await fetchDependencies(resourceIds)
          if (!context.isCurrent()) throw new Error('租户范围已变化，请重新检查')
          const enriched = await fetchVehicleTypeDeleteReferences(references, context.tenantId)
          if (!context.isCurrent()) throw new Error('租户范围已变化，请重新检查')
          driverIds.clear()
          enriched.driverIds.forEach((driverId, ruleId) => driverIds.set(ruleId, driverId))
          return enriched.records
        }
      })
    }
    await deleteRecord({
      resource,
      permission: 'VehicleArchive:TypeDelete',
      inspectReferences,
      confirmMessage: `确定删除车型规格“${resource.label}”吗？删除后无法恢复。`,
      failureMessage: '车型规格删除失败，请重新检查关联后重试',
      remove: async () => {
        if (!context.isCurrent() || selectedId.value !== row.id)
          throw new Error('车型规格或租户已变化，删除已停止，请重新选择')
        const result = await deleteVehicleTypeProfile(row.id, {
          showMessage: false,
          showErrorMessage: false
        })
        if (result.error) throw result.error
        if (result.data !== true) throw new Error('车型规格未删除，请刷新后核对记录与权限')
      },
      onDeleted: async () => {
        if (!context.isCurrent() || selectedId.value !== row.id) return
        selectedId.value = undefined
        await loadProfiles()
        if (!context.isCurrent()) return
        if (error.value) throw error.value
        ElMessage.success('车型配置已删除')
        emit('changed')
      }
    })
  }

  watch(
    [
      selectedTenantId,
      effectiveTenantId,
      isAllTenants,
      () => tenantScopeStore.revision,
      () => userStore.getUserInfo.userId,
      () => userStore.getUserInfo.tenantId
    ],
    () => {
      contextRevision++
      loadSequence++
      loadController?.abort()
      loadController = undefined
      saveSequence++
      saving.value = false
      loading.value = false
      error.value = null
      profiles.value = []
      selectedId.value = undefined
      selectedCategory.value = '半挂车'
      expandedKeys.value = []
      Object.assign(form, initialForm())
      formRef.value?.clearValidate()
      treeRef.value?.setExpandedKeys([])
      if (selectedTenantId.value) void loadProfiles()
    },
    { immediate: true, flush: 'sync' }
  )
  onBeforeUnmount(() => {
    contextRevision++
    loadSequence++
    saveSequence++
    loadController?.abort()
  })
</script>

<style scoped lang="scss">
  .vehicle-type-tab {
    display: grid;
    gap: 18px;
    min-width: 0;

    &__toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 20px;
      align-items: center;
      justify-content: flex-start;

      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      p {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }
    }

    &__total {
      padding: 6px 10px;
      margin-left: auto;
      font-size: 12px;
      color: var(--el-color-primary);
      white-space: nowrap;
      background: var(--el-color-primary-light-9);
      border-radius: 999px;
    }

    &__layout {
      width: 100%;
      min-width: 0;
      height: auto;
      overflow: visible;

      :deep(.el-splitter-panel) {
        min-width: 0;
      }

      :deep(.art-workspace-splitter__primary),
      :deep(.art-workspace-splitter__secondary) {
        overflow: visible;
      }

      :deep(.art-workspace-splitter__secondary) {
        height: auto;
      }
    }

    &__workspace {
      display: grid;
      gap: 16px;
      min-width: 0;
    }

    &__tree-card {
      --vehicle-tree-inline-padding: var(--art-section-padding);

      display: flex;
      flex-direction: column;
      min-height: 0;
      padding-right: 0;

      :deep(.art-section-card__header) {
        flex: none;
        padding-right: var(--vehicle-tree-inline-padding);
      }

      :deep(.art-section-card__body) {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        min-height: 0;
      }
    }

    &__tree-viewport {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
    }

    &__node {
      display: flex;
      gap: 8px;
      align-items: center;
      width: 100%;
      min-width: 0;
      padding-right: calc(var(--vehicle-tree-inline-padding) + 8px);

      :deep(.vehicle-type-art) {
        flex: none;
        width: 36px;
        height: 26px;
      }
    }

    &__node-label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__node-meta {
      flex: none;
      font-size: 11px;
      color: var(--el-text-color-secondary);
    }

    &__spec-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 10px;
      min-height: 66px;
    }

    &__spec {
      display: grid;
      gap: 7px;
      align-content: center;
      min-width: 0;
      min-height: 72px;
      padding: 10px 12px;
      text-align: left;
      cursor: pointer;
      background: var(--el-bg-color);
      border: 1px solid var(--el-border-color-light);
      border-radius: var(--art-control-radius);
      transition:
        border-color var(--art-motion-fast) ease,
        background-color var(--art-motion-fast) ease;

      > span:last-child {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }

      &:hover,
      &.is-active {
        border-color: var(--theme-color);
      }

      &.is-active {
        background: var(--el-color-primary-light-9);
      }

      &:focus-visible {
        outline: 2px solid var(--theme-color);
        outline-offset: 2px;
      }
    }

    &__spec-heading {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      justify-content: space-between;
      min-width: 0;

      strong {
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 13px;
        color: var(--el-text-color-primary);
        white-space: nowrap;
      }

      :deep(.el-tag) {
        flex: none;
      }
    }

    &__spec-empty {
      display: flex;
      align-items: center;
      padding: 12px;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      background: var(--el-fill-color-extra-light);
      border: 1px dashed var(--el-border-color);
      border-radius: var(--art-control-radius);
    }

    &__detail {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(190px, 238px);
      gap: 24px;
      min-width: 0;
    }

    &__form {
      display: grid;
      gap: 16px;
      align-content: start;
      min-width: 0;

      :deep(.art-form) {
        padding: 0;
      }

      :deep(.el-form-item) {
        margin-bottom: 16px;
      }

      :deep(.el-input-number .el-input__inner) {
        text-align: left;
      }
    }

    &__metric-field {
      display: grid;
      gap: 10px;
      width: 100%;
      min-width: 0;
    }

    &__metric-input {
      position: relative;
      width: 100%;

      :deep(.el-input-number) {
        width: 100%;
      }

      :deep(.el-input__inner) {
        padding-right: 42px;
        text-align: left;
      }

      > span {
        position: absolute;
        top: 50%;
        right: 14px;
        font-size: 12px;
        color: var(--el-text-color-secondary);
        pointer-events: none;
        transform: translateY(-50%);
      }
    }

    &__presets {
      display: grid;
      gap: 8px;

      > span {
        font-size: 12px;
        color: var(--el-text-color-secondary);
      }

      > div {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      :deep(.el-button + .el-button) {
        margin-left: 0;
      }

      :deep(.vehicle-type-tab__preset-button) {
        min-width: 58px;
        height: 32px;
        padding: 0 10px;
        font-size: 12px;
        line-height: 32px;
      }
    }

    &__visual {
      display: grid;
      gap: 10px;
      align-content: start;
      align-self: start;
      justify-items: center;
      min-width: 0;
      padding: 14px;
      background: var(--el-fill-color-extra-light);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--art-control-radius);
    }

    &__visual-heading {
      display: flex;
      gap: 8px;
      align-items: baseline;
      justify-content: space-between;
      width: 100%;

      strong {
        font-size: 13px;
        color: var(--el-text-color-primary);
      }

      span {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }
    }

    &__preview {
      display: grid;
      place-items: center;
      width: 100%;
      height: 134px;
      padding: 8px;
      background: var(--el-bg-color);
      border: 1px solid var(--el-border-color-light);
      border-radius: var(--art-control-radius);

      :deep(.el-image) {
        width: 100%;
        height: 100%;
      }
    }

    &__visual > p {
      width: 100%;
      margin: 0;
      font-size: 11px;
      line-height: 1.5;
      color: var(--el-text-color-secondary);
    }

    @media (width <= 1200px) {
      &__detail {
        grid-template-columns: minmax(0, 1fr);
      }

      &__visual {
        grid-template-columns: minmax(0, 1fr) auto;
        justify-items: start;
      }

      &__visual-heading,
      &__visual > p {
        grid-column: 1 / -1;
      }

      &__preview {
        max-width: 260px;
      }
    }

    @media (width <= 640px) {
      &__tree-card {
        --vehicle-tree-inline-padding: var(--art-space-4);
      }
    }

    @media (width <= 480px) {
      &__visual {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  }
</style>
