<template>
  <ArtDialog
    ref="dialogRef"
    size="xl"
    :loading="loading"
    :confirm-disabled="!!error || !selectedProfile"
  >
    <template #subtitle>
      选择已有启用规格的车型分类，容积和载重将随规格自动带入。待配置分类暂不可选。
    </template>
    <ArtAsyncState :error="error" :min-height="360" @retry="loadProfiles">
      <VehicleTypeProfilePicker
        v-model="selectedId"
        :profiles="profiles"
        :categories="categories"
      />
    </ArtAsyncState>
    <template #footer-left>
      <div v-if="selectedProfile && !error" class="flex min-w-0 flex-col gap-1">
        <strong
          class="truncate text-sm font-medium text-[var(--el-text-color-primary)]"
          :title="vehicleTypeProfileLabel(selectedProfile)"
        >
          {{ vehicleTypeProfileLabel(selectedProfile) }}
        </strong>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--el-text-color-secondary)]">
          <span>容积 {{ formatVehicleTypeMetric(selectedProfile.volumeM3, '立方米') }}</span>
          <span>载重 {{ formatVehicleTypeMetric(selectedProfile.loadTons, '吨') }}</span>
        </div>
      </div>
      <span v-else class="text-xs text-[var(--el-text-color-secondary)]">
        {{
          loading
            ? '正在加载车型…'
            : error
              ? '加载失败，请重试'
              : profiles.length
                ? '请选择具体规格'
                : '暂无可用规格'
        }}
      </span>
    </template>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { storeToRefs } from 'pinia'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import { useArtOverlaySession } from '@/hooks/core/useArtOverlay'
  import VehicleTypeProfilePicker from '@/components/business/vehicle-type-profile-picker/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { fetchVehicleTypeProfiles } from '@vms/api'
  import type { VehicleTypeProfile } from './vehicle-type-catalog'
  import {
    formatVehicleTypeMetric,
    vehicleTypeProfileLabel
  } from '@/utils/business/vehicle-type-display'

  interface OpenData {
    vehicleId?: string
    carrierId?: string
    tenantId?: string
    selectedId?: string | null
  }

  const emit = defineEmits<{ selected: [profile: VehicleTypeProfile] }>()
  const { getDictMap } = storeToRefs(useUserStore())
  const categories = computed(() =>
    (getDictMap.value.vehicleTypeCategory ?? []).map((option) => option.value).filter(Boolean)
  )
  const dialogRef = ref<ArtDialogExpose<OpenData>>()
  const openData = ref<OpenData>({})
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const profiles = ref<VehicleTypeProfile[]>([])
  const selectedId = ref<string | null>()
  const requests = useArtOverlaySession(() => Boolean(unref(dialogRef.value?.visible)))
  const selectedProfile = computed(() =>
    profiles.value.find((profile) => profile.id === selectedId.value)
  )

  const loadProfiles = async (): Promise<void> => {
    const request = requests.invalidate()
    const { vehicleId, carrierId, tenantId, selectedId: initialSelectedId } = openData.value
    loading.value = true
    error.value = null
    try {
      const result = await fetchVehicleTypeProfiles({
        vehicleId,
        carrierId,
        tenantId
      })
      if (!requests.isCurrent(request)) return
      if (result.error) throw result.error
      profiles.value = result.data ?? []
      selectedId.value = profiles.value.find((profile) => profile.id === initialSelectedId)?.id
    } catch (cause) {
      if (requests.isCurrent(request)) {
        error.value = cause instanceof Error ? cause : new Error('车型规格加载失败')
      }
    } finally {
      if (requests.isCurrent(request)) {
        loading.value = false
        dialogRef.value?.setLoading(false)
      }
    }
  }

  const handleOpen = async (data: OpenData): Promise<void> => {
    requests.invalidate()
    openData.value = data
    profiles.value = []
    selectedId.value = null
    error.value = null
    loading.value = true
    await dialogRef.value?.handleOpen(data, {
      title: '参选车型',
      confirmText: '使用此车型',
      loading: true,
      loadingText: '正在加载可选车型…',
      onOpen: loadProfiles,
      onConfirm: () => {
        if (!selectedProfile.value) return false
        emit('selected', selectedProfile.value)
        return true
      }
    })
  }
  defineExpose({ handleOpen })
</script>
