<template>
  <ArtDialog ref="dialogRef" size="md">
    <template #subtitle>维护供应厂商、联系人与服务地址，确保采购和维保协同信息准确可用。</template>

    <ArtForm
      ref="formRef"
      v-model="form"
      :items="items"
      :rules="rules"
      :span="12"
      :gutter="20"
      label-width="120px"
    >
      <template #addressPicker>
        <ArtAddressPicker
          v-if="canViewField(currentFieldAccess, 'addressDetails')"
          v-model:region-path="form.regionPath"
          v-model:address-detail="form.addressDetail"
          :region-api="fetchRegionOptions"
          :show-coordinate-hint="false"
          :disabled="!canEditField(currentFieldAccess, 'addressDetails')"
          hide-region-selector
          label-width="120px"
        />
      </template>
    </ArtForm>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { replaceReactiveModel } from '@/utils/form/model'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import type { FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtAddressPicker from '@/components/core/forms/art-address-picker/index.vue'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { addSupplier, editSupplier } from '@vms/api'
  import { fetchRegionOptions } from '@/api/region-options'
  import { canEditField, canViewField } from '@/utils/field-permission'
  import { EDITABLE_SUPPLIER_ACCESS, sanitizeSupplierPayload } from './supplier-model'

  type Supplier = Api.Vms.BasicInfo.Supplier
  type SupplierForm = Supplier & {
    addressPicker?: undefined
    regionPath?: string[]
  }

  interface Emits {
    (e: 'success', type: 'add' | 'edit'): void
  }

  const emit = defineEmits<Emits>()
  const dialogRef = ref<ArtDialogExpose<Supplier | undefined>>()
  const formRef = ref<{
    validate: () => Promise<boolean>
    clearValidate: () => void
  }>()

  const createInitialForm = (): SupplierForm => ({
    id: undefined,
    supplierName: '',
    contactPerson: '',
    contactPhone: '',
    region: '',
    addressPicker: undefined,
    regionPath: [],
    addressDetail: '',
    remark: ''
  })

  const form = ref<SupplierForm>(createInitialForm())
  const currentFieldAccess = computed<Api.Vms.BasicInfo.SupplierFieldAccessMap>(() =>
    form.value.id ? (form.value.fieldAccess ?? {}) : EDITABLE_SUPPLIER_ACCESS
  )

  const rules: FormRules<SupplierForm> = {
    supplierName: [
      { required: true, message: '请输入供应厂商名称', trigger: 'blur' },
      { min: 2, max: 100, message: '长度应为 2 到 100 个字符', trigger: 'blur' }
    ],
    contactPerson: [{ max: 50, message: '联系人不能超过 50 个字符', trigger: 'blur' }],
    contactPhone: [
      {
        validator: (_rule, value, callback) => {
          if (!canEditField(currentFieldAccess.value, 'contactDetails') || !value) {
            return callback()
          }
          return /^(?:1[3-9]\d{9}|0\d{2,3}-?\d{7,8})$/.test(String(value))
            ? callback()
            : callback(new Error('请输入正确的手机号或座机号'))
        },
        trigger: 'blur'
      }
    ],
    region: [{ max: 100, message: '省/市/区不能超过 100 个字符', trigger: 'blur' }],
    addressDetail: [{ max: 200, message: '详细地址不能超过 200 个字符', trigger: 'blur' }],
    remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }]
  }

  const items = computed<FormItem[]>(() => [
    {
      label: '供应厂商名称',
      key: 'supplierName',
      type: 'input',
      span: 24,
      props: {
        maxlength: 100
      }
    },
    {
      label: '联络与地址',
      key: 'contactSection',
      type: 'divider',
      span: 24,
      hidden:
        !canViewField(currentFieldAccess.value, 'contactDetails') &&
        !canViewField(currentFieldAccess.value, 'addressDetails')
    },
    {
      label: '联系人',
      key: 'contactPerson',
      type: 'input',
      hidden: !canViewField(currentFieldAccess.value, 'contactDetails'),
      props: {
        maxlength: 50,
        disabled: !canEditField(currentFieldAccess.value, 'contactDetails')
      }
    },
    {
      label: '联系电话',
      key: 'contactPhone',
      type: 'input',
      hidden: !canViewField(currentFieldAccess.value, 'contactDetails'),
      props: {
        maxlength: 20,
        placeholder: '请输入手机号或座机号',
        disabled: !canEditField(currentFieldAccess.value, 'contactDetails')
      }
    },
    {
      label: '',
      key: 'addressPicker',
      type: 'input',
      span: 24,
      labelWidth: 0,
      hidden: !canViewField(currentFieldAccess.value, 'addressDetails')
    },
    {
      label: '备注',
      key: 'remark',
      type: 'input',
      span: 24,
      hidden: !canViewField(currentFieldAccess.value, 'internalNotes'),
      props: {
        type: 'textarea',
        rows: 3,
        maxlength: 500,
        showWordLimit: true,
        placeholder: '请输入备注',
        disabled: !canEditField(currentFieldAccess.value, 'internalNotes')
      }
    }
  ])

  const resetForm = async (): Promise<void> => {
    replaceReactiveModel(form.value, createInitialForm())
    await nextTick()
    formRef.value?.clearValidate()
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '表单校验未完成，请稍后重试', 'warning')
      return false
    }

    try {
      const { regionPath, ...payload } = toRaw(form.value)
      delete payload.addressPicker
      if (!form.value.id || canEditField(currentFieldAccess.value, 'addressDetails')) {
        payload.region = regionPath?.join('/') || ''
      }
      const safePayload = sanitizeSupplierPayload(payload)
      if (form.value.id) {
        await editSupplier(safePayload)
      } else {
        await addSupplier(safePayload)
      }
      emit('success', form.value.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '车辆供应商保存失败，请检查填写内容后重试')
      return false
    }
  }

  const handleOpen = async (row?: Supplier): Promise<void> => {
    await resetForm()
    const isEdit = !!row?.id
    if (isEdit) {
      const editData = structuredClone(toRaw(row)) as SupplierForm
      editData.regionPath = editData.region?.split('/').filter(Boolean) || []
      replaceReactiveModel(form.value, editData)
    }

    await dialogRef.value?.handleOpen(row, {
      title: isEdit ? '编辑供应厂商' : '新增供应厂商',
      onConfirm: handleSubmit,
      onReset: () => void resetForm()
    })
  }

  defineExpose({
    handleOpen,
    handleClose: () => dialogRef.value?.handleClose()
  })
</script>
