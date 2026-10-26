<template>
  <ArtDialog ref="dialogRef" size="md" :show-fullscreen-button="false">
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
      :span="24"
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
    </ArtForm>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtTableSingleSelect from '@/components/core/forms/art-data-select/table-single.vue'
  import type {
    DataSelectColumn,
    DataSelectRecord
  } from '@/components/core/forms/art-data-select/types'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { fetchFuelCardList, recordFuelCardTransaction, type FuelCard } from '@/api/fuel-card'
  import { formatCurrencyValue } from '@/utils/ui/format'

  defineOptions({ name: 'VmsFuelCardEntryDialog' })

  type Action = 'recharge' | 'consume'

  interface EntryForm {
    cardId: string
    amount: number | undefined
    occurredOn: string
    referenceNo: string
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
    referenceNo: '',
    remark: ''
  })
  const cardSelectValue = ref<string>('')
  const cardSelection = ref<FuelCard[]>([])
  const selectedCard = computed(() => cardSelection.value[0])
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
    { label: '油卡', key: 'cardId' },
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
      label: '发生日期',
      key: 'occurredOn',
      type: 'date',
      props: { type: 'date', valueFormat: 'YYYY-MM-DD', class: '!w-full' }
    },
    {
      label: '业务凭证号',
      key: 'referenceNo',
      type: 'input',
      props: { maxlength: 80, placeholder: '可填写充值单号或消费凭证号' }
    },
    {
      label: '备注',
      key: 'remark',
      type: 'input',
      props: { type: 'textarea', rows: 3, maxlength: 500, showWordLimit: true }
    }
  ])
  const formRules: FormRules<EntryForm> = {
    cardId: [{ required: true, message: '请选择油卡', trigger: 'change' }],
    amount: [
      { required: true, type: 'number', min: 0.01, message: '金额必须大于 0', trigger: 'change' }
    ],
    occurredOn: [{ required: true, message: '请选择发生日期', trigger: 'change' }]
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
    form.cardId = card?.id || ''
  }

  const handleConfirm = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await recordFuelCardTransaction({
        cardId: form.cardId,
        entryType: action.value,
        amount: Number(form.amount),
        occurredOn: form.occurredOn,
        referenceNo: form.referenceNo.trim(),
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
      referenceNo: '',
      remark: ''
    })
    cardSelectValue.value = card?.id || ''
    cardSelection.value = card ? [card] : []
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
