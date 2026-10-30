<template>
  <ArtDialog ref="dialogRef" size="xl" :loading="loading">
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
    <template #footer="{ loading: confirming, api }">
      <div class="flex items-center justify-end gap-2">
        <span v-if="!selectedProfile" class="mr-auto text-xs text-[var(--el-text-color-secondary)]">
          {{ error ? '加载失败，请重试' : profiles.length ? '请选择具体规格' : '暂无可用规格' }}
        </span>
        <ElButton :disabled="loading || confirming" @click="api.handleClose()">取消</ElButton>
        <ElButton
          class="ml-0!"
          type="primary"
          :loading="confirming"
          :disabled="loading || !!error || !selectedProfile"
          @click="api.handleConfirm()"
          >使用此车型</ElButton
        >
      </div>
    </template>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { ElButton } from 'element-plus'
  import { storeToRefs } from 'pinia'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import VehicleTypeProfilePicker from '@/components/business/vehicle-type-profile-picker/index.vue'
  import { useUserStore } from '@/store/modules/user'
  import { fetchVehicleTypeProfiles } from '@vms/api'
  import type { VehicleTypeProfile } from './vehicle-type-catalog'

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
  const selectedProfile = computed(() =>
    profiles.value.find((profile) => profile.id === selectedId.value)
  )

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
      selectedId.value = profiles.value.find(
        (profile) => profile.id === openData.value.selectedId
      )?.id
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
