<template>
  <ArtDialog ref="dialogRef" size="xl" show-fullscreen-button>
    <template #subtitle
      >记录维修保养项目、工期、费用、承修机构与附件，沉淀车辆完整维保履历。</template
    >

    <div class="maintenance-record-dialog">
      <ArtForm
        ref="formRef"
        v-model="form.data"
        :items="form.items"
        :rules="form.rules"
        :span="12"
        :gutter="20"
        label-width="120px"
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
            title="选择车辆"
            search-placeholder="输入车牌号或所属公司"
            empty-text="暂无可选车辆"
            empty-description="请先维护车辆档案并确保车辆已启用。"
            show-pagination
            @change="handleVehicleChange"
          >
            <template #empty><VehicleDataSourceEmptyActions source="vehicle" /></template>
          </ArtTableSingleSelect>
        </template>
        <template #initiatorEmployeeId>
          <div class="min-w-0">
            <ArtEmployeeSelect
              :model-value="form.data.initiatorEmployeeId ?? undefined"
              :selected-data="selectedInitiator"
              :tenant-id="form.data.tenantId ?? tenantScopeStore.effectiveTenantId ?? undefined"
              title="选择经办人"
              placeholder="请选择经办人"
              @change="handleInitiatorChange"
            />
            <p
              v-if="form.data.initiator && !form.data.initiatorEmployeeId"
              class="mt-1 text-xs text-[var(--el-text-color-secondary)]"
            >
              历史经办人：{{ form.data.initiator }}；重新选择后可关联员工花名册。
            </p>
          </div>
        </template>
        <template #workshopSupplierId>
          <div class="min-w-0">
            <ArtTableSingleSelect
              :model-value="form.data.workshopSupplierId ?? undefined"
              :selected-data="selectedWorkshop"
              :api-fn="fetchWorkshopSelectData"
              :columns="workshopColumns"
              row-key="id"
              label-key="supplierName"
              title="选择维修厂"
              subtitle="仅显示供应商分组为“维修厂”的资料。"
              placeholder="选择维修厂（选填）"
              empty-text="暂无维修厂供应商"
              empty-description="请先在供应商档案中维护“维修厂”分组及供应商。"
              clearable
              @change="handleWorkshopChange"
            />
            <p
              v-if="form.data.workshop && !form.data.workshopSupplierId"
              class="mt-1 text-xs text-[var(--el-text-color-secondary)]"
            >
              历史维修厂：{{ form.data.workshop }}；重新选择后可绑定供应商档案。
            </p>
          </div>
        </template>
        <template #mileageRecordId>
          <ArtTableSingleSelect
            :model-value="form.data.mileageRecordId ?? undefined"
            :selected-data="selectedMileage"
            :api-fn="fetchMileageSelectData"
            :columns="mileageColumns"
            row-key="id"
            :label-key="formatMileageLabel"
            title="关联行驶记录"
            subtitle="选择该车的一次行程，列表将显示其司机、运单和里程。"
            placeholder="选择行驶记录（选填）"
            :disabled="!form.data.vehicleId"
            show-pagination
            clearable
            @change="handleMileageChange"
          />
        </template>
      </ArtForm>

      <section v-if="canViewMaintenanceItems" class="maintenance-record-dialog__section">
        <div class="maintenance-record-dialog__section-header">
          <ArtSectionTitle :show-line="false">项目清单</ArtSectionTitle>
          <ElButton v-if="canEditMaintenanceItems" type="primary" plain @click="addItem">
            <template #icon><ArtSvgIcon icon="ri:add-line" /></template>
            新增
          </ElButton>
        </div>
        <ArtTable
          :data="form.data.items"
          :columns="itemColumns"
          :pagination="undefined"
          :show-table-header="false"
          empty-height="160px"
        />
        <div
          v-if="canViewMaintenanceField('totalCost')"
          class="mt-3 flex justify-end gap-3 text-sm text-[var(--el-text-color-regular)]"
        >
          <span>项目费用合计</span>
          <strong class="text-base text-[var(--el-text-color-primary)]"
            >¥{{ totalCost.toFixed(2) }}</strong
          >
        </div>
      </section>

      <section v-if="canViewDocuments" class="maintenance-record-dialog__section">
        <div class="maintenance-record-dialog__section-header">
          <ArtSectionTitle :show-line="false">维修保养附件</ArtSectionTitle>
          <ElButton v-if="canEditDocuments" type="primary" plain @click="openAttachmentDialog">
            <template #icon><ArtSvgIcon icon="ri:upload-2-line" /></template>
            上传
          </ElButton>
        </div>
        <p class="mb-3 text-xs leading-5 text-[var(--el-text-color-secondary)]">
          可上传维修单、发票照片等凭证；请在附件名称中标明凭证类型，便于后续核对。
        </p>
        <VehicleAttachmentTable
          :attachments="form.data.attachments ?? []"
          :name-min-width="180"
          :removable="canEditDocuments"
          @remove="removeAttachment"
        />
      </section>
    </div>
  </ArtDialog>

  <ArtDialog v-if="canEditDocuments" ref="attachmentDialogRef" size="md">
    <div class="maintenance-attachment-dialog">
      <ArtForm
        ref="attachmentFormRef"
        v-model="attachment.data"
        :items="attachment.items"
        :rules="attachment.rules"
        :span="24"
        label-width="170px"
        :show-reset="false"
        :show-submit="false"
      >
        <template #file>
          <div class="maintenance-attachment-dialog__upload">
            <ArtUploadFile
              title="选择上传文件"
              :resource-tenant-id="form.data.tenantId || ''"
              :show-file-list="false"
              :show-tip="false"
              @resource-change="handleAttachmentFileChange"
            />
            <div v-if="attachment.data.fileName" class="maintenance-attachment-dialog__file">
              <span>{{ attachment.data.fileName }}</span>
              <ArtSvgIcon v-if="attachment.data.url" icon="ri:check-line" />
            </div>
          </div>
        </template>
      </ArtForm>
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { useDraftAttachmentRemoval } from '@/hooks/core/useDraftAttachmentRemoval'
  import type { ComputedRef, UnwrapNestedRefs } from 'vue'
  import { cloneDeep, isEqual } from 'lodash-es'
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import { ElButton, ElInput, ElInputNumber, ElMessage } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtUploadFile from '@/components/core/forms/art-upload-file/index.vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import VehicleDataSourceEmptyActions from '../../../components/vehicle-data-source-empty-actions.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import type {
    DataSelectColumn,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import ArtSectionTitle from '@/components/core/surfaces/art-section-title/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import ArtIconButton from '@/components/core/widget/art-icon-button/index.vue'
  import type { ColumnOption } from '@/types'
  import {
    addVehicleMaintenance,
    editVehicleMaintenance,
    fetchMaintenanceWorkshopOptions,
    fetchApprovedVehicleSelectData,
    fetchVehicleMileageList
  } from '@vms/api'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { useUserStore } from '@/store/modules/user'
  import { useDictionaryOptions } from '@/hooks/core/useDictionaryOptions'
  import { useTenantScopeStore } from '@/store/modules/tenant-scope'
  import { canEditField, canViewField } from '@/utils/field-permission'
  import {
    EDITABLE_VEHICLE_MAINTENANCE_ACCESS,
    sanitizeVehicleMaintenancePayload
  } from './maintenance-record-model'
  import {
    createInitialAttachmentForm,
    useVehicleAttachmentDialog,
    type VehicleAttachmentFormData as AttachmentFormData,
    type VehicleAttachmentGroup as AttachmentGroup,
    type VehicleFormExpose as FormExpose
  } from '../../vehicle-attachment-dialog'
  import VehicleAttachmentTable from '../../vehicle-attachment-table.vue'

  defineOptions({ name: 'MaintenanceRecordDialog' })

  type MaintenanceRecord = Api.Vms.VehicleManage.VehicleMaintenanceRecord
  type MaintenanceItem = Api.Vms.VehicleManage.VehicleMaintenanceItem
  type MaintenanceFieldKey = Api.Vms.VehicleManage.VehicleMaintenanceFieldKey
  type VehicleArchive = Api.Vms.ArchiveManage.VehicleArchive

  interface FormGroup {
    data: MaintenanceRecord
    items: ComputedRef<FormItem[]>
    rules: ComputedRef<FormRules<MaintenanceRecord>>
    vehicleSelection: VehicleArchive[]
  }

  interface Emits {
    (e: 'success', type: 'add' | 'edit'): void
  }

  const emit = defineEmits<Emits>()
  const userStore = useUserStore()
  const tenantScopeStore = useTenantScopeStore()
  const maintenanceTypeDictionary = useDictionaryOptions('vehicleMaintenanceType')
  const maintenanceTypeOptions = computed(() =>
    maintenanceTypeDictionary.filter((option) => option.value !== 'maintenance')
  )
  const booleanOptions = useDictionaryOptions<boolean>('commonBoolean', (value) => value === 'true')
  const dialogRef = ref<ArtDialogExpose<MaintenanceRecord | undefined>>()
  const attachmentDialogRef = ref<ArtDialogExpose<void>>()
  const formRef = ref<FormExpose>()
  const maintenanceNumber = useDocumentNumberRule('vehicle.maintenance')
  const attachmentFormRef = ref<FormExpose>()
  const originalItems = ref<MaintenanceItem[]>([])

  const createInitialItem = (): MaintenanceItem => ({
    itemName: '',
    totalAmount: null,
    laborAmount: null,
    partName: '',
    partPrice: null,
    quantity: null
  })

  const createInitialForm = (): MaintenanceRecord => ({
    id: undefined,
    tenantId: tenantScopeStore.effectiveTenantId ?? userStore.getUserInfo.tenantId,
    vehicleId: null,
    plateNo: '',
    companyName: '',
    maintenanceNo: '',
    maintenanceType: 'repair',
    initiator:
      userStore.getUserInfo.hrEmployee?.employeeName ?? userStore.getUserInfo.nickName ?? '',
    initiatorEmployeeId: userStore.getUserInfo.hrEmployeeId ?? null,
    mileageRecordId: null,
    startTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    endTime: '',
    serviceDate: dayjs().format('YYYY-MM-DD'),
    currentOdometerKm: null,
    reminderMode: 'time',
    nextMaintenanceDate: dayjs().add(3, 'month').format('YYYY-MM-DD'),
    nextMaintenanceMileage: null,
    costAmount: null,
    workshop: '',
    workshopSupplierId: null,
    invoiceNo: '',
    externalRepair: false,
    remark: '',
    items: [createInitialItem()],
    attachments: [],
    fieldAccess: { ...EDITABLE_VEHICLE_MAINTENANCE_ACCESS },
    isRecordOwner: true
  })

  const canViewMaintenanceField = (field: MaintenanceFieldKey): boolean =>
    !form.data.id || canViewField(form.data.fieldAccess, field)
  const canEditMaintenanceField = (field: MaintenanceFieldKey): boolean =>
    !form.data.id || canEditField(form.data.fieldAccess, field)
  const canViewMaintenanceItems = computed(() => canViewMaintenanceField('maintenanceItems'))
  const canEditMaintenanceItems = computed(() => canEditMaintenanceField('maintenanceItems'))
  const canViewDocuments = computed(() => canViewMaintenanceField('documents'))
  const canEditDocuments = computed(() => canEditMaintenanceField('documents'))

  const IDENTIFIER_FIELDS = new Set(['maintenanceNo'])
  const COST_FIELDS = new Set(['costAmount'])

  const getSensitiveFieldForFormItem = (item: FormItem): MaintenanceFieldKey | null => {
    const key = String(item.key)
    if (IDENTIFIER_FIELDS.has(key)) return 'maintenanceIdentifiers'
    if (COST_FIELDS.has(key)) return 'totalCost'
    return null
  }

  const dateTimeProps = {
    type: 'datetime',
    valueFormat: 'YYYY-MM-DD HH:mm:ss',
    class: '!w-full'
  }

  const moneyProps = {
    min: 0,
    precision: 2,
    controlsPosition: 'right',
    class: '!w-full'
  }

  const reminderModeOptions = [
    { label: '按时间（3 个月）', value: 'time' },
    { label: '按里程（10,000 公里）', value: 'mileage' }
  ]

  const form: UnwrapNestedRefs<FormGroup> = reactive<FormGroup>({
    data: createInitialForm(),
    vehicleSelection: [],
    items: computed<FormItem[]>(() => {
      const items: FormItem[] = [
        { label: '基础信息', key: 'baseSection', type: 'divider', span: 24 },
        { label: '车牌号', key: 'vehicleId', span: 12 },
        { label: '所属公司', key: 'companyName', type: 'input', props: { disabled: true } },
        {
          label: '维修单号',
          key: 'maintenanceNo',
          type: 'input',
          props: {
            maxlength: 80,
            ...maintenanceNumber.inputProps(Boolean(form.data.id), '请输入维修单号', true)
          },
          description: form.data.id ? undefined : maintenanceNumber.description.value
        },
        {
          label: '维修类型',
          key: 'maintenanceType',
          type: 'select',
          props: { options: maintenanceTypeOptions.value }
        },
        { label: '经办人', key: 'initiatorEmployeeId' },
        { label: '关联行驶记录', key: 'mileageRecordId', span: 24 },
        { label: '开始时间', key: 'startTime', type: 'date', props: dateTimeProps },
        { label: '结束时间', key: 'endTime', type: 'date', props: dateTimeProps },
        { label: '里程与保养提醒', key: 'reminderSection', type: 'divider', span: 24 },
        {
          label: '保养维修日期',
          key: 'serviceDate',
          type: 'date',
          props: { type: 'date', valueFormat: 'YYYY-MM-DD', class: '!w-full' }
        },
        {
          label: '当前里程（公里）',
          key: 'currentOdometerKm',
          type: 'number',
          props: { min: 0, precision: 1, class: '!w-full' }
        },
        {
          label: '提醒方式',
          key: 'reminderMode',
          type: 'select',
          props: { options: reminderModeOptions }
        },
        ...(form.data.reminderMode === 'time'
          ? [
              {
                label: '下次保养日期',
                key: 'nextMaintenanceDate',
                type: 'date',
                props: { type: 'date', valueFormat: 'YYYY-MM-DD', disabled: true, class: '!w-full' }
              }
            ]
          : [
              {
                label: '下次保养里程',
                key: 'nextMaintenanceMileage',
                type: 'number',
                props: { min: 0, disabled: true, class: '!w-full' }
              }
            ]),
        { label: '费用与票据', key: 'costSection', type: 'divider', span: 24 },
        {
          label: '总费用（元）',
          key: 'costAmount',
          type: 'number',
          props: { ...moneyProps, disabled: true }
        },
        { label: '维修厂', key: 'workshopSupplierId' },
        { label: '发票号', key: 'invoiceNo', type: 'input', props: { maxlength: 100 } },
        {
          label: '外部维修',
          key: 'externalRepair',
          type: 'radioGroup',
          props: { options: getBooleanDictOptions() }
        },
        {
          label: '备注',
          key: 'remark',
          type: 'input',
          span: 24,
          props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true }
        }
      ]
      return items
        .filter((item) => {
          const field = getSensitiveFieldForFormItem(item)
          return !field || canViewMaintenanceField(field)
        })
        .map((item) => {
          const field = getSensitiveFieldForFormItem(item)
          if (!field || canEditMaintenanceField(field)) return item
          return { ...item, props: { ...(item.props ?? {}), disabled: true } }
        })
    }),
    rules: computed<FormRules<MaintenanceRecord>>(() => ({
      vehicleId: [{ required: true, message: '请选择车辆', trigger: 'change' }],
      maintenanceNo:
        canEditMaintenanceField('maintenanceIdentifiers') &&
        maintenanceNumber.manualRequired(Boolean(form.data.id))
          ? [{ required: true, message: '请输入维修单号', trigger: 'blur' }]
          : [],
      maintenanceType: [{ required: true, message: '请选择维修类型', trigger: 'change' }],
      startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
      serviceDate: form.data.id
        ? []
        : [{ required: true, message: '请选择保养维修日期', trigger: 'change' }],
      currentOdometerKm: form.data.id
        ? []
        : [{ required: true, message: '请填写当前里程', trigger: 'change' }]
    }))
  })

  const totalCost = computed(
    () =>
      Math.round(
        (form.data.items ?? []).reduce((sum, item) => sum + Number(item.totalAmount || 0), 0) * 100
      ) / 100
  )

  watch(
    () => [
      form.data.items,
      form.data.serviceDate,
      form.data.currentOdometerKm,
      form.data.reminderMode
    ],
    () => {
      if (
        canEditMaintenanceItems.value &&
        (!form.data.id || !isEqual(toRaw(form.data.items ?? []), originalItems.value))
      ) {
        form.data.costAmount = totalCost.value
      }
      form.data.nextMaintenanceDate =
        form.data.reminderMode === 'time' && form.data.serviceDate
          ? dayjs(form.data.serviceDate).add(3, 'month').format('YYYY-MM-DD')
          : null
      form.data.nextMaintenanceMileage =
        form.data.reminderMode === 'mileage' && form.data.currentOdometerKm != null
          ? Number(form.data.currentOdometerKm) + 10000
          : null
    },
    { deep: true }
  )

  const attachment: UnwrapNestedRefs<AttachmentGroup> = reactive<AttachmentGroup>({
    data: createInitialAttachmentForm(),
    items: computed<FormItem[]>(() => [
      {
        label: '维修保养附件名称',
        key: 'name',
        type: 'input',
        props: { maxlength: 100 }
      },
      { label: '选择上传文件', key: 'file' }
    ]),
    rules: computed<FormRules<AttachmentFormData>>(() => ({
      name: [{ required: true, message: '请输入维修保养附件名称', trigger: 'blur' }],
      file: [{ required: true, message: '请选择上传文件', trigger: 'change' }]
    }))
  })

  const vehicleSelectValue = computed({
    get: () => form.data.vehicleId ?? undefined,
    set: (value?: string | number) => {
      form.data.vehicleId = value ? String(value) : null
    }
  })

  const vehicleColumns: DataSelectColumn[] = [
    { prop: 'companyName', label: '所属公司', minWidth: 180 },
    { prop: 'plateNo', label: '车牌号', width: 140 },
    {
      prop: 'operationStatus',
      label: '营运状态',
      width: 120,
      dict: { code: 'vehicleOperationStatus', display: 'auto' }
    }
  ]

  const workshopColumns: DataSelectColumn[] = [
    { prop: 'supplierCode', label: '供应商编码', minWidth: 150 },
    { prop: 'supplierName', label: '维修厂名称', minWidth: 220 }
  ]

  const selectedWorkshop = computed(() =>
    form.data.workshopSupplierId
      ? [{ id: form.data.workshopSupplierId, supplierName: form.data.workshop || '' }]
      : []
  )

  const fetchWorkshopSelectData = async (params: { keyword?: string }) => {
    const rows = await fetchMaintenanceWorkshopOptions(params.keyword, form.data.tenantId)
    return { data: rows, total: rows.length }
  }

  const handleWorkshopChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    form.data.workshopSupplierId = String(rows[0]?.id || '') || null
    form.data.workshop = String(rows[0]?.supplierName || '')
  }

  const mileageColumns: DataSelectColumn[] = [
    { prop: 'startTime', label: '发车时间', minWidth: 180 },
    { prop: 'endTime', label: '收车时间', minWidth: 180 },
    { prop: 'runningMileage', label: '行驶里程（KM）', width: 140 }
  ]

  const formatMileageLabel = (row: DataSelectRecord): string =>
    `${String(row.startTime ?? '行程时间待补充')} · ${String(row.runningMileage ?? '--')} KM`

  const selectedMileage = computed<Api.Vms.VehicleManage.VehicleMileageRecord[]>(() =>
    form.data.mileageRecordId
      ? [
          {
            id: form.data.mileageRecordId,
            plateNo: form.data.plateNo,
            startTime: form.data.tripStartTime ?? undefined,
            endTime: form.data.tripEndTime,
            runningMileage: form.data.drivingMileage
          }
        ]
      : []
  )

  const fetchMileageSelectData = async (params: { page: number; pageSize: number }) => {
    if (!form.data.vehicleId) return { data: [], total: 0 }
    const { from, to } = buildSupabasePageRange({ current: params.page, size: params.pageSize })
    const result = await fetchVehicleMileageList({ vehicleId: form.data.vehicleId, from, to })
    if (result.error) throw result.error
    return { data: result.data ?? [], total: result.total ?? 0 }
  }

  const handleMileageChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    const trip = rows[0] as Api.Vms.VehicleManage.VehicleMileageRecord | undefined
    form.data.mileageRecordId = trip?.id ?? null
    form.data.tripStartTime = trip?.startTime ?? null
    form.data.tripEndTime = trip?.endTime ?? null
    form.data.drivingMileage = trip?.runningMileage ?? null
  }

  const itemColumns = computed<ColumnOption<MaintenanceItem>[]>(() => [
    { type: 'globalIndex', label: '序号', width: 56 },
    {
      prop: 'itemName',
      label: '项目名称',
      minWidth: 130,
      formatter: (row) => (
        <ElInput
          v-model={row.itemName}
          placeholder="项目名称"
          disabled={!canEditMaintenanceItems.value}
        />
      )
    },
    {
      prop: 'partName',
      label: '配件名称',
      minWidth: 120,
      formatter: (row) => (
        <ElInput
          v-model={row.partName}
          placeholder="配件名称"
          disabled={!canEditMaintenanceItems.value}
        />
      )
    },
    {
      prop: 'quantity',
      label: '数量',
      width: 96,
      formatter: (row) => (
        <ElInputNumber
          v-model={row.quantity}
          min={0}
          precision={2}
          controls={false}
          disabled={!canEditMaintenanceItems.value}
          class="w-full!"
        />
      )
    },
    {
      prop: 'partPrice',
      label: '配件金额',
      width: 112,
      formatter: (row) => (
        <ElInputNumber
          v-model={row.partPrice}
          min={0}
          precision={2}
          controls={false}
          disabled={!canEditMaintenanceItems.value}
          class="w-full!"
        />
      )
    },
    {
      prop: 'laborAmount',
      label: '工时费',
      width: 112,
      formatter: (row) => (
        <ElInputNumber
          v-model={row.laborAmount}
          min={0}
          precision={2}
          controls={false}
          disabled={!canEditMaintenanceItems.value}
          class="w-full!"
        />
      )
    },
    {
      prop: 'totalAmount',
      label: '合计',
      width: 112,
      formatter: (row) => (
        <ElInputNumber
          v-model={row.totalAmount}
          min={0}
          precision={2}
          controls={false}
          disabled={!canEditMaintenanceItems.value}
          class="w-full!"
        />
      )
    },
    ...(canEditMaintenanceItems.value
      ? [
          {
            prop: 'operation',
            label: '操作',
            width: 64,
            formatter: (row: MaintenanceItem) => (
              <ArtIconButton
                icon="ri:delete-bin-5-line"
                label="移除维修项目"
                tone="danger"
                onClick={() => removeItem(row)}
              />
            )
          }
        ]
      : [])
  ])

  const getBooleanDictOptions = () => booleanOptions

  const handleVehicleChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    const vehicle = rows[0] as VehicleArchive | undefined
    const nextTenantId = vehicle?.tenantId ?? tenantScopeStore.effectiveTenantId ?? undefined
    if (nextTenantId !== form.data.tenantId) {
      if ((form.data.attachments?.length ?? 0) > 0) {
        form.data.attachments = []
        ElMessage.warning('车辆所属租户已变化，原有附件已清空，请重新上传')
      }
      form.data.initiatorEmployeeId =
        nextTenantId === userStore.getUserInfo.tenantId
          ? (userStore.getUserInfo.hrEmployeeId ?? null)
          : null
      form.data.initiator =
        nextTenantId === userStore.getUserInfo.tenantId
          ? (userStore.getUserInfo.hrEmployee?.employeeName ?? userStore.getUserInfo.nickName ?? '')
          : ''
      form.data.workshopSupplierId = null
      form.data.workshop = ''
    }
    form.data.tenantId = nextTenantId
    form.data.vehicleId = vehicle?.id ?? null
    form.data.plateNo = vehicle?.plateNo ?? ''
    form.data.companyName = vehicle?.companyName ?? ''
    form.data.mileageRecordId = null
    form.data.tripStartTime = null
    form.data.tripEndTime = null
    form.data.drivingMileage = null
  }

  const selectedInitiator = computed<EmployeeIntegrationItem[]>(() =>
    form.data.initiatorEmployeeId
      ? [
          {
            id: form.data.initiatorEmployeeId,
            tenantId: form.data.tenantId ?? userStore.getUserInfo.tenantId ?? '',
            employeeName: form.data.initiator ?? '',
            employeeNo:
              form.data.initiatorEmployeeId === userStore.getUserInfo.hrEmployeeId
                ? (userStore.getUserInfo.hrEmployee?.employeeNo ?? '')
                : '',
            employmentStatus: 'active'
          }
        ]
      : []
  )

  const handleInitiatorChange = (
    _id: string | string[] | undefined,
    rows: EmployeeIntegrationItem[]
  ): void => {
    form.data.initiatorEmployeeId = rows[0]?.id ?? null
    form.data.initiator = rows[0]?.employeeName ?? ''
  }

  const replaceForm = (data: MaintenanceRecord): void => {
    Object.assign(form.data, createInitialForm(), cloneDeep(toRaw(data)))
    form.data.items = form.data.items?.length ? form.data.items : [createInitialItem()]
    originalItems.value = cloneDeep(toRaw(form.data.items))
    form.data.attachments ??= []
    form.vehicleSelection = form.data.vehicleId
      ? [
          {
            id: form.data.vehicleId,
            plateNo: form.data.plateNo,
            companyName: form.data.companyName
          } as VehicleArchive
        ]
      : []
  }

  const resetForm = async (): Promise<void> => {
    replaceForm(createInitialForm())
    await nextTick()
    formRef.value?.clearValidate()
  }

  const { resetAttachmentForm, handleAttachmentFileChange, handleAttachmentConfirm } =
    useVehicleAttachmentDialog(form, attachment, attachmentFormRef)

  const addItem = (): void => {
    form.data.items = [...(form.data.items ?? []), createInitialItem()]
  }

  const removeItem = (row: MaintenanceItem): void => {
    form.data.items = (form.data.items ?? []).filter((item) => item !== row)
  }

  const openAttachmentDialog = async (): Promise<void> => {
    await resetAttachmentForm()
    await attachmentDialogRef.value?.handleOpen(undefined, {
      title: '上传维修保养附件',
      contentMaxHeight: '420px',
      onConfirm: handleAttachmentConfirm,
      onReset: () => void resetAttachmentForm()
    })
  }

  const normalizePayload = (): MaintenanceRecord =>
    sanitizeVehicleMaintenancePayload({
      ...toRaw(form.data),
      vehicleId: form.data.vehicleId || null,
      endTime: form.data.endTime || null,
      costAmount:
        !form.data.id || (form.data.items ?? []).some((item) => item.totalAmount != null)
          ? totalCost.value
          : form.data.costAmount,
      items: (form.data.items ?? []).filter((item) => item.itemName || item.partName),
      attachments: form.data.attachments ?? []
    })

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '表单校验未完成，请稍后重试', 'warning')
      return false
    }

    if (
      canEditMaintenanceItems.value &&
      (form.data.items ?? []).some(
        (item) =>
          !item.itemName &&
          !item.partName &&
          (item.totalAmount != null ||
            item.laborAmount != null ||
            item.partPrice != null ||
            item.quantity != null)
      )
    ) {
      ElMessage.warning('请为已填写费用的项目补充项目名称或配件名称')
      return false
    }

    if (
      canEditMaintenanceItems.value &&
      (form.data.items ?? []).some(
        (item) => (item.itemName || item.partName) && item.totalAmount == null
      )
    ) {
      ElMessage.warning('请填写项目清单中每项的合计费用')
      return false
    }

    try {
      const payload = normalizePayload()
      if (form.data.id) {
        await editVehicleMaintenance(payload)
      } else {
        await addVehicleMaintenance(payload)
      }
      emit('success', form.data.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '车辆维修记录保存失败，请检查维修项目后重试')
      return false
    }
  }

  const handleOpen = async (row?: MaintenanceRecord): Promise<void> => {
    await resetForm()
    if (row?.id) replaceForm(row)

    await dialogRef.value?.handleOpen(row, {
      title: row?.id ? '编辑维修保养记录' : '新增维修保养记录',
      contentMaxHeight: '74vh',
      loading: true,
      loadingText: '正在加载编号规则…',
      onOpen: async (_openData, api) => {
        try {
          await maintenanceNumber.loadRule()
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit,
      onReset: () => void resetForm()
    })
  }

  const removeAttachment = useDraftAttachmentRemoval<Api.Vms.VehicleManage.VehicleAttachment>({
    getAttachments: () => form.data.attachments,
    setAttachments: (rows) => {
      form.data.attachments = rows
    },
    canRemove: () => canEditDocuments.value,
    getContext: () => [form.data.id, form.data.tenantId, form.data.vehicleId]
  })

  defineExpose({
    handleOpen,
    handleClose: () => dialogRef.value?.handleClose()
  })
</script>

<style scoped lang="scss">
  .maintenance-record-dialog {
    &__section {
      padding: 0 16px;
      margin-top: 8px;
    }

    &__section-header {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
  }

  .maintenance-attachment-dialog {
    padding: 8px 0 4px;

    &__upload {
      display: flex;
      flex-direction: column;
      gap: 14px;
      align-items: flex-start;
    }

    &__file {
      display: flex;
      gap: 8px;
      align-items: center;
      color: var(--el-text-color-secondary);

      :deep(.art-svg-icon) {
        color: var(--el-color-success);
      }
    }
  }
</style>
