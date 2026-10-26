<template>
  <ArtSectionCard
    v-if="!canViewDocuments"
    title="车辆证件"
    subtitle="证件编号、发证信息与影像"
    empty
    empty-title="暂无证件查看权限"
    empty-description="请联系管理员开通车辆证件字段权限。"
    :min-height="260"
  />
  <div v-else class="flex min-w-0 flex-col gap-4">
    <ArtSectionCard
      v-if="canViewIdentifiers"
      title="证件信息"
      subtitle="车辆登记与营运证照编号"
      :empty="!hasIdentifierValues"
      empty-title="暂无证件编号"
      empty-description="车辆档案尚未录入证件编号或发证日期。"
      :min-height="180"
    >
      <ArtDescriptions
        :data="descriptionData"
        :items="certificateDescriptions"
        :label-width="128"
      />
    </ArtSectionCard>
    <ArtSectionCard
      title="证件影像"
      subtitle="点击图片可放大查看"
      :empty="!availableImages.length"
      empty-title="暂无证件影像"
      empty-description="车辆档案尚未上传车辆照片或证件影像。"
      :min-height="220"
    >
      <div class="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <figure
          v-for="item in availableImages"
          :key="item.key"
          class="min-w-0 rounded-[var(--el-border-radius-base)] border border-[var(--el-border-color-lighter)] bg-[var(--el-fill-color-light)] p-3"
        >
          <ElImage
            :src="item.url"
            :alt="item.label"
            :preview-src-list="previewImages"
            fit="contain"
            class="h-36 w-full"
          />
          <figcaption
            class="mt-2 truncate text-center text-sm font-medium text-[var(--el-text-color-regular)]"
            :title="item.label"
          >
            {{ item.label }}
          </figcaption>
        </figure>
      </div>
    </ArtSectionCard>
  </div>
</template>

<script setup lang="ts">
  import { ElImage } from 'element-plus'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import ArtSectionCard from '@/components/core/surfaces/art-section-card/index.vue'
  import { canViewField } from '@/utils/field-permission'
  import { createDescriptionItems } from './query-format'
  import type { InfoItem, VehicleArchive } from './types'

  defineOptions({ name: 'VehicleQueryDocumentsPanel' })
  const props = defineProps<{ vehicle: VehicleArchive }>()

  type ImageKey =
    'vehiclePhotoUrl' | 'drivingLicenseFrontUrl' | 'drivingLicenseBackUrl' | 'operationLicenseUrl'
  const certificateImages: Array<{ key: ImageKey; label: string }> = [
    { key: 'vehiclePhotoUrl', label: '车辆照片' },
    { key: 'drivingLicenseFrontUrl', label: '行驶证正页' },
    { key: 'drivingLicenseBackUrl', label: '行驶证副页' },
    { key: 'operationLicenseUrl', label: '运营证照片' }
  ]
  const descriptionData = Object.freeze({})
  const canViewDocuments = computed(() => canViewField(props.vehicle.fieldAccess, 'documents'))
  const canViewIdentifiers = computed(() =>
    canViewField(props.vehicle.fieldAccess, 'vehicleIdentifiers')
  )
  const certificateDetails = computed<InfoItem[]>(() => [
    { label: '营运证号', value: props.vehicle.operationCertNo },
    { label: '购置证号', value: props.vehicle.purchaseCertNo },
    { label: '登记证号', value: props.vehicle.registrationCertNo },
    { label: '登记日期', value: props.vehicle.registerDate },
    { label: '发证日期', value: props.vehicle.issueDate }
  ])
  const hasIdentifierValues = computed(() =>
    certificateDetails.value.some(
      (item) => item.value !== null && item.value !== undefined && item.value !== ''
    )
  )
  const certificateDescriptions = computed(() => createDescriptionItems(certificateDetails.value))
  const availableImages = computed(() =>
    certificateImages.flatMap((item) => {
      const url = props.vehicle[item.key]
      return url ? [{ ...item, url }] : []
    })
  )
  const previewImages = computed(() => availableImages.value.map((item) => item.url))
</script>
