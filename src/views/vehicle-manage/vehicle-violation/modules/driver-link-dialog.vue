<template>
  <ArtDialog ref="dialogRef" size="sm" :show-fullscreen-button="false">
    <ArtForm
      v-model="form"
      :items="items"
      :span="24"
      label-width="100px"
      :show-reset="false"
      :show-submit="false"
    >
      <template #driverId>
        <VmsDriverSelect
          :model-value="form.driverId"
          :vehicle-id="record?.vehicleId"
          :driver-name="selectedName"
          @change="selectDriver"
        />
      </template>
    </ArtForm>
  </ArtDialog>
</template>
<script setup lang="ts">
  import { ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { linkVehicleViolationDriver, type VmsDriverReference } from '@vms/api'
  import VmsDriverSelect from '../../../components/vms-driver-select.vue'

  type ViolationRecord = Api.Vms.VehicleManage.VehicleViolationRecord
  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<ViolationRecord>>()
  const record = ref<ViolationRecord>()
  const form = ref<{ driverId: string | null }>({ driverId: null })
  const selectedName = ref('')
  const items: FormItem[] = [
    {
      key: 'driverId',
      label: '关联司机',
      type: 'slot',
      description: '按违章发生时的实际驾驶员关联。清空可撤销关联，原登记姓名仍保留。'
    }
  ]

  function selectDriver(driver: VmsDriverReference | null): void {
    form.value.driverId = driver?.id ?? null
    selectedName.value = driver?.driverName ?? ''
  }
  async function submit(): Promise<boolean> {
    const current = record.value
    if (!current?.id || !current.updateTime) return false
    try {
      const result = await linkVehicleViolationDriver({
        id: current.id,
        driverId: form.value.driverId,
        expectedUpdatedAt: current.updateTime
      })
      if (result.error) return false
      ElMessage.success('司机关联已保存')
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '司机关联失败，请刷新记录后重试')
      return false
    }
  }
  async function handleOpen(row: ViolationRecord): Promise<void> {
    if (!row.id || !row.updateTime || !row.vehicleId) {
      ElMessage.warning('记录缺少车辆或版本信息，请刷新列表后重试')
      return
    }
    record.value = { ...row }
    form.value = { driverId: row.driverId ?? null }
    selectedName.value = row.linkedDriverName ?? ''
    await dialogRef.value?.handleOpen(row, {
      title: '关联违章司机',
      subtitle: `${row.plateNo} · 原登记姓名：${row.driverName || '未登记'}`,
      onConfirm: submit
    })
  }
  defineExpose({ handleOpen })
</script>
