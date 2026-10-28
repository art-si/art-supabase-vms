<template>
  <ArtDialog ref="dialogRef" size="lg">
    <template #subtitle>{{
      action === 'recharge'
        ? '登记实际充值，电卡余额即时增加并保留流水。'
        : '登记充电消费，余额不足时系统会阻止提交。'
    }}</template>
    <ArtForm
      ref="formRef"
      v-model="form"
      :items="formItems"
      :rules="formRules"
      :span="12"
      label-width="118px"
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
          title="选择电卡"
          search-placeholder="输入电卡号或车牌号"
          empty-text="暂无正常状态电卡"
          empty-description="请先在电卡档案创建并启用电卡。"
          show-pagination
          @change="handleCardChange"
        />
      </template>
      <template #currentBalance>
        <span class="font-medium tabular-nums">
          {{ selectedCard ? formatCurrencyValue(selectedCard.balance) : '选择电卡后显示余额' }}
        </span>
      </template>
      <template #driverName>
        <span>{{ selectedCard?.driverName || '未绑定主司机' }}</span>
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
          empty-text="该电卡车辆暂无可关联运单"
          :disabled="!selectedCard"
          show-pagination
          clearable
          @change="handleWaybillChange"
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
          detail-placeholder="搜索/点击地图选择充电地点，或使用当前位置"
          address-detail-prop="expenseLocation"
          label-width="118px"
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
      title="充电数与电价用于核对，实际扣款以消费金额为准。"
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
        >可上传充电小票、充值凭证等照片，最多 5 张。</p
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
  import ArtAddressPicker from '@/components/core/forms/art-address-picker/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import type {
    DataSelectColumn,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { normalizeCoordinatePair } from '@/utils/geo'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import {
    privateAttachmentPathFromSignedUrl,
    uploadPrivateAttachment
  } from '@/utils/supabase/private-attachment'
  import { formatCurrencyValue } from '@/utils/ui/format'
  import {
    fetchElectricCards,
    fetchElectricCardWaybillOptions,
    recordElectricCardTransaction,
    type ElectricCard,
    type ElectricCardWaybillOption
  } from '@/api/electric-card'

  defineOptions({ name: 'VmsElectricCardEntryDialog' })

  type Action = 'recharge' | 'consume'
  interface EntryForm {
    cardId: string
    amount: number | undefined
    occurredAt: string
    referenceNo: string
    rechargeChannel: string
    invoiceNo: string
    stationName: string
    waybillId: string
    expenseLocation: string
    expenseLongitude: number | null
    expenseLatitude: number | null
    expenseCoordinateSystem: string | null
    expenseCoordinateSource: string | null
    expenseCoordinateStatus: string
    expenseGeocodeProvider: string | null
    expenseGeocodedAt: string | null
    pileNo: string
    chargeKwh: number | undefined
    unitPrice: number | undefined
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
    occurredAt: '',
    referenceNo: '',
    rechargeChannel: '',
    invoiceNo: '',
    stationName: '',
    waybillId: '',
    expenseLocation: '',
    expenseLongitude: null,
    expenseLatitude: null,
    expenseCoordinateSystem: null,
    expenseCoordinateSource: null,
    expenseCoordinateStatus: 'pending',
    expenseGeocodeProvider: null,
    expenseGeocodedAt: null,
    pileNo: '',
    chargeKwh: undefined,
    unitPrice: undefined,
    remark: ''
  })
  const voucherUrls = ref<string[]>([])
  const cardSelectValue = ref('')
  const cardSelection = ref<ElectricCard[]>([])
  const waybillSelectValue = ref('')
  const waybillSelection = ref<ElectricCardWaybillOption[]>([])
  const selectedCard = computed(() => cardSelection.value[0])
  const fetchWaybills = (params: { page: number; pageSize: number; keyword?: string }) =>
    fetchElectricCardWaybillOptions({
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
  const cardColumns: DataSelectColumn[] = [
    { prop: 'cardNo', label: '电卡号', minWidth: 170 },
    { prop: 'plateNo', label: '绑定车牌', minWidth: 130 },
    {
      prop: 'balance',
      label: '当前余额',
      minWidth: 120,
      formatter: (row: DataSelectRecord) => formatCurrencyValue(Number(row.balance || 0))
    }
  ]
  const fetchSelectableCards = (params: { page: number; pageSize: number; keyword?: string }) =>
    fetchElectricCards({
      current: params.page,
      size: params.pageSize,
      keyword: params.keyword,
      status: 'active'
    })
  const handleCardChange = (_value: unknown, rows: DataSelectRecord[]): void => {
    const card = rows[0] as ElectricCard | undefined
    if (card?.id !== form.cardId) {
      voucherUrls.value = []
      form.waybillId = ''
      waybillSelectValue.value = ''
      waybillSelection.value = []
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
    form.waybillId = (rows[0] as ElectricCardWaybillOption | undefined)?.id || ''
  }
  const uploadVoucher = (file: File) =>
    uploadPrivateAttachment(file, {
      bucket: 'vms-electric-card-private',
      tenantId: selectedCard.value?.tenantId || '',
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      maxBytes: 8 * 1024 * 1024
    })
  const formItems = computed<FormItem[]>(() => [
    { label: '电卡', key: 'cardId', span: 24 },
    { label: '当前余额', key: 'currentBalance', span: 12 },
    { label: '绑定司机', key: 'driverName', span: 12 },
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
      label: '业务凭证号',
      key: 'referenceNo',
      type: 'input',
      props: { maxlength: 100, placeholder: '可填写充值单号或消费凭证号' }
    },
    ...(action.value === 'recharge'
      ? ([
          {
            label: '充值渠道',
            key: 'rechargeChannel',
            type: 'input',
            props: { maxlength: 80, placeholder: '例如充电站柜台、银行转账' }
          },
          { label: '发票号', key: 'invoiceNo', type: 'input', props: { maxlength: 80 } }
        ] satisfies FormItem[])
      : ([
          { label: '关联运单', key: 'waybillId' },
          {
            label: '充电站',
            key: 'stationName',
            type: 'input',
            props: { maxlength: 120, placeholder: '请输入充电站名称' }
          },
          { label: '', key: 'locationPicker', span: 24, labelWidth: 0 },
          {
            label: '表号/桩号',
            key: 'pileNo',
            type: 'input',
            props: { maxlength: 80, placeholder: '请输入电表或充电桩编号' }
          },
          {
            label: '充电数（kWh）',
            key: 'chargeKwh',
            type: 'number',
            props: { min: 0.001, precision: 3, controls: false, class: '!w-full' }
          },
          {
            label: '电价（元/kWh）',
            key: 'unitPrice',
            type: 'number',
            props: { min: 0, precision: 4, controls: false, class: '!w-full' }
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
    cardId: [{ required: true, message: '请选择电卡', trigger: 'change' }],
    amount: [
      { required: true, type: 'number', min: 0.01, message: '金额必须大于 0', trigger: 'change' }
    ],
    occurredAt: [{ required: true, message: '请选择流水时间', trigger: 'change' }],
    chargeKwh: [
      {
        validator: (_rule, value, callback) => {
          if (action.value === 'consume' && !(Number(value) > 0))
            callback(new Error('请输入充电数'))
          else callback()
        },
        trigger: 'change'
      }
    ],
    unitPrice: [
      {
        validator: (_rule, value, callback) => {
          if (action.value === 'consume' && !(Number(value) >= 0)) callback(new Error('请输入电价'))
          else callback()
        },
        trigger: 'change'
      }
    ]
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
      await recordElectricCardTransaction({
        cardId: form.cardId,
        entryType: action.value,
        amount: Number(form.amount),
        occurredAt: dayjs(form.occurredAt).toISOString(),
        chargeKwh: action.value === 'consume' ? form.chargeKwh : null,
        unitPrice: action.value === 'consume' ? form.unitPrice : null,
        stationName: action.value === 'consume' ? form.stationName.trim() : '',
        waybillId: action.value === 'consume' ? form.waybillId || null : null,
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
        pileNo: action.value === 'consume' ? form.pileNo.trim() : '',
        rechargeChannel: action.value === 'recharge' ? form.rechargeChannel.trim() : '',
        invoiceNo: action.value === 'recharge' ? form.invoiceNo.trim() : '',
        referenceNo: form.referenceNo.trim(),
        driverId: selectedCard.value?.driverId || null,
        voucherPaths: voucherUrls.value.map((url) =>
          privateAttachmentPathFromSignedUrl(url, 'vms-electric-card-private')
        ),
        remark: form.remark.trim()
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(
        error,
        action.value === 'recharge'
          ? '电卡充值失败，请核对卡状态和金额后重试'
          : '充电消费失败，请核对电卡余额和金额后重试'
      )
      return false
    }
  }
  const handleOpen = async (type: Action, card?: ElectricCard): Promise<void> => {
    action.value = type
    Object.assign(form, {
      cardId: card?.id || '',
      amount: undefined,
      occurredAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      referenceNo: '',
      rechargeChannel: '',
      invoiceNo: '',
      stationName: '',
      waybillId: '',
      expenseLocation: '',
      expenseLongitude: null,
      expenseLatitude: null,
      expenseCoordinateSystem: null,
      expenseCoordinateSource: null,
      expenseCoordinateStatus: 'pending',
      expenseGeocodeProvider: null,
      expenseGeocodedAt: null,
      pileNo: '',
      chargeKwh: undefined,
      unitPrice: undefined,
      remark: ''
    })
    cardSelectValue.value = card?.id || ''
    cardSelection.value = card ? [card] : []
    waybillSelectValue.value = ''
    waybillSelection.value = []
    voucherUrls.value = []
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(undefined, {
      title: type === 'recharge' ? '登记电卡充值' : '登记充电消费',
      confirmText: type === 'recharge' ? '确认充值' : '确认消费',
      onConfirm: handleConfirm
    })
  }
  defineExpose({ handleOpen })
</script>
