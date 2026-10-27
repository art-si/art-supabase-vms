<template>
  <ArtDialog ref="dialogRef" size="xl">
    <template #subtitle>选择车辆和领用配件；提交后自动生成单号并扣减库存。</template>
    <ElAlert
      v-if="stockError"
      class="mb-4"
      type="warning"
      :closable="false"
      show-icon
      title="配件库存加载失败，请关闭后重试"
    />
    <ArtForm
      ref="formRef"
      v-model="form.data"
      :items="form.items"
      :rules="form.rules"
      :span="12"
      label-width="102px"
      :show-reset="false"
      :show-submit="false"
    >
      <template #vehicleId>
        <ArtTableSingleSelect
          v-model="vehicleSelectValue"
          v-model:selected-data="form.vehicleSelection"
          :api-fn="fetchApprovedVehicleSelectData"
          :columns="vehicleColumns"
          row-key="id"
          label-key="plateNo"
          description-key="companyName"
          title="选择领用车辆"
          search-placeholder="输入车牌号或所属公司"
          empty-text="暂无可选车辆"
          empty-description="请先维护并审批车辆档案。"
          show-pagination
          @change="handleVehicleChange"
        />
      </template>
      <template #driverId>
        <VmsDriverSelect
          :model-value="form.data.driverId || null"
          :vehicle-id="form.data.vehicleId"
          :driver-name="form.data.driverName"
          @change="handleDriverChange"
        />
      </template>
      <template #lines>
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <p class="text-xs text-[var(--el-text-color-secondary)]"
              >从库存中选择配件；物料编码、规格和品牌自动带入。</p
            >
            <ElButton type="primary" plain :disabled="!availableParts.length" @click="addLine">
              <span class="art-icon-label"><ArtSvgIcon icon="ri:add-line" />添加明细</span>
            </ElButton>
          </div>
          <div
            v-for="(line, index) in form.data.lines"
            :key="line.key"
            class="rounded-[var(--el-border-radius-base)] border border-[var(--el-border-color-light)] bg-[var(--el-fill-color-extra-light)] p-4"
          >
            <div class="flex items-center justify-between gap-3">
              <strong class="text-sm">领用明细 {{ index + 1 }}</strong>
              <ElButton
                v-if="form.data.lines.length > 1"
                type="danger"
                text
                :aria-label="`移除领用明细 ${index + 1}`"
                @click="removeLine(line.key)"
                >移除</ElButton
              >
            </div>
            <div class="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
              <div class="min-w-0 md:col-span-2">
                <label
                  class="mb-1 block text-xs text-[var(--el-text-color-secondary)]"
                  :for="`part-${line.key}`"
                  >物料描述 <span class="text-[var(--el-color-danger)]">*</span></label
                >
                <ElSelect
                  :id="`part-${line.key}`"
                  v-model="line.partId"
                  filterable
                  class="w-full"
                  placeholder="请选择库存配件"
                  @change="handleLinePartChange(line)"
                >
                  <ElOption
                    v-for="part in availableParts"
                    :key="part.partId"
                    :value="part.partId"
                    :label="`${part.partName} · ${part.partCode}`"
                    :disabled="part.stockQty <= 0"
                  />
                </ElSelect>
              </div>
              <div
                class="min-w-0 rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-light)] px-3 py-2 text-xs text-[var(--el-text-color-secondary)] md:col-span-2"
              >
                <span>物料编码 {{ selectedPart(line)?.partCode || '--' }}</span>
                <span class="mx-3">规格型号 {{ selectedPart(line)?.model || '--' }}</span>
                <span>品牌 {{ selectedPart(line)?.brand || '--' }}</span>
                <span class="ml-3"
                  >可用库存 {{ selectedPart(line)?.stockQty ?? '--' }}
                  {{ selectedPart(line)?.unit || '' }}</span
                >
              </div>
              <div class="min-w-0">
                <label
                  class="mb-1 block text-xs text-[var(--el-text-color-secondary)]"
                  :for="`qty-${line.key}`"
                  >领用数量 <span class="text-[var(--el-color-danger)]">*</span></label
                >
                <ElInputNumber
                  :id="`qty-${line.key}`"
                  v-model="line.issuedQty"
                  :min="1"
                  :precision="0"
                  :max="selectedPart(line)?.stockQty || undefined"
                  :controls="false"
                  class="w-full!"
                />
              </div>
              <div class="min-w-0">
                <label
                  class="mb-1 block text-xs text-[var(--el-text-color-secondary)]"
                  :for="`date-${line.key}`"
                  >领用时间 <span class="text-[var(--el-color-danger)]">*</span></label
                >
                <ElDatePicker
                  :id="`date-${line.key}`"
                  v-model="line.issuedAt"
                  type="datetime"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  class="w-full!"
                />
              </div>
            </div>
            <div class="mt-3 border-t border-[var(--el-border-color-lighter)] pt-3">
              <span class="mb-2 block text-xs text-[var(--el-text-color-secondary)]"
                >配件照片（选填）</span
              >
              <ArtUploadImage
                v-model="line.imageUrl"
                :resource-tenant-id="selectedVehicleTenantId"
                :title="`领用明细 ${index + 1} 配件照片`"
                :size="88"
                :limit="1"
                :file-size="8 * 1024 * 1024"
                file-type="image/png,image/jpeg,image/webp"
                :upload-request="uploadPartImage"
                :show-resource-picker="false"
                :readonly="!selectedVehicleTenantId"
              />
            </div>
          </div>
          <ElAlert v-if="lineError" :title="lineError" type="warning" :closable="false" show-icon />
        </div>
      </template>
    </ArtForm>
  </ArtDialog>
