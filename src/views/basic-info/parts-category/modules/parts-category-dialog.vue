<template>
  <ArtDialog ref="dialogRef" size="md">
    <template #subtitle>维护类别层级、业务编码与可用状态，避免零部件分类重复或失序。</template>

    <ArtForm
      ref="formRef"
      v-model="form"
      :items="items"
      :rules="rules"
      :span="12"
      :gutter="20"
      label-width="110px"
    />
  </ArtDialog>
</template>

<script setup lang="ts">
  import { replaceReactiveModel } from '@/utils/form/model'
  import { pick } from 'lodash-es'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import type { FormRules } from 'element-plus'
  import { storeToRefs } from 'pinia'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import { useDocumentNumberRule } from '@/hooks/core/useDocumentNumberRule'
  import { useTenantScopeFormPolicy } from '@/hooks/core/useTenantScopeFormPolicy'
  import { normalizeNonNullableText } from '@/utils/form/normalize'
  import { addPartsCategory, editPartsCategory, fetchPartsCategoryTree } from '@vms/api'
  import { useUserStore } from '@/store/modules/user'
  import TreeUtils from '@/utils/tree'

  type PartsCategory = Api.Vms.BasicInfo.PartsCategory
  type PartsCategoryForm = Pick<
    PartsCategory,
    | 'id'
    | 'tenantId'
    | 'parentId'
    | 'categoryName'
    | 'categoryCode'
    | 'categoryLevel'
    | 'sort'
    | 'status'
    | 'remark'
  >

  interface Emits {
    (e: 'success', type: 'add' | 'edit'): void
  }

  const emit = defineEmits<Emits>()
  const { getDictMap } = storeToRefs(useUserStore())
  const dialogRef = ref<ArtDialogExpose<PartsCategory | undefined>>()
  const formRef = ref<{
    validate: () => Promise<boolean>
    clearValidate: () => void
  }>()

  const { defaultWriteTenantId } = useTenantScopeFormPolicy()
  const createInitialForm = (): PartsCategoryForm => ({
    id: undefined,
    tenantId: defaultWriteTenantId.value ?? undefined,
    parentId: null,
    categoryName: '',
    categoryCode: '',
    categoryLevel: 1,
    sort: 1,
    status: '1',
    remark: ''
  })

  const form = ref<PartsCategoryForm>(createInitialForm())

  const categoryTree = new TreeUtils({ parentKey: 'parentId' })

  const categoryNumber = useDocumentNumberRule('vehicle.part_category', () => form.value.tenantId)

  const rules = computed<FormRules<PartsCategoryForm>>(() => ({
    categoryName: [
      { required: true, message: '请输入类别名称', trigger: 'blur' },
      { min: 2, max: 80, message: '长度应为 2 到 80 个字符', trigger: 'blur' }
    ],
    categoryCode: [
      ...(categoryNumber.manualRequired(Boolean(form.value.id))
        ? [{ required: true, message: '请输入类别编码', trigger: 'blur' as const }]
        : []),
      {
        pattern: /^[A-Za-z0-9_-]{2,50}$/,
        message: '编码仅支持字母、数字、下划线和中横线，长度 2 到 50',
        trigger: 'blur'
      }
    ],
    sort: [{ type: 'number', min: 0, max: 9999, message: '排序范围为 0 到 9999', trigger: 'blur' }],
    remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }]
  }))

  const items = computed<FormItem[]>(() => [
    {
      label: '上级类别',
      key: 'parentId',
      type: 'treeSelect',
      span: 24,
      api: async (params: Partial<Pick<PartsCategory, 'categoryName'>> = {}) => {
        const result = await fetchPartsCategoryTree(params)
        return {
          ...result,
          data:
            result.data && form.value.id
              ? categoryTree.removeNodesByCondition(
                  result.data,
                  (node) => node.id === form.value.id
                ).tree
              : result.data
        }
      },
      resultField: 'data',
      labelField: 'categoryName',
      valueField: 'id',
      childrenField: 'children',
      props: {
        clearable: true,
        checkStrictly: true,
        defaultExpandAll: true,
        renderAfterExpand: false,
        placeholder: '不选则为一级类别'
      }
    },
    {
      label: '类别名称',
      key: 'categoryName',
      type: 'input',
      span: 24,
      props: {
        maxlength: 80
      }
    },
    {
      label: '类别编码',
      key: 'categoryCode',
      type: 'input',
      span: 14,
      props: {
        maxlength: 50,
        ...categoryNumber.inputProps(Boolean(form.value.id), '如 engine_part', true)
      },
      description: categoryNumber.description.value
    },
    {
      label: '排序',
      key: 'sort',
      type: 'number',
      span: 10,
      props: {
        min: 0,
        max: 9999,
        controlsPosition: 'right',
        class: '!w-full'
      }
    },
    {
      label: '状态',
      key: 'status',
      type: 'radioGroup',
      span: 24,
      props: {
        options: getDictMap.value.status ?? []
      }
    },
    {
      label: '备注',
      key: 'remark',
      type: 'input',
      span: 24,
      props: {
        type: 'textarea',
        rows: 4,
        maxlength: 500,
        showWordLimit: true
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
      const payload: PartsCategoryForm = {
        id: form.value.id,
        ...(!form.value.id ? { tenantId: form.value.tenantId } : {}),
        parentId: form.value.parentId || null,
        categoryName: normalizeNonNullableText(form.value.categoryName),
        categoryCode: normalizeNonNullableText(form.value.categoryCode),
        categoryLevel: form.value.categoryLevel,
        sort: form.value.sort,
        status: form.value.status,
        remark: normalizeNonNullableText(form.value.remark)
      }
      if (form.value.id) {
        await editPartsCategory(payload)
      } else {
        await addPartsCategory(payload)
      }
      emit('success', form.value.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '配件分类保存失败，请检查填写内容后重试')
      return false
    }
  }

  const handleOpen = async (row?: PartsCategory, parent?: PartsCategory): Promise<void> => {
    await resetForm()
    const isEdit = !!row?.id

    if (isEdit) {
      replaceReactiveModel(form.value, {
        ...createInitialForm(),
        ...pick(row, Object.keys(createInitialForm()))
      })
    } else if (parent?.id) {
      form.value.parentId = parent.id
      form.value.tenantId = parent.tenantId
    }

    await dialogRef.value?.handleOpen(row, {
      title: isEdit ? '编辑零部件类别' : parent?.id ? '新增子类别' : '新增零部件类别',
      loading: true,
      loadingText: '正在加载编号规则…',
      onOpen: async (_openData, api) => {
        try {
          await categoryNumber.loadRule()
        } finally {
          api.setLoading(false)
        }
      },
      onConfirm: handleSubmit,
      onReset: () => void resetForm()
    })
  }

  defineExpose({
    handleOpen,
    handleClose: () => dialogRef.value?.handleClose()
  })
</script>
