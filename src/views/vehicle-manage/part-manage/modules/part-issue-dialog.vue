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
    >
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
          <ArtTable
            ref="lineTableRef"
            :data="form.data.lines"
            :columns="lineColumns"
            row-key="key"
            :pagination="false"
            :height="form.data.lines.length > 3 ? 380 : 'auto'"
          >
            <template #partId="{ row }">
              <ElSelect
                v-model="row.partId"
                filterable
                class="w-full"
                placeholder="请选择库存配件"
                aria-label="物料描述"
                @change="handleLinePartChange(row)"
              >
                <ElOption
                  v-for="part in availableParts"
                  :key="part.partId"
                  :value="part.partId"
                  :label="`${part.partName} · ${part.partCode}`"
                  :disabled="part.stockQty <= 0"
                />
              </ElSelect>
              <p class="mt-1 text-xs text-g-700"
                >{{ selectedPart(row)?.model || '—' }} · {{ selectedPart(row)?.brand || '—' }} ·
                库存 {{ selectedPart(row)?.stockQty ?? '—' }} {{ selectedPart(row)?.unit || '' }}</p
              >
            </template>
            <template #issuedQty="{ row }"
              ><ElInputNumber
                v-model="row.issuedQty"
                :min="1"
                :precision="0"
                :max="selectedPart(row)?.stockQty || undefined"
                :controls="false"
                class="w-full!"
                aria-label="领用数量"
            /></template>
            <template #issuedAt="{ row }"
              ><ElDatePicker
                v-model="row.issuedAt"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                class="w-full!"
                aria-label="领用时间"
            /></template>
            <template #imageUrl="{ row }"
              ><ArtUploadImage
                v-model="row.imageUrl"
                :resource-tenant-id="selectedVehicleTenantId"
                title="配件照片"
                :size="72"
                :limit="1"
                :file-size="8 * 1024 * 1024"
                file-type="image/png,image/jpeg,image/webp"
                :upload-request="uploadPartImage"
                :show-resource-picker="false"
                :readonly="!selectedVehicleTenantId"
            /></template>
            <template #operation="{ row }"
              ><ElButton
                v-if="form.data.lines.length > 1"
                type="danger"
                text
                aria-label="移除领用明细"
                @click="removeLine(row.key)"
                >移除</ElButton
              ></template
            >
          </ArtTable>
        </div>
      </template>
    </ArtForm>
  </ArtDialog>
</template>

<script setup lang="ts">
  import type { ComputedRef } from 'vue'
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import {
    ElAlert,
    ElButton,
    ElDatePicker,
    ElInputNumber,
    ElMessage,
    ElOption,
    ElSelect
  } from 'element-plus'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtTable, { type ArtTableExpose } from '@/components/core/tables/art-table/index.vue'
  import type { ColumnOption } from '@/types'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
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
    items: ComputedRef<FormItem[]>
    rules: FormRules<IssueForm>
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose>()
  const formRef = ref<{ validate: () => Promise<boolean>; clearValidate: () => void }>()
  const lineTableRef = ref<ArtTableExpose<IssueLineForm>>()
  const lineColumns: ColumnOption<IssueLineForm>[] = [
    { type: 'index', label: '#', width: 48 },
    {
      prop: 'partId',
      label: '物料描述',
      minWidth: 240,
      useSlot: true,
      required: true,
      headerTooltip: '从库存中选择配件，规格、品牌和可用库存自动显示。'
    },
    {
      prop: 'issuedQty',
      label: '领用数量',
      width: 130,
      useSlot: true,
      required: true,
      headerTooltip: '至少领用 1 件；同一配件多行的合计数量不能超过库存。',
      rules: {
        validator: ({ value }) => Number.isInteger(value) && Number(value) >= 1,
        message: ({ rowIndex }) => `第 ${rowIndex + 1} 行领用数量必须为大于 0 的整数`
      }
    },
    { prop: 'issuedAt', label: '领用时间', minWidth: 220, useSlot: true, required: true },
    { prop: 'imageUrl', label: '配件照片', width: 110, useSlot: true },
    { prop: 'operation', label: '操作', width: 78, fixed: 'right', useSlot: true }
  ]
  const availableParts = ref<VehiclePartStock[]>([])
  const stockError = ref(false)
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
    items: computed<FormItem[]>((): FormItem[] => [
      {
        label: '领用车辆',
        key: 'vehicleId',
        span: 12,
        type: 'dataSelect',
        props: {
          mode: 'table',
          multiple: false,
          modelValue: vehicleSelectValue.value,
          'onUpdate:modelValue': (value: typeof vehicleSelectValue.value) => {
            vehicleSelectValue.value = value
          },
          selectedData: form.vehicleSelection,
          'onUpdate:selectedData': (value: typeof form.vehicleSelection) => {
            form.vehicleSelection = value
          },
          apiFn: fetchApprovedVehicleSelectData,
          columns: vehicleColumns,
          rowKey: 'id',
          labelKey: 'plateNo',
          descriptionKey: 'companyName',
          title: '选择领用车辆',
          searchPlaceholder: '输入车牌号或所属公司',
          emptyText: '暂无可选车辆',
          emptyDescription: '请先维护并审批车辆档案。',
          showPagination: true,
          onChange: handleVehicleChange,
          showSelectedPanel: false
        }
      },
      { label: '领用司机', key: 'driverId', span: 12 },
      { label: '领用明细', key: 'lines', span: 24 },
      {
        label: '备注',
        key: 'remark',
        type: 'input',
        span: 24,
        props: { type: 'textarea', rows: 2, maxlength: 500, showWordLimit: true }
      }
    ]),
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
  }
  const addLine = (): void => {
    form.data.lines.push(newLine())
  }
  const removeLine = (key: string): void => {
    form.data.lines = form.data.lines.filter((line) => line.key !== key)
  }
  const validateLines = async (): Promise<boolean> => {
    if (!form.data.lines.length) {
      ElMessage.warning('请至少添加一条领用明细')
      return false
    }
    const validation = await lineTableRef.value?.validate()
    if (!validation?.valid) {
      if (validation?.firstError) ElMessage.warning(validation.firstError.message)
      return false
    }
    const requested = new Map<string, number>()
    for (const line of form.data.lines)
      requested.set(line.partId, (requested.get(line.partId) || 0) + line.issuedQty)
    for (const [partId, qty] of requested) {
      const stock = availableParts.value.find((part) => part.partId === partId)
      if (!stock || qty > stock.stockQty) {
        ElMessage.warning(`领用数量超过“${stock?.partName || '所选配件'}”当前库存，请调整后重试`)
        return false
      }
    }
    return true
  }
  const handleConfirm = async (): Promise<boolean> => {
    if (!(await validateArtFormForSubmit(formRef.value)) || !(await validateLines())) return false
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