</template>

<script setup lang="ts">
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import { ElAlert, ElButton, ElDatePicker, ElInputNumber, ElOption, ElSelect } from 'element-plus'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import type {
    DataSelectColumn,
    DataSelectKey,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import {
    createVehiclePartIssue,
    fetchApprovedVehicleSelectData,
    fetchVehiclePartStock,
    type VehiclePartStock,
    type VmsDriverReference
  } from '@vms/api'
  import VmsDriverSelect from '../../../components/vms-driver-select.vue'
  import {
    privateAttachmentPathFromSignedUrl,
    uploadPrivateAttachment
  } from '@/utils/supabase/private-attachment'

  defineOptions({ name: 'VmsPartIssueDialog' })

  interface IssueLineForm {
    key: string
    partId: string
    issuedQty: number
    issuedAt: string
    imageUrl: string
  }
  interface IssueForm {
    vehicleId: string
    driverId: string
    driverName: string
    remark: string
    lines: IssueLineForm[]
  }
  interface FormGroup {
    data: IssueForm
    vehicleSelection: DataSelectRecord[]
    items: FormItem[]
    rules: FormRules<IssueForm>
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose>()
  const formRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  const availableParts = ref<VehiclePartStock[]>([])
  const stockError = ref(false)
  const lineError = ref('')
  const selectedVehicleTenantId = ref('')
  let idempotencyKey = crypto.randomUUID()
  const newLine = (): IssueLineForm => ({
    key: crypto.randomUUID(),
    partId: '',
    issuedQty: 1,
    issuedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    imageUrl: ''
  })
  const initialForm = (): IssueForm => ({
    vehicleId: '',
    driverId: '',
    driverName: '',
    remark: '',
    lines: [newLine()]
  })
  const form = reactive<FormGroup>({
    data: initialForm(),
    vehicleSelection: [],
    items: [
      { label: '领用车辆', key: 'vehicleId', span: 12 },
      { label: '领用司机', key: 'driverId', span: 12 },
      { label: '领用明细', key: 'lines', span: 24 },
      {
        label: '备注',
        key: 'remark',
        type: 'input',
        span: 24,
        props: { type: 'textarea', rows: 2, maxlength: 500, showWordLimit: true }
      }
    ],
    rules: { vehicleId: [{ required: true, message: '请选择领用车辆', trigger: 'change' }] }
  })
  const vehicleSelectValue = computed<DataSelectKey | undefined>({
    get: () => form.data.vehicleId || undefined,
    set: (value) => {
      form.data.vehicleId = value ? String(value) : ''
    }
  })
  const vehicleColumns: DataSelectColumn[] = [
    { prop: 'plateNo', label: '车牌号', minWidth: 150 },
    { prop: 'companyName', label: '所属公司', minWidth: 180 }
  ]
  const handleVehicleChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    const vehicle = rows[0] as Api.Vms.ArchiveManage.VehicleArchive | undefined
    if (form.data.vehicleId !== (vehicle?.id || '')) {
      form.data.lines.forEach((line) => {
        line.imageUrl = ''
      })
    }
    Object.assign(form.data, {
      vehicleId: vehicle?.id || '',
      driverId: vehicle?.primaryDriverId || '',
      driverName: vehicle?.primaryDriver?.driverName || vehicle?.driverOneName || ''
    })
    selectedVehicleTenantId.value = vehicle?.tenantId || ''
  }
  const handleDriverChange = (driver: VmsDriverReference | null): void => {
    Object.assign(form.data, {
      driverId: driver?.id || '',
      driverName: driver?.driverName || ''
    })
  }
  const uploadPartImage = (file: File) =>
    uploadPrivateAttachment(file, {
      bucket: 'vms-part-private',
      tenantId: selectedVehicleTenantId.value,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      maxBytes: 8 * 1024 * 1024
    })
  const selectedPart = (line: IssueLineForm): VehiclePartStock | undefined =>
    availableParts.value.find((part) => part.partId === line.partId)
  const handleLinePartChange = (line: IssueLineForm): void => {
    const stock = selectedPart(line)
    if (stock && line.issuedQty > stock.stockQty) line.issuedQty = stock.stockQty
    lineError.value = ''
  }
  const addLine = (): void => {
    form.data.lines.push(newLine())
  }
  const removeLine = (key: string): void => {
    form.data.lines = form.data.lines.filter((line) => line.key !== key)
    lineError.value = ''
  }
  const validateLines = (): boolean => {
    if (
      !form.data.lines.length ||
      form.data.lines.some((line) => !line.partId || !line.issuedAt || line.issuedQty < 1)
    ) {
      lineError.value = '请为每条领用明细选择配件、数量和时间'
      return false
    }
    const requested = new Map<string, number>()
    for (const line of form.data.lines)
      requested.set(line.partId, (requested.get(line.partId) || 0) + line.issuedQty)
    for (const [partId, qty] of requested) {
      const stock = availableParts.value.find((part) => part.partId === partId)
      if (!stock || qty > stock.stockQty) {
        lineError.value = `领用数量超过“${stock?.partName || '所选配件'}”当前库存，请调整后重试`
        return false
      }
    }
    lineError.value = ''
    return true
  }
  const handleConfirm = async (): Promise<boolean> => {
    if (!(await validateArtFormForSubmit(formRef.value)) || !validateLines()) return false
    try {
      await createVehiclePartIssue({
        vehicleId: form.data.vehicleId,
        driverId: form.data.driverId || undefined,
        remark: form.data.remark,
        idempotencyKey,
        lines: form.data.lines.map((line) => ({
          partId: line.partId,
          issuedQty: line.issuedQty,
          issuedAt: line.issuedAt,
          imagePath: line.imageUrl
            ? privateAttachmentPathFromSignedUrl(line.imageUrl, 'vms-part-private')
            : undefined
        }))
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '配件领用失败，请核对车辆和库存后重试')
      return false
    }
  }
  const handleOpen = async (): Promise<void> => {
    Object.assign(form.data, initialForm())
    form.vehicleSelection = []
    selectedVehicleTenantId.value = ''
    lineError.value = ''
    stockError.value = false
    idempotencyKey = crypto.randomUUID()
    try {
      const result = await fetchVehiclePartStock()
      if (result.error) throw result.error
      availableParts.value = result.data
    } catch {
      stockError.value = true
      availableParts.value = []
    }
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(undefined, {
      title: '新建领用单',
      confirmText: '确认领用',
      onConfirm: handleConfirm
    })
  }
  defineExpose({ handleOpen })
</script>
