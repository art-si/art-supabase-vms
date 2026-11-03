<template>
  <div
    class="vehicle-query-summary art-card-xs grid items-center gap-4 p-4"
    :class="
      showBack
        ? 'min-[901px]:grid-cols-[32px_112px_minmax(0,1fr)]'
        : 'min-[901px]:grid-cols-[112px_minmax(0,1fr)]'
    "
  >
    <ElButton
      v-if="showBack"
      text
      circle
      aria-label="返回车辆查询"
      title="返回车辆查询"
      @click="emit('back')"
    >
      <ArtSvgIcon icon="ri:arrow-left-line" />
    </ElButton>
    <div
      class="vehicle-query-summary__photo h-[88px] w-[112px] overflow-hidden rounded-[var(--el-border-radius-base)]"
    >
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
        class="vehicle-query-summary__photo-empty flex h-full w-full items-center justify-center bg-[var(--el-fill-color-light)] text-[32px] text-[var(--el-text-color-placeholder)]"
      >
        <ArtSvgIcon icon="ri:bus-2-line" />
      </div>
    </div>

    <div class="vehicle-query-summary__main grid min-w-0 gap-2">
      <header
        class="vehicle-query-summary__header flex min-w-0 gap-4 min-[641px]:items-center min-[641px]:justify-between max-[640px]:flex-col max-[640px]:items-stretch"
      >
        <div class="grid min-w-0 gap-[3px]">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="m-0 text-base font-bold text-[var(--el-text-color-primary)]">{{
              vehicle.plateNo
            }}</h1>
            <ArtDictDisplay
              v-if="vehicle.operationStatus"
              dict-code="vehicleOperationStatus"
              :value="vehicle.operationStatus"
              display="tag"
              unknown-text="未识别"
            />
            <ArtDictDisplay
              v-if="vehicle.auditStatus"
              dict-code="vehicleAuditStatus"
              :value="vehicle.auditStatus"
              display="tag"
              unknown-text="未识别"
            />
          </div>
          <small class="truncate text-[var(--el-text-color-secondary)]">{{
            vehicle.companyName || '未设置所属公司'
          }}</small>
        </div>
        <ElButton v-auth="'VehicleQuery:AiAnalyze'" type="primary" plain @click="emit('analyze')">
          <ArtSvgIcon icon="ri:sparkling-2-line" />AI 车辆健康研判
        </ElButton>
      </header>
      <dl
        class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--el-text-color-regular)]"
      >
        <div class="inline-flex items-center gap-1.5"
          ><dt>车辆归属</dt
          ><dd class="m-0 font-medium"
            ><ArtDictDisplay
              dict-code="vehicleOwnership"
              :value="vehicle.vehicleOwnership"
              unknown-text="未识别" /></dd
        ></div>
        <div class="inline-flex items-center gap-1.5"
          ><dt>主司机/电话</dt><dd class="m-0 font-medium">{{ driverContact }}</dd></div
        >
        <div class="inline-flex items-center gap-1.5"
          ><dt>行驶里程</dt
          ><dd class="m-0 font-bold text-[var(--el-text-color-primary)]">{{
            formatMileage(summary.runningMileage)
          }}</dd></div
        >
      </dl>
      <dl
        class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--el-text-color-secondary)]"
      >
        <div class="inline-flex items-center gap-1.5"
          ><dt>车型</dt
          ><dd class="m-0"
            ><ArtDictDisplay
              dict-code="vehicleType"
              :value="vehicle.vehicleType"
              display="text"
              :unknown-text="getVehicleTypeFallbackLabel(vehicle.vehicleType)" /></dd
        ></div>
        <div class="inline-flex items-center gap-1.5"
          ><dt>车长</dt><dd class="m-0">{{ formatValue(vehicle.specLengthM, ' 米') }}</dd></div
        >
        <div class="inline-flex items-center gap-1.5"
          ><dt>容积</dt><dd class="m-0">{{ formatValue(vehicle.volumeM3, ' 立方米') }}</dd></div
        >
        <div class="inline-flex items-center gap-1.5"
          ><dt>载重</dt><dd class="m-0">{{ formatValue(vehicle.loadTons, ' 吨') }}</dd></div
        >
      </dl>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ElButton, ElImage } from 'element-plus'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import type { VehicleArchive, VehicleQuerySummary } from './types'
  import { formatMileage, formatValue } from './query-format'
  import { canViewField } from '@/utils/field-permission'
  import { getVehicleTypeFallbackLabel } from '@/utils/business/vehicle-type-display'

  defineOptions({ name: 'VehicleQuerySummary' })

  const props = defineProps<{
    vehicle: VehicleArchive
    summary: VehicleQuerySummary
    showBack?: boolean
  }>()
  const emit = defineEmits<{ analyze: []; back: [] }>()
  const driverContact = computed(() => {
    const name = props.vehicle.primaryDriver?.driverName || '未设置'
    const phone = canViewField(props.vehicle.primaryDriver?.fieldAccess, 'contactPhone')
      ? props.vehicle.primaryDriver?.phone
      : undefined
    return phone ? `${name} / ${phone}` : name
  })
</script>
