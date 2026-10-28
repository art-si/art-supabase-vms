<template>
  <ArtDialog ref="dialogRef" size="xl" :loading="loading">
    <template #subtitle
      >选择已有启用规格的车型分类，容积和载重将随规格自动带入。待配置分类暂不可选。</template
    >
    <div class="vehicle-type-picker">
      <ArtAsyncState :error="error" :min-height="360" @retry="loadProfiles">
        <div class="vehicle-type-picker__categories">
          <button
            v-for="category in categories"
            :key="category"
            type="button"
            class="vehicle-type-picker__category"
            :class="{
              'is-active': selectedCategory === category && !!categoryProfiles(category).length
            }"
            :disabled="!categoryProfiles(category).length"
            :aria-pressed="selectedCategory === category && !!categoryProfiles(category).length"
            :title="
              !categoryProfiles(category).length ? '暂无启用规格，请先维护车型配置' : undefined
            "
            @click="selectCategory(category)"
          >
            <VehicleTypeArt :category="category" />
            <span>{{ category }}</span>
            <small>{{
              categoryProfiles(category).length
                ? `${categoryProfiles(category).length} 项规格`
                : '暂无可选规格'
            }}</small>
          </button>
        </div>

        <div class="vehicle-type-picker__specifications">
          <div class="vehicle-type-picker__section-heading">
            <strong>{{ selectedCategory === '按载重' ? '选择载重' : '选择规格 / 车长' }}</strong>
            <span>
              已展示全部
              {{ categoryProfiles(selectedCategory).length }} 项启用规格，选择后自动带出容积和载重
            </span>
          </div>
          <div
            v-if="categoryProfiles(selectedCategory).length"
            class="vehicle-type-picker__choices"
          >
            <button
              v-for="profile in categoryProfiles(selectedCategory)"
              :key="profile.id"
              type="button"
              class="vehicle-type-picker__choice"
              :class="{ 'is-active': selectedId === profile.id }"
              :aria-pressed="selectedId === profile.id"
              :aria-label="`${vehicleTypeProfileLabel(profile)}，容积${formatMetric(profile.volumeM3, '立方米')}，载重${formatMetric(profile.loadTons, '吨')}`"
              @click="selectedId = profile.id"
            >
              {{
                profile.category === '按载重' ? `${profile.loadTons} 吨` : `${profile.lengthM} 米`
              }}
            </button>
          </div>
          <ArtEmptyState
            v-else
            title="该分类尚无启用规格"
            description="可切换其他分类，或联系档案管理员维护车型配置。"
            size="compact"
            :visual-size="72"
          />
        </div>

        <div v-if="selectedProfile" class="vehicle-type-picker__summary">
          <div class="vehicle-type-picker__summary-image">
            <ElImage
              v-if="selectedProfile.imageUrl"
              :src="selectedProfile.imageUrl"
              :alt="`${vehicleTypeProfileLabel(selectedProfile)}图片`"
              fit="contain"
            />
            <VehicleTypeArt v-else :category="selectedProfile.category" />
          </div>
          <div class="vehicle-type-picker__summary-content">
            <div class="vehicle-type-picker__summary-title">
              <strong>{{ vehicleTypeProfileLabel(selectedProfile) }}</strong>
              <span>已选规格</span>
            </div>
            <div class="vehicle-type-picker__metrics">
              <span
                >车长 <b>{{ formatMetric(selectedProfile.lengthM, '米') }}</b></span
              >
              <span
                >容积 <b>{{ formatMetric(selectedProfile.volumeM3, '立方米') }}</b></span
              >
              <span
                >载重 <b>{{ formatMetric(selectedProfile.loadTons, '吨') }}</b></span
              >
            </div>
          </div>
        </div>
      </ArtAsyncState>
    </div>
    <template #footer="{ loading: confirming, api }">
      <div class="vehicle-type-picker__footer">
        <span v-if="!selectedProfile" class="vehicle-type-picker__footer-hint">
          {{ error ? '加载失败，请重试' : profiles.length ? '请选择具体规格' : '暂无可用规格' }}
        </span>
        <ElButton :disabled="loading || confirming" @click="api.handleClose()">取消</ElButton>
        <ElButton
          type="primary"
          :loading="confirming"
          :disabled="loading || !!error || !selectedProfile"
          @click="api.handleConfirm()"
        >
          使用此车型
        </ElButton>
      </div>
    </template>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { ElButton, ElImage } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { storeToRefs } from 'pinia'
  import VehicleTypeArt from './vehicle-type-art.vue'
  import { fetchVehicleTypeProfiles } from '@vms/api'
  import {
    vehicleTypeProfileLabel,
    type VehicleTypeCategory,
    type VehicleTypeProfile
  } from './vehicle-type-catalog'

  interface OpenData {
    vehicleId?: string
    carrierId?: string
    tenantId?: string
    selectedId?: string | null
  }

  const emit = defineEmits<{ selected: [profile: VehicleTypeProfile] }>()
  const userStore = useUserStore()
  const { getDictMap } = storeToRefs(userStore)
  const categories = computed(() =>
    (getDictMap.value.vehicleTypeCategory ?? []).map((option) => option.value).filter(Boolean)
  )
  const dialogRef = ref<ArtDialogExpose<OpenData>>()
  const openData = ref<OpenData>({})
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const profiles = ref<VehicleTypeProfile[]>([])
  const selectedCategory = ref<VehicleTypeCategory>('半挂车')
  const selectedId = ref<string>()
  const selectedProfile = computed(() =>
    profiles.value.find((profile) => profile.id === selectedId.value)
  )

  const categoryProfiles = (category: VehicleTypeCategory): VehicleTypeProfile[] =>
    profiles.value
      .filter((profile) => profile.category === category)
      .sort((a, b) => a.sort - b.sort || a.id.localeCompare(b.id))

  const selectCategory = (category: VehicleTypeCategory): void => {
    if (!categoryProfiles(category).length) return
    selectedCategory.value = category
    selectedId.value = undefined
  }

  const formatMetric = (value: number | null, unit: string): string =>
    value == null ? '未配置' : `${value} ${unit}`

  const loadProfiles = async (): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const result = await fetchVehicleTypeProfiles({
        vehicleId: openData.value.vehicleId,
        carrierId: openData.value.carrierId,
        tenantId: openData.value.tenantId
      })
      if (result.error) throw result.error
      profiles.value = result.data ?? []
      const current = profiles.value.find((profile) => profile.id === openData.value.selectedId)
      selectedCategory.value = current?.category ?? profiles.value[0]?.category ?? '半挂车'
      selectedId.value = current?.id
    } catch (cause) {
      error.value = cause instanceof Error ? cause : new Error('车型规格加载失败')
    } finally {
      loading.value = false
    }
  }

  const handleOpen = async (data: OpenData): Promise<void> => {
    openData.value = data
    await dialogRef.value?.handleOpen(data, {
      title: '参选车型',
      confirmText: '使用此车型',
      loading: true,
      loadingText: '正在加载可选车型…',
      onOpen: async (_openData, api) => {
        try {
          await loadProfiles()
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: () => {
        if (!selectedProfile.value) return false
        emit('selected', selectedProfile.value)
        return true
      }
    })
  }

  defineExpose({ handleOpen })
</script>

<style scoped lang="scss">
  .vehicle-type-picker {
    min-width: 0;

    &__categories {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 10px;
    }

    &__category {
      display: grid;
      gap: 6px;
      place-items: center;
      min-width: 0;
      min-height: 130px;
      padding: 10px 8px 12px;
      color: var(--el-text-color-primary);
      cursor: pointer;
      background: var(--el-bg-color);
      border: 1px solid var(--el-border-color-light);
      border-radius: var(--art-control-radius);
      transition:
        border-color var(--art-motion-fast) ease,
        background-color var(--art-motion-fast) ease;

      :deep(.vehicle-type-art) {
        height: 70px;
      }

      span {
        font-size: 13px;
        font-weight: 600;
      }

      small {
        font-size: 11px;
        color: var(--el-text-color-secondary);
      }

      &:hover {
        border-color: var(--theme-color);
      }

      &:disabled {
        color: var(--el-text-color-secondary);
        cursor: not-allowed;
        background: var(--el-fill-color-extra-light);

        :deep(.vehicle-type-art) {
          opacity: 0.55;
        }

        &:hover {
          border-color: var(--el-border-color-light);
        }
      }

      &.is-active {
        background: var(--el-color-primary-light-9);
        border-color: var(--theme-color);
        box-shadow: inset 0 0 0 1px var(--theme-color);
      }

      &:focus-visible {
        outline: 2px solid var(--theme-color);
        outline-offset: 2px;
      }
    }

    &__specifications {
      margin-top: 24px;
    }

    &__section-heading {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: baseline;
      margin-bottom: 10px;
    }

    &__section-heading strong {
      font-size: 13px;
    }

    &__section-heading span {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__choices {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
      gap: 8px;
    }

    &__choice {
      min-width: 72px;
      min-height: 36px;
      padding: 6px 12px;
      color: var(--el-text-color-primary);
      cursor: pointer;
      background: var(--el-bg-color);
      border: 1px solid var(--el-border-color);
      border-radius: var(--art-control-radius);

      &:hover {
        border-color: var(--theme-color);
      }

      &.is-active {
        font-weight: 600;
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
        border-color: var(--theme-color);
      }

      &:focus-visible {
        outline: 2px solid var(--theme-color);
        outline-offset: 2px;
      }
    }

    &__summary {
      display: grid;
      grid-template-columns: 110px minmax(0, 1fr);
      gap: 16px;
      align-items: center;
      padding: 16px 18px;
      margin-top: 20px;
      font-size: 12px;
      background: var(--el-color-primary-light-9);
      border-radius: var(--art-control-radius);
    }

    &__summary-image {
      display: grid;
      place-items: center;
      min-width: 0;
      height: 72px;
      padding: 4px;
      background: var(--el-bg-color);
      border: 1px solid var(--el-border-color-lighter);
      border-radius: var(--art-control-radius);

      :deep(.el-image),
      :deep(.vehicle-type-art) {
        width: 100%;
        height: 100%;
      }
    }

    &__summary-content {
      display: grid;
      gap: 10px;
      min-width: 0;
    }

    &__footer {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;

      :deep(.el-button + .el-button) {
        margin-left: 0;
      }
    }

    &__footer-hint {
      margin-right: auto;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }

    &__summary-title {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;

      strong {
        font-size: 14px;
      }

      span {
        color: var(--el-color-primary);
      }
    }

    &__metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 24px;
      color: var(--el-text-color-secondary);

      b {
        margin-left: 4px;
        font-weight: 600;
        color: var(--el-text-color-primary);
      }
    }

    @media (width <= 1050px) {
      &__categories {
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }
    }

    @media (width <= 720px) {
      &__categories {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (width <= 460px) {
      &__categories {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  }
</style>
