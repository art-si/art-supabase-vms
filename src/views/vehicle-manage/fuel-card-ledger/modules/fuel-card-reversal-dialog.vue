<template>
  <ArtDialog ref="dialogRef" size="md">
    <template #subtitle>保留原流水，追加一笔相反方向的冲正记录；系统会重新计算油卡余额。</template>
    <div class="flex flex-col gap-4">
      <div
        v-if="entry"
        class="grid gap-2 rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-light)] p-4 text-sm sm:grid-cols-2"
      >
        <div class="min-w-0">
          <span class="text-[var(--el-text-color-secondary)]">油卡 / 车辆</span>
          <strong class="mt-1 block truncate" :title="`${entry.cardNo} / ${entry.plateNo}`">
            {{ entry.cardNo }} / {{ entry.plateNo }}
          </strong>
        </div>
        <div class="min-w-0">
          <span class="text-[var(--el-text-color-secondary)]">原流水金额</span>
          <strong class="mt-1 block tabular-nums">{{ formatCurrencyValue(entry.amount) }}</strong>
        </div>
        <div class="min-w-0">
          <span class="text-[var(--el-text-color-secondary)]">原流水日期</span>
          <strong class="mt-1 block">{{ entry.occurredOn }}</strong>
        </div>
        <div class="min-w-0">
          <span class="text-[var(--el-text-color-secondary)]">原流水类型</span>
          <ArtDictDisplay
            class="mt-1 block"
            dict-code="fuelCardEntryType"
            :value="entry.entryType"
          />
        </div>
      </div>
      <ElAlert
        type="warning"
        :closable="false"
        show-icon
        title="冲正充值或期初余额会减少当前余额；若余额不足，系统将拒绝，请先核对后续消费。"
      />
    </div>
    <ArtForm
      ref="formRef"
      v-model="form"
      :items="formItems"
      :rules="formRules"
      :span="24"
      label-width="110px"
      :show-reset="false"
      :show-submit="false"
      class="mt-5"
    />
  </ArtDialog>
</template>

<script setup lang="ts">
  import dayjs from 'dayjs'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { formatCurrencyValue } from '@/utils/ui/format'
  import { recordFuelCardTransaction, type FuelCardEntry } from '@/api/fuel-card'

  defineOptions({ name: 'VmsFuelCardReversalDialog' })

  interface ReversalForm {
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
  const entry = ref<FuelCardEntry>()
  const form = reactive<ReversalForm>({ referenceNo: '', remark: '' })
  const formItems: FormItem[] = [
    {
      label: '冲正凭证号',
      key: 'referenceNo',
      type: 'input',
      props: { maxlength: 80, placeholder: '可填写审批或更正凭证号' }
    },
    {
      label: '冲正原因',
      key: 'remark',
      type: 'input',
      props: {
        type: 'textarea',
        rows: 3,
        maxlength: 500,
        showWordLimit: true,
        placeholder: '说明原流水错误原因与本次更正依据'
      }
    }
  ]
  const formRules: FormRules<ReversalForm> = {
    remark: [{ required: true, whitespace: true, message: '请填写冲正原因', trigger: 'blur' }]
  }

  const handleConfirm = async (): Promise<boolean> => {
    const original = entry.value
    if (!original) return false
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
      await recordFuelCardTransaction({
        cardId: original.cardId,
        entryType: 'reversal',
        amount: original.amount,
        occurredOn: dayjs().format('YYYY-MM-DD'),
        reversesEntryId: original.id,
        referenceNo: form.referenceNo.trim(),
        remark: form.remark.trim()
      })
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '冲正失败，请核对原流水和油卡余额后重试')
      return false
    }
  }
  const handleOpen = async (original: FuelCardEntry): Promise<void> => {
    entry.value = original
    Object.assign(form, { referenceNo: '', remark: '' })
    await nextTick()
    formRef.value?.clearValidate()
    await dialogRef.value?.handleOpen(undefined, {
      title: '冲正流水',
      confirmText: '确认冲正',
      onConfirm: handleConfirm
    })
  }
  defineExpose({ handleOpen })
</script>
