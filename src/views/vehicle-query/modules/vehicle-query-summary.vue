<template>
  <div
    class="vehicle-query-summary art-card-xs grid gap-7 p-6 min-[901px]:grid-cols-[220px_minmax(0,1fr)]"
  >
    <div class="vehicle-query-summary__photo h-[150px] w-full max-w-[260px] min-[901px]:w-[220px]">
      <ElImage
        v-if="vehicle.vehiclePhotoUrl"
        :src="vehicle.vehiclePhotoUrl"
        class="h-full w-full"
        :alt="`${vehicle.plateNo || '车辆'}照片`"
        fit="cover"
        :preview-src-list="[vehicle.vehiclePhotoUrl]"
      />
      <div
        v-else
        class="vehicle-query-summary__photo-empty flex h-full w-full items-center justify-center bg-[var(--el-fill-color-light)] text-[56px] text-[var(--el-text-color-placeholder)]"
      >
        <ArtSvgIcon icon="ri:bus-2-line" />
      </div>
    </div>

    <div class="vehicle-query-summary__main grid min-w-0 gap-3.5">
      <header
        class="vehicle-query-summary__header flex min-w-0 gap-4 min-[641px]:items-center min-[641px]:justify-between max-[640px]:flex-col max-[640px]:items-stretch"
      >
        <div class="grid min-w-0 gap-[3px]">
          <span class="text-base font-bold text-[var(--el-text-color-primary)]">车辆综合档案</span>
          <small class="truncate text-[var(--el-text-color-secondary)]"
            >汇总车辆合规、运营和维保关键数据</small
          >
        </div>
        <ElButton v-auth="'VehicleQuery:AiAnalyze'" type="primary" plain @click="emit('analyze')">
          <ArtSvgIcon icon="ri:sparkling-2-line" />AI 车辆健康研判
        </ElButton>
      </header>
      <ArtDescriptions :data="descriptionData" :items="descriptionItems" :label-width="128" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ElButton, ElImage } from 'element-plus'
  import ArtDescriptions from '@/components/core/base/art-descriptions/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { InfoItem, VehicleArchive, VehicleQuerySummary } from './types'
  import { createDescriptionItems, formatDate, formatMileage } from './query-format'
  import { formatNumberValue } from '@/utils/ui/format'
  import { canViewField } from '@/utils/field-permission'
  import { getVehicleUsageYears } from '@vms/views/vehicle-manage/modules/vehicle-lifecycle'

  defineOptions({ name: 'VehicleQuerySummary' })

  const props = defineProps<{
    vehicle: VehicleArchive
    summary: VehicleQuerySummary
  }>()
  const emit = defineEmits<{ analyze: [] }>()
  const descriptionData = Object.freeze({})

  const descriptionItems = computed(() => {
    const years = getVehicleUsageYears(props.vehicle.startUseDate)
    return createDescriptionItems([
      { label: '车牌号', value: props.vehicle.plateNo },
      { label: '所属机构', value: props.vehicle.companyName },
      { label: '车型', value: props.vehicle.vehicleType, dictCode: 'vehicleType' },
      { label: '车型厂商', value: props.vehicle.manufacturer },
      ...(canViewField(props.vehicle.fieldAccess, 'vehicleIdentifiers')
        ? [{ label: '车架号', value: props.vehicle.vin }]
        : []),
      { label: '购入开票日期', value: formatDate(props.vehicle.invoiceDate) },
      { label: '启用日期', value: formatDate(props.vehicle.startUseDate) },
      {
        label: '运营状态',
        value: props.vehicle.operationStatus,
        dictCode: 'vehicleOperationStatus'
      },
      {
        label: '审核状态',
        value: props.vehicle.auditStatus,
        dictCode: 'vehicleAuditStatus'
      },
      {
        label: '运营时长',
        value: years === null ? undefined : formatNumberValue(years),
        suffix: '年'
      },
      { label: '运营行驶里程', value: formatMileage(props.summary.runningMileage) },
      { label: '商业险到期', value: formatDate(props.summary.commercialExpireDate) },
      { label: '交强险到期', value: formatDate(props.summary.compulsoryExpireDate) },
      { label: '年检到期', value: formatDate(props.summary.inspectionExpireDate) },
      { label: '下次保养里程', value: formatMileage(props.summary.nextMaintenanceMileage) },
      { label: '下次保养时间', value: formatDate(props.summary.nextMaintenanceDate) }
    ] satisfies InfoItem[])
  })
</script>
