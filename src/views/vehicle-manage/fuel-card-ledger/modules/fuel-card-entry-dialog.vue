<template>
  <ArtDialog ref="dialogRef" size="lg">
    <template #subtitle>{{
      action === 'recharge'
        ? '登记实际充值，余额即时增加并保留流水。'
        : '登记实际消费，余额不足时系统会阻止提交。'
    }}</template>
    <ArtForm
      ref="formRef"
      v-model="form"
      :items="formItems"
      :rules="formRules"
      :span="12"
      label-width="110px"
      :show-reset="false"
      :show-submit="false"
    >
      <template #cardId>
        <ArtTableSingleSelect
          v-model="cardSelectValue"
          v-model:selected-data="cardSelection"
          :api-fn="fetchSelectableCards"
          :columns="cardColumns"
          row-key="id"
          label-key="cardNo"
          description-key="plateNo"
          title="选择油卡"
          search-placeholder="输入油卡号或车牌号"
          empty-text="暂无可用油卡"
          empty-description="请先在油卡档案创建并启用油卡。"
          show-pagination
          @change="handleCardChange"
        />
      </template>
      <template #currentBalance>
        <span class="font-medium tabular-nums text-[var(--el-text-color-primary)]">
          {{ selectedCard ? formatCurrencyValue(selectedCard.balance) : '选择油卡后显示余额' }}
        </span>
      </template>
      <template #paymentAccount>
        <span class="text-sm text-[var(--el-text-color-regular)]">
          {{ selectedCard ? `${selectedCard.cardNo} · 油卡余额扣款` : '选择油卡后显示扣款账户' }}
        </span>
      </template>
      <template #rechargerEmployeeId>
        <ArtEmployeeSelect
          v-model="form.rechargerEmployeeId"
          v-model:selected-data="selectedRecharger"
          :tenant-id="selectedCard?.tenantId"
          :api-fn="fetchFuelCardEmployeeOptions"
          :display-fields="[]"
          :disabled="!selectedCard"
          missing-tenant-placeholder="请先选择油卡"
          title="选择充值人"
          placeholder="请选择充值人（选填）"
        />
      </template>
      <template #waybillId>
        <ArtTableSingleSelect
          v-model="waybillSelectValue"
          v-model:selected-data="waybillSelection"
          :api-fn="fetchWaybills"
          :columns="waybillColumns"
          row-key="id"
          label-key="waybillNo"
          title="选择关联运单"
          search-placeholder="输入运单号"
          empty-text="该油卡车辆暂无可关联运单"
          :disabled="!selectedCard"
          show-pagination
          clearable
          @change="handleWaybillChange"
        />
      </template>
      <template #driverId>
        <ArtTableSingleSelect
          v-model="driverSelectValue"
          v-model:selected-data="driverSelection"
          :api-fn="fetchDrivers"
          :columns="driverColumns"
          row-key="id"
          label-key="driverName"
          title="选择本笔消费司机"
          search-placeholder="输入司机姓名或手机号"
          empty-text="该租户暂无可选司机"
          :disabled="!selectedCard"
          show-pagination
          clearable
          @change="handleDriverChange"
        />
      </template>
      <template #locationPicker>
        <ArtAddressPicker
          v-model:address-detail="form.expenseLocation"
          v-model:longitude="form.expenseLongitude"
          v-model:latitude="form.expenseLatitude"
          v-model:coordinate-system="form.expenseCoordinateSystem"
          v-model:coordinate-source="form.expenseCoordinateSource"
          v-model:coordinate-status="form.expenseCoordinateStatus"
          v-model:geocode-provider="form.expenseGeocodeProvider"
          v-model:geocoded-at="form.expenseGeocodedAt"
          detail-label="发生地点"
          detail-placeholder="定位当前位置，或搜索/点击地图选择加油地点"
          address-detail-prop="expenseLocation"
          label-width="110px"
          hide-region-selector
          show-locate-button
        />
      </template>
    </ArtForm>
    <ElAlert
      v-if="action === 'consume'"
      class="mt-3"
      type="info"
      :closable="false"
      show-icon
      title="本趟百公里油耗在运单完成且具备出回表显、余油等数据后自动核算；当前单笔升数不会直接作为本趟油耗。"
    />
    <div class="mt-4 border-t border-[var(--el-border-color-lighter)] pt-4">
      <span class="mb-2 block text-sm font-medium">现场凭证</span>
      <ArtUploadImage
        v-model="voucherUrls"
        :resource-tenant-id="selectedCard?.tenantId || ''"
        title="现场凭证"
        :size="88"
        multiple
        :limit="5"
        :file-size="8 * 1024 * 1024"
        file-type="image/png,image/jpeg,image/webp"
        :upload-request="uploadVoucher"
        :show-resource-picker="false"
        :readonly="!selectedCard"
      />
      <p class="mt-2 text-xs text-[var(--el-text-color-secondary)]"
        >可上传加油小票、充值凭证等照片，最多 5 张。</p
      >
    </div>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import ArtEmployeeSelect from '@/components/business/art-employee-select/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import ArtAddressPicker from '@/components/core/forms/art-address-picker/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import type { EmployeeIntegrationItem } from '@/api/integration/employees'
  import type {
    DataSelectColumn,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeCoordinatePair } from '@/utils/geo'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import {
    fetchFuelCardList,
    fetchFuelCardEmployeeOptions,
    fetchFuelCardDriverOptions,
    fetchFuelCardWaybillOptions,
    recordFuelCardTransaction,
    type FuelCard,
    type FuelCardWaybillOption,
    type FuelCardDriverOption
  } from '@/api/fuel-card'
  import { formatCurrencyValue } from '@/utils/ui/format'
  import {
    privateAttachmentPathFromSignedUrl,
    uploadPrivateAttachment
  } from '@/utils/supabase/private-attachment'

  defineOptions({ name: 'VmsFuelCardEntryDialog' })

  type Action = 'recharge' | 'consume'

  interface EntryForm {
    cardId: string
    amount: number | undefined
    occurredOn: string
    occurredAt: string
    referenceNo: string
    rechargeChannel: string
    invoiceNo: string
    rechargerEmployeeId: string | undefined
    stationName: string
    liters: number | undefined
    unitPrice: number | undefined
    expenseLocation: string
    expenseLongitude: number | string | null
    expenseLatitude: number | string | null
    expenseCoordinateSystem: string | null
    expenseCoordinateSource: string | null
    expenseCoordinateStatus: string
    expenseGeocodeProvider: string | null
    expenseGeocodedAt: string | null
    odometerKm: number | undefined
    waybillId: string
    driverId: string
    remark: string
  }

  interface FormExpose {
    validate: () => Promise<boolean>
    clearValidate: () => void
  }

  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<void>>()
  const formRef = ref<FormExpose>()
  const action = ref<Action>('recharge')
  const form = reactive<EntryForm>({
    cardId: '',
    amount: undefined,
    occurredOn: '',
    occurredAt: '',
    referenceNo: '',
    rechargeChannel: '',
    invoiceNo: '',
    rechargerEmployeeId: undefined,
    stationName: '',
    liters: undefined,
    unitPrice: undefined,
    expenseLocation: '',
    expenseLongitude: null,
    expenseLatitude: null,
    expenseCoordinateSystem: null,
    expenseCoordinateSource: null,
    expenseCoordinateStatus: 'pending',
    expenseGeocodeProvider: null,
    expenseGeocodedAt: null,
    odometerKm: undefined,
    waybillId: '',
    driverId: '',
    remark: ''
  })
  const selectedRecharger = ref<EmployeeIntegrationItem[]>([])
  const voucherUrls = ref<string[]>([])
  const waybillSelectValue = ref('')
  const waybillSelection = ref<FuelCardWaybillOption[]>([])
  const driverSelectValue = ref('')
  const driverSelection = ref<FuelCardDriverOption[]>([])
  const cardSelectValue = ref<string>('')
  const cardSelection = ref<FuelCard[]>([])
  const selectedCard = computed(() => cardSelection.value[0])
  const uploadVoucher = (file: File) =>
    uploadPrivateAttachment(file, {
      bucket: 'vms-fuel-card-private',
      tenantId: selectedCard.value?.tenantId || '',
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      maxBytes: 8 * 1024 * 1024
    })
  const fetchWaybills = async (params: { page: number; pageSize: number; keyword?: string }) =>
    fetchFuelCardWaybillOptions({
      cardId: form.cardId,
      from: (params.page - 1) * params.pageSize,
      to: params.page * params.pageSize - 1,
      keyword: params.keyword
    })
  const fetchDrivers = async (params: { page: number; pageSize: number; keyword?: string }) =>
    fetchFuelCardDriverOptions({
      cardId: form.cardId,
      from: (params.page - 1) * params.pageSize,
      to: params.page * params.pageSize - 1,
      keyword: params.keyword
    })
  const waybillColumns: DataSelectColumn[] = [
    { prop: 'waybillNo', label: '运单号', minWidth: 190 },
    {
      prop: 'status',
      label: '状态',
      minWidth: 100,
      formatter: (row: DataSelectRecord) => (
        <ArtDictDisplay dict-code="tmsWaybillStatus" value={row.status} />
      )
    }
  ]
  const driverColumns: DataSelectColumn[] = [
    { prop: 'driverName', label: '司机', minWidth: 140 },
    { prop: 'phone', label: '手机号', minWidth: 150 }
  ]
  const cardColumns: DataSelectColumn[] = [
    { prop: 'cardNo', label: '油卡号', minWidth: 150 },
    { prop: 'plateNo', label: '绑定车牌', minWidth: 120 },
    {
      prop: 'balance',
      label: '当前余额',
      minWidth: 120,
      formatter: (row: DataSelectRecord) => formatCurrencyValue(row.balance)
    }
  ]
  const formItems = computed<FormItem[]>(() => [
    { label: '油卡', key: 'cardId', span: 24 },
    {
      label: '当前余额',
      key: 'currentBalance',
      type: 'text',
      span: 24,
      props: { emptyText: '选择油卡后显示余额' }
    },
    {
      label: action.value === 'recharge' ? '充值金额' : '消费金额',
      key: 'amount',
      type: 'number',
      props: { min: 0.01, precision: 2, controls: false, class: '!w-full' }
    },
    {
      label: '流水时间',
      key: 'occurredAt',
      type: 'date',
      props: { type: 'datetime', valueFormat: 'YYYY-MM-DD HH:mm:ss', class: '!w-full' }
    },
    {
      label: action.value === 'recharge' ? '充值单号' : '业务凭证号',
      key: 'referenceNo',
      type: 'input',
      props: { maxlength: 80, placeholder: '可填写充值单号或消费凭证号' }
    },
    ...(action.value === 'recharge'
      ? ([
          {
            label: '充值渠道',
            key: 'rechargeChannel',
            type: 'input',
            props: { maxlength: 80, placeholder: '例如加油站柜台、银行转账' }
          },
          { label: '发票号', key: 'invoiceNo', type: 'input', props: { maxlength: 80 } },
          { label: '充值人', key: 'rechargerEmployeeId' }
        ] satisfies FormItem[])
      : ([
          { label: '关联运单', key: 'waybillId' },
          { label: '本笔司机', key: 'driverId' },
          {
            label: '加油站',
            key: 'stationName',
            type: 'input',
            props: { maxlength: 120, placeholder: '请输入加油站名称' }
          },
          {
            label: '',
            key: 'locationPicker',
            span: 24,
            labelWidth: 0
          },
          {
            label: '加油升数',
            key: 'liters',
            type: 'number',
            props: { min: 0.001, precision: 3, controls: false, class: '!w-full' }
          },
          {
            label: '油价（元/升）',
            key: 'unitPrice',
            type: 'number',
            props: { min: 0.001, precision: 3, controls: false, class: '!w-full' }
          },
          {
            label: '表显里程（公里）',
            key: 'odometerKm',
            type: 'number',
            props: { min: 0, precision: 1, controls: false, class: '!w-full' }
          },
          {
            label: '扣款账户',
            key: 'paymentAccount',
            span: 12
          }
        ] satisfies FormItem[])),
    {
      label: '备注',
      key: 'remark',
      type: 'input',
      span: 24,
      props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true }
    }
  ])
  const formRules: FormRules<EntryForm> = {
    cardId: [{ required: true, message: '请选择油卡', trigger: 'change' }],
    amount: [
      { required: true, type: 'number', min: 0.01, message: '金额必须大于 0', trigger: 'change' }
    ],
    occurredAt: [{ required: true, message: '请选择流水时间', trigger: 'change' }]
  }

  const fetchSelectableCards = async (params: {
    page: number
    pageSize: number
    keyword?: string
  }) =>
    fetchFuelCardList({
      current: params.page,
      size: params.pageSize,
      keyword: params.keyword,
      status: 'active'
    })

  const handleCardChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    const card = rows[0] as FuelCard | undefined
    if (card?.id !== form.cardId) {
      form.waybillId = ''
      form.driverId = ''
      form.rechargerEmployeeId = undefined
      waybillSelectValue.value = ''
      waybillSelection.value = []
      driverSelectValue.value = ''
      driverSelection.value = []
      selectedRecharger.value = []
      voucherUrls.value = []
      form.expenseLocation = ''
      form.expenseLongitude = null
      form.expenseLatitude = null
      form.expenseCoordinateSystem = null
      form.expenseCoordinateSource = null
      form.expenseCoordinateStatus = 'pending'
      form.expenseGeocodeProvider = null
      form.expenseGeocodedAt = null
    }
    form.cardId = card?.id || ''
  }
  const handleWaybillChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    form.waybillId = (rows[0] as FuelCardWaybillOption | undefined)?.id || ''
  }
  const handleDriverChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    form.driverId = (rows[0] as FuelCardDriverOption | undefined)?.id || ''
  }

  const handleConfirm = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      const isLocated = action.value === 'consume' && form.expenseCoordinateStatus === 'located'
      const coordinates = isLocated
        ? normalizeCoordinatePair(form.expenseLongitude, form.expenseLatitude)
        : null
      if (isLocated && (!coordinates || !form.expenseLocation.trim())) {
        notifyFriendlyError(null, '定位坐标或地址无效，请重新在地图选点或获取当前位置')
        return false
      }
      await recordFuelCardTransaction({
        cardId: form.cardId,
        entryType: action.value,
        amount: Number(form.amount),
        occurredOn: form.occurredAt.slice(0, 10),
        occurredAt: dayjs(form.occurredAt).toISOString(),
        referenceNo: form.referenceNo.trim(),
        rechargeChannel: action.value === 'recharge' ? form.rechargeChannel.trim() : '',
        invoiceNo: action.value === 'recharge' ? form.invoiceNo.trim() : '',
        rechargerEmployeeId: action.value === 'recharge' ? form.rechargerEmployeeId || null : null,
        stationName: action.value === 'consume' ? form.stationName.trim() : '',
        liters: action.value === 'consume' ? (form.liters ?? null) : null,
        unitPrice: action.value === 'consume' ? (form.unitPrice ?? null) : null,
        paymentMethod: action.value === 'consume' ? 'fuel_card' : null,
        expenseLocation: action.value === 'consume' ? form.expenseLocation.trim() : '',
        expenseLongitude: coordinates?.longitude ?? null,
        expenseLatitude: coordinates?.latitude ?? null,
        expenseCoordinateSystem: coordinates ? form.expenseCoordinateSystem : null,
        expenseCoordinateSource: coordinates ? form.expenseCoordinateSource : null,
        expenseCoordinateStatus: coordinates
          ? 'located'
          : action.value === 'consume'
            ? form.expenseCoordinateStatus
            : 'pending',
        expenseGeocodeProvider: coordinates ? form.expenseGeocodeProvider : null,
        expenseGeocodedAt: coordinates ? form.expenseGeocodedAt : null,
        odometerKm: action.value === 'consume' ? (form.odometerKm ?? null) : null,
        waybillId: action.value === 'consume' ? form.waybillId || null : null,
        driverId: action.value === 'consume' ? form.driverId || null : null,
        voucherPaths: voucherUrls.value.map((url) =>
          privateAttachmentPathFromSignedUrl(url, 'vms-fuel-card-private')
        ),
        remark: form.remark.trim()
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(
        error,
        action.value === 'recharge'
          ? '充值登记失败，请核对油卡和金额后重试'
          : '消费登记失败，请核对油卡余额和金额后重试'
      )
      return false
    }
  }

  const handleOpen = async (type: Action, card?: FuelCard): Promise<void> => {
    action.value = type
    Object.assign(form, {
      cardId: card?.id || '',
      amount: undefined,
      occurredOn: dayjs().format('YYYY-MM-DD'),
      occurredAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      referenceNo: '',
      rechargeChannel: '',
      invoiceNo: '',
      rechargerEmployeeId: undefined,
      stationName: '',
      liters: undefined,
      unitPrice: undefined,
      expenseLocation: '',
      expenseLongitude: null,
      expenseLatitude: null,
      expenseCoordinateSystem: null,
      expenseCoordinateSource: null,
      expenseCoordinateStatus: 'pending',
      expenseGeocodeProvider: null,
      expenseGeocodedAt: null,
      odometerKm: undefined,
      waybillId: '',
      driverId: '',
      remark: ''
    })
    cardSelectValue.value = card?.id || ''
    cardSelection.value = card ? [card] : []
    selectedRecharger.value = []
    voucherUrls.value = []
    waybillSelectValue.value = ''
    waybillSelection.value = []
    driverSelectValue.value = card?.driverId || ''
    driverSelection.value =
      card?.driverId && card.driverName
        ? [
            {
              id: card.driverId,
              tenantId: card.tenantId,
              driverName: card.driverName,
              phone: '',
              employeeId: null,
              isPrimary: true
            }
          ]
        : []
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(undefined, {
      title: type === 'recharge' ? '登记充值' : '登记消费',
      confirmText: type === 'recharge' ? '确认充值' : '确认消费',
      onConfirm: handleConfirm
    })
  }

  defineExpose({ handleOpen })
</script>
