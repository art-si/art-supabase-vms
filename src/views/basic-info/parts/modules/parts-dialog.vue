<template>
  <ArtDialog ref="dialogRef" size="lg" :confirm-disabled="referenceLoading || !!referenceError">
    <template #subtitle>
      维护零部件的基础属性、质保寿命和供应信息，便于后续维修、库存和采购业务复用。
    </template>

    <ArtAsyncState
      v-if="referenceError"
      :error="referenceError"
      error-title="物料基础资料加载失败"
      retryable
      @retry="loadReferences"
    />
    <ArtForm
      ref="formRef"
      v-model:active-tab="activeTab"
      v-model="form"
      :items="items"
      :rules="rules"
      :span="12"
      :gutter="20"
      label-width="110px"
    >
      <template #selectedMaterials>
        <ArtTable
          :data="materialDrafts"
          :columns="materialColumns"
          :pagination="false"
          :max-height="280"
          row-key="materialId"
        />
      </template>
    </ArtForm>
  </ArtDialog>
</template>

<script setup lang="tsx">
  import { keyBy } from 'lodash-es'
  import { replaceReactiveModel } from '@/utils/form/model'
  import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import { ElSelect, ElOption, ElMessage, type FormRules } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtForm, { type FormItem } from '@/components/core/forms/art-form/index.vue'
  import ArtAsyncState from '@/components/core/feedback/art-async-state/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import type { ColumnOption } from '@/types'
  import type { DataSelectFetchParams } from '@/components/core/forms/art-data-select/types'
  import { buildMaterialCategoryNavigation } from '@/utils/business/material-category'
  import { useTenantScopeFormPolicy } from '@/hooks/core/useTenantScopeFormPolicy'
  import { useUserStore } from '@/store/modules/user'
  import {
    addPartsBatch,
    editParts,
    fetchPartsCategoryTree,
    fetchSupplierOptions,
    fetchPartMaterialOptions,
    fetchPartMaterialCategories,
    fetchPartUnitOptions
  } from '@vms/api'

  type Parts = Api.Vms.BasicInfo.Parts
  type Supplier = Api.Vms.BasicInfo.Supplier
  type Material = Awaited<ReturnType<typeof fetchPartMaterialOptions>>['data'][number]
  type PartForm = Parts & { materialIds: string[] }

  interface Emits {
    (e: 'success', type: 'add' | 'edit'): void
  }

  const emit = defineEmits<Emits>()
  const activeTab = ref('basicSection')
  const dialogRef = ref<ArtDialogExpose<Parts | undefined>>()
  const formRef = ref<{
    validate: () => Promise<boolean>
    clearValidate: () => void
  }>()
  const { getDictMap } = storeToRefs(useUserStore())

  const { defaultWriteTenantId } = useTenantScopeFormPolicy()
  const createInitialForm = (): PartForm => ({
    id: undefined,
    tenantId: defaultWriteTenantId.value ?? undefined,
    materialId: null,
    materialIds: [],
    unitId: null,
    partName: '',
    partCode: '',
    categoryId: null,
    brand: '',
    model: '',
    unit: '',
    supplierId: null,
    manufacturer: '',
    supplierContact: '',
    isConsumable: false,
    warrantyMileage: null,
    warrantyDuration: null,
    serviceLife: null,
    serviceMileage: null,
    status: '1',
    remark: ''
  })

  const form = ref<PartForm>(createInitialForm())
  const selectedMaterials = ref<Pick<Material, 'id' | 'materialCode' | 'materialName'>[]>([])
  const materialDrafts = ref<Parts[]>([])
  const categories = ref<Awaited<ReturnType<typeof fetchPartMaterialCategories>>>([])
  const units = ref<Awaited<ReturnType<typeof fetchPartUnitOptions>>>([])
  const referenceLoading = ref(false)
  const referenceError = ref('')
  let revision = 0
  const isBatch = computed(() => !form.value.id && materialDrafts.value.length > 1)
  const fetchMaterials = (params: DataSelectFetchParams) =>
    fetchPartMaterialOptions(params, form.value.tenantId)

  const loadReferences = async (): Promise<void> => {
    const current = revision
    referenceLoading.value = true
    referenceError.value = ''
    try {
      if (!form.value.tenantId) {
        referenceError.value = '无法确定零部件所属租户，请刷新后重试。'
        return
      }
      const [nextCategories, nextUnits] = await Promise.all([
        fetchPartMaterialCategories(form.value.tenantId),
        fetchPartUnitOptions(form.value.tenantId)
      ])
      if (current !== revision) return
      categories.value = nextCategories
      units.value = nextUnits
      if (!form.value.unitId && form.value.unit) {
        form.value.unitId =
          nextUnits.find(
            (unit) => unit.unitName === form.value.unit || unit.unitCode === form.value.unit
          )?.id ?? null
      }
    } catch {
      if (current === revision) referenceError.value = '物料分类或计量单位加载失败，请重试后继续。'
    } finally {
      if (current === revision) referenceLoading.value = false
    }
  }

  const handleMaterialChange = (_value: unknown, rows: Material[]): void => {
    const previous = keyBy(materialDrafts.value, 'materialId')
    const previousSingleId = isBatch.value ? undefined : selectedMaterials.value[0]?.id
    const previousSingleUnitId = form.value.unitId
    selectedMaterials.value = rows
    materialDrafts.value = rows.map((material) => {
      const existing = previous[material.id]
      const unitId =
        material.id === previousSingleId
          ? previousSingleUnitId
          : existing
            ? existing.unitId
            : material.baseUnitId
      return {
        materialId: material.id,
        partName: material.materialName || '',
        partCode: material.materialCode || '',
        brand: material.brand || '',
        model: material.specificationModel || '',
        unitId: unitId || null,
        unit:
          units.value.find((unit) => unit.id === unitId)?.unitName ||
          existing?.unit ||
          material.baseUnit?.unitName ||
          ''
      }
    })
    const first = materialDrafts.value[0]
    Object.assign(form.value, {
      materialId: first?.materialId || null,
      partName: first?.partName || '',
      partCode: first?.partCode || '',
      brand: first?.brand || '',
      model: first?.model || '',
      unitId: first?.unitId || null,
      unit: first?.unit || ''
    })
  }

  const materialColumns = computed<ColumnOption<Parts>[]>(() => [
    { prop: 'partName', label: '零部件名称', minWidth: 150 },
    { prop: 'partCode', label: '零部件编码', minWidth: 140 },
    { prop: 'brand', label: '品牌', minWidth: 100 },
    { prop: 'model', label: '型号', minWidth: 120 },
    {
      prop: 'unitId',
      label: '计量单位',
      width: 140,
      formatter: (row) => (
        <ElSelect v-model={row.unitId} aria-label={`${row.partName}计量单位`} filterable>
          {units.value.map((unit) => (
            <ElOption key={unit.id} label={unit.unitName} value={unit.id} />
          ))}
        </ElSelect>
      )
    }
  ])

  const rules = computed<FormRules<PartForm>>(() => ({
    materialIds: [
      { type: 'array', required: !form.value.id, min: 1, message: '请参选物料', trigger: 'change' }
    ],
    partName: [{ required: true, message: '请参选物料', trigger: 'change' }],
    categoryId: [{ required: true, message: '请选择零部件类别', trigger: 'change' }],
    brand: [{ max: 80, message: '品牌不能超过 80 个字符', trigger: 'blur' }],
    model: [{ max: 80, message: '型号不能超过 80 个字符', trigger: 'blur' }],
    unitId: [
      {
        required: !isBatch.value && !!form.value.materialId,
        message: '请选择计量单位',
        trigger: 'change'
      }
    ],
    manufacturer: [{ max: 100, message: '生产厂商不能超过 100 个字符', trigger: 'blur' }],
    supplierContact: [{ max: 100, message: '供应商联系人不能超过 100 个字符', trigger: 'blur' }],
    remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }]
  }))

  const items = computed<FormItem[]>(() => [
    {
      label: '基础信息',
      key: 'basicSection',
      type: 'tab',
      span: 24
    },
    {
      label: '零部件名称',
      key: form.value.id ? 'materialId' : 'materialIds',
      type: 'dataSelect',
      span: 24,
      description: form.value.id
        ? '从物料编码参选，自动带入零部件属性。'
        : '可多选物料批量新增；类别、质保与供应信息应用于本次所选物料。',
      props: {
        mode: 'table',
        multiple: !form.value.id,
        apiFn: fetchMaterials,
        selectedData: selectedMaterials.value,
        navigation: buildMaterialCategoryNavigation(categories.value),
        rowKey: 'id',
        labelKey: 'materialName',
        descriptionKey: 'materialCode',
        title: '参选物料编码',
        subtitle: '数据来源：MDM 主数据 · 物料主数据 · 物料编码',
        placeholder:
          form.value.id && !form.value.materialId
            ? `${form.value.partName}（历史档案，可关联物料）`
            : '参选零部件物料',
        searchPlaceholder: '搜索物料编码、名称或规格型号',
        showSelectedPanel: true,
        showTableHeader: true,
        showPagination: true,
        disabled: referenceLoading.value || !!referenceError.value,
        columns: [
          { prop: 'materialCode', label: '物料编码', minWidth: 140 },
          { prop: 'materialName', label: '物料名称', minWidth: 160 },
          { prop: 'description', label: '物料描述', minWidth: 160 },
          { prop: 'specificationModel', label: '规格型号', minWidth: 140 },
          { prop: 'brand', label: '品牌', minWidth: 100 },
          { prop: 'baseUnit.unitName', label: '单位', width: 90 }
        ],
        onChange: handleMaterialChange
      }
    },
    { key: 'selectedMaterials', label: '已选零部件', span: 24, hidden: !isBatch.value },
    {
      label: '零部件编码',
      key: 'partCode',
      type: 'input',
      hidden: isBatch.value,
      props: {
        readonly: true,
        placeholder: '参选物料后自动带入'
      },
      description: '与所选物料编码保持一致'
    },
    {
      label: '零部件类别',
      key: 'categoryId',
      type: 'treeSelect',
      api: fetchPartsCategoryTree,
      beforeFetch: (params) => ({ ...params, tenantId: form.value.tenantId }),
      shouldFetch: () => Boolean(form.value.tenantId),
      resultField: 'data',
      labelField: 'categoryName',
      valueField: 'id',
      childrenField: 'children',
      props: {
        checkStrictly: true,
        defaultExpandAll: true,
        renderAfterExpand: false
      }
    },
    {
      label: '品牌',
      key: 'brand',
      type: 'input',
      hidden: isBatch.value,
      props: {
        readonly: true,
        placeholder: '参选物料后自动带入'
      }
    },
    {
      label: '型号',
      key: 'model',
      type: 'input',
      hidden: isBatch.value,
      props: {
        readonly: true,
        placeholder: '参选物料后自动带入'
      }
    },
    {
      label: '计量单位',
      key: 'unitId',
      type: 'select',
      hidden: isBatch.value,
      description: '统一使用 MDM 计量单位，可修改本零部件的计量单位。',
      props: {
        options: units.value.map((unit) => ({ label: unit.unitName, value: unit.id })),
        loading: referenceLoading.value,
        disabled: referenceLoading.value || !!referenceError.value
      }
    },
    {
      label: '易损/耗件',
      key: 'isConsumable',
      type: 'radioGroup',
      span: 24,
      props: {
        optionType: 'button',
        options: getBooleanDictOptions()
      }
    },
    {
      label: '质保与寿命',
      key: 'lifeSection',
      type: 'tab',
      span: 24
    },
    {
      label: '质保里程',
      key: 'warrantyMileage',
      type: 'number',
      props: {
        min: 0,
        controlsPosition: 'right',
        class: '!w-full'
      },
      description: '单位：公里'
    },
    {
      label: '质保时长',
      key: 'warrantyDuration',
      type: 'number',
      props: {
        min: 0,
        controlsPosition: 'right',
        class: '!w-full'
      },
      description: '单位：个月'
    },
    {
      label: '使用年限',
      key: 'serviceLife',
      type: 'number',
      props: {
        min: 0,
        controlsPosition: 'right',
        class: '!w-full'
      },
      description: '单位：年'
    },
    {
      label: '使用里程',
      key: 'serviceMileage',
      type: 'number',
      props: {
        min: 0,
        controlsPosition: 'right',
        class: '!w-full'
      },
      description: '单位：公里'
    },
    {
      label: '供应信息',
      key: 'supplierSection',
      type: 'tab',
      span: 24
    },
    {
      label: '生产厂商',
      key: 'manufacturer',
      type: 'input',
      props: {
        maxlength: 100
      }
    },
    {
      label: '供应厂商',
      key: 'supplierId',
      type: 'select',
      api: fetchSupplierOptions,
      beforeFetch: (params) => ({ ...params, tenantId: form.value.tenantId }),
      shouldFetch: () => Boolean(form.value.tenantId),
      resultField: 'data',
      labelField: 'supplierName',
      valueField: 'id',
      labelFn: (item) => {
        const supplier = item as Supplier
        return [supplier.supplierName, supplier.contactPerson].filter(Boolean).join(' / ')
      }
    },
    {
      label: '供应商联系人',
      key: 'supplierContact',
      type: 'input',
      props: {
        maxlength: 100
      }
    },
    {
      label: '状态',
      key: 'status',
      type: 'radioGroup',
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

  const getBooleanDictOptions = () =>
    (getDictMap.value.commonBoolean ?? []).map((item) => ({
      ...item,
      value: item.value === 'true'
    }))

  const resetForm = async (): Promise<void> => {
    revision++
    selectedMaterials.value = []
    materialDrafts.value = []
    categories.value = []
    units.value = []
    replaceReactiveModel(form.value, createInitialForm())
    await nextTick()
    formRef.value?.clearValidate()
  }

  const handleSubmit = async (): Promise<boolean> => {
    if (referenceLoading.value || referenceError.value) return false
    if (
      !form.value.id &&
      (!materialDrafts.value.length ||
        (isBatch.value ? materialDrafts.value.some((row) => !row.unitId) : !form.value.unitId))
    ) {
      ElMessage.warning('请参选物料并完善每项零部件的计量单位')
      return false
    }
    try {
      if (!(await validateArtFormForSubmit(formRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '表单校验未完成，请稍后重试', 'warning')
      return false
    }

    try {
      const source = toRaw(form.value)
      const payload: Parts = {
        id: source.id,
        ...(!source.id ? { tenantId: source.tenantId } : {}),
        partName: source.partName,
        partCode: source.partCode,
        categoryId: source.categoryId || null,
        brand: source.brand,
        model: source.model,
        unit: units.value.find((unit) => unit.id === source.unitId)?.unitName || source.unit,
        materialId: source.materialId,
        unitId: source.unitId,
        supplierId: source.supplierId || null,
        manufacturer: source.manufacturer,
        supplierContact: source.supplierContact,
        isConsumable: source.isConsumable,
        warrantyMileage: source.warrantyMileage,
        warrantyDuration: source.warrantyDuration,
        serviceLife: source.serviceLife,
        serviceMileage: source.serviceMileage,
        status: source.status,
        remark: source.remark
      }
      if (form.value.id) {
        await editParts(payload)
      } else {
        await addPartsBatch(
          materialDrafts.value.map((row) => ({
            ...payload,
            ...row,
            ...(!isBatch.value ? { unitId: source.unitId } : {}),
            unit:
              units.value.find((unit) => unit.id === (isBatch.value ? row.unitId : source.unitId))
                ?.unitName || row.unit
          }))
        )
      }
      emit('success', form.value.id ? 'edit' : 'add')
      return true
    } catch (error) {
      notifyFriendlyError(error, '配件档案保存失败，请检查填写内容后重试')
      return false
    }
  }

  const handleOpen = async (row?: Parts): Promise<void> => {
    activeTab.value = 'basicSection'
    await resetForm()
    const isEdit = !!row?.id
    if (isEdit) {
      replaceReactiveModel(form.value, {
        ...createInitialForm(),
        ...(structuredClone(toRaw(row)) as Parts)
      })
      selectedMaterials.value = row.material ? [row.material] : []
    }

    await dialogRef.value?.handleOpen(row, {
      title: isEdit ? '编辑零部件' : '新增零部件',
      contentMaxHeight: '68vh',
      loading: true,
      loadingText: '正在加载物料分类与计量单位…',
      onOpen: async (_openData, api) => {
        try {
          await loadReferences()
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
