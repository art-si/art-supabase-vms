import { normalizeNullableText } from '@/utils/form/normalize'
import { chunk, countBy, groupBy, omit, uniq } from 'lodash-es'
import TreeUtils from '@/utils/tree'
import { fetchAllRangePages } from '@/utils/supabase/pagination'
import { fetchPartUnitOptions } from '@/api/mdm-material-select'
import { useTenantScopeStore } from '@/store/modules/tenant-scope'
import { useUserStore } from '@/store/modules/user'
import { resolveTenantWriteTargetId } from '@/utils/tenant-scope-context'
import { resolvePartImportUnit, type PartImportMaterial } from './parts-import'
import { useSupabase } from '@/hooks/core/useSupabase'
import { withRequestOptions } from '@/api/providers/supabase/query'
import type { ApiFeedbackOptions, ApiRequestOptions } from '@/types/api/request'
import type { QueryResult } from '@/types/api/response'
import { buildSupabaseRpcRange, applyFilters, type FilterSpec } from '@/utils/supabase'
import {
  type InsuranceCompany,
  type InsuranceCompanySearchParams,
  type Supplier,
  type SupplierSearchParams,
  type PartsCategory,
  type PartsCategorySearchParams,
  type Parts,
  type PartsSearchParams
} from './types'

const { supabase, keysToSnakeDeep, responseHandle } = useSupabase()
const categoryTree = new TreeUtils({ parentKey: 'parentId' })

// 保险公司
export async function fetchInsuranceCompanyList(
  params: InsuranceCompanySearchParams,
  options?: ApiRequestOptions
) {
  const { companyName, contactPerson, contactPhone, from = 0, to = 9 } = params
  const filters: FilterSpec[] = [
    { col: 'companyName', op: 'ilike', val: companyName ? `%${companyName}%` : undefined },
    { col: 'contactPerson', op: 'ilike', val: contactPerson ? `%${contactPerson}%` : undefined },
    { col: 'contactPhone', op: 'ilike', val: contactPhone ? `%${contactPhone}%` : undefined }
  ]

  let query = supabase
    .from('mdm_insurance_company')
    .select('*', { count: 'exact' })
    .order('create_time', { ascending: false })
    .range(from, to)

  query = applyFilters(query, filters, { skipEmpty: true, camelToSnake: true })
  return await responseHandle(() => withRequestOptions(query, options), {
    showErrorMessage: true
  })
}

export async function exportInsuranceCompanyList(
  params: InsuranceCompanySearchParams & { ids?: string[]; maxRows?: number }
) {
  const { companyName, contactPerson, contactPhone, ids, maxRows = 10000 } = params
  const filters: FilterSpec[] = [
    { col: 'companyName', op: 'ilike', val: companyName ? `%${companyName}%` : undefined },
    { col: 'contactPerson', op: 'ilike', val: contactPerson ? `%${contactPerson}%` : undefined },
    { col: 'contactPhone', op: 'ilike', val: contactPhone ? `%${contactPhone}%` : undefined }
  ]

  let query = supabase
    .from('mdm_insurance_company')
    .select('*')
    .order('create_time', { ascending: false })
    .limit(maxRows)

  if (ids?.length) {
    query = query.in('id', ids)
  } else {
    query = applyFilters(query, filters, { skipEmpty: true, camelToSnake: true })
  }

  return await responseHandle(() => query, {
    showErrorMessage: true
  })
}

export async function addInsuranceCompany(params: InsuranceCompany) {
  return await responseHandle(
    () => supabase.from('mdm_insurance_company').insert(keysToSnakeDeep(params)),
    { showMessage: true, breakReturn: true }
  )
}

export async function editInsuranceCompany(params: InsuranceCompany) {
  const { id, ...data } = params
  return await responseHandle(
    () => supabase.from('mdm_insurance_company').update(keysToSnakeDeep(data)).eq('id', id),
    { showMessage: true, breakReturn: true }
  )
}

export async function deleteInsuranceCompany(id: string) {
  return await responseHandle(
    () => supabase.from('mdm_insurance_company').delete({ count: 'exact' }).eq('id', id),
    {
      showMessage: true,
      showErrorMessage: false,
      breakReturn: true,
      requireAffected: true
    }
  )
}

export async function deleteInsuranceCompanyBatch(ids: string[]) {
  return await responseHandle(
    () => supabase.from('mdm_insurance_company').delete({ count: 'exact' }).in('id', ids),
    {
      showMessage: true,
      showErrorMessage: false,
      breakReturn: true,
      requireAffected: true
    }
  )
}

export async function importInsuranceCompanies(rows: InsuranceCompany[]) {
  return await responseHandle(
    () =>
      supabase.from('mdm_insurance_company').upsert(keysToSnakeDeep(rows), {
        onConflict: 'company_name'
      }),
    { showMessage: true, breakReturn: true }
  )
}

// 供应厂商
interface SecureSupplierPayload {
  records: Supplier[]
  total: number
  fieldAccess?: Api.Vms.BasicInfo.SupplierFieldAccessMap
}

const createSupplierRpcParams = (
  params: SupplierSearchParams & { ids?: string[]; maxRows?: number },
  purpose: 'list' | 'export' | 'options'
) => {
  const from = Math.max(params.from ?? 0, 0)
  const requestedTo = params.maxRows ? from + Math.max(params.maxRows, 1) - 1 : params.to
  return {
    ...buildSupabaseRpcRange(from, requestedTo ?? 9),
    p_supplier_name: normalizeNullableText(String(params.supplierName ?? '')),
    p_contact_person: normalizeNullableText(String(params.contactPerson ?? '')),
    p_contact_phone: normalizeNullableText(String(params.contactPhone ?? '')),
    p_ids: params.ids?.length ? params.ids : null,
    p_purpose: purpose
  }
}

export async function fetchSupplierList(params: SupplierSearchParams, options?: ApiRequestOptions) {
  const result = await responseHandle<SecureSupplierPayload>(
    () =>
      withRequestOptions(
        supabase.rpc('vms_list_vehicle_suppliers_secure', createSupplierRpcParams(params, 'list')),
        options
      ),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error,
    fieldAccess: result.data?.fieldAccess ?? {}
  }
}

export async function exportSupplierList(
  params: SupplierSearchParams & { ids?: string[]; maxRows?: number }
) {
  const result = await responseHandle<SecureSupplierPayload>(
    () =>
      supabase.rpc(
        'vms_list_vehicle_suppliers_secure',
        createSupplierRpcParams({ ...params, maxRows: params.maxRows ?? 10000 }, 'export')
      ),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error,
    fieldAccess: result.data?.fieldAccess ?? {}
  }
}

export async function addSupplier(params: Supplier) {
  const result = await responseHandle<string>(
    () =>
      supabase.rpc('vms_create_vehicle_supplier_secure', { p_payload: keysToSnakeDeep(params) }),
    { showMessage: true, breakReturn: true }
  )
  return { ...result, data: result.data ? { id: result.data } : null }
}

export async function editSupplier(params: Supplier) {
  const { id, ...data } = params
  if (!id) throw new Error('缺少车辆供应商 ID')
  return await responseHandle<Supplier>(
    () =>
      supabase.rpc('vms_update_vehicle_supplier_secure', {
        p_id: id,
        p_payload: keysToSnakeDeep(data)
      }),
    { showMessage: true, breakReturn: true }
  )
}

export async function deleteSupplier(id: string) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_suppliers_secure', { p_ids: [id] }),
    { showMessage: true, showErrorMessage: false, breakReturn: true, requireAffected: true }
  )
}

export async function deleteSupplierBatch(ids: string[]) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_delete_vehicle_suppliers_secure', { p_ids: ids }),
    { showMessage: true, showErrorMessage: false, breakReturn: true, requireAffected: true }
  )
}

export async function importSuppliers(rows: Supplier[]) {
  return await responseHandle<number>(
    () => supabase.rpc('vms_import_vehicle_suppliers_secure', { p_rows: keysToSnakeDeep(rows) }),
    { showMessage: true, breakReturn: true }
  )
}

// 零部件类别
export async function fetchPartsCategoryList(
  params: PartsCategorySearchParams,
  options?: ApiRequestOptions
) {
  const { parentId, categoryName, categoryCode, status, from = 0, to = 9 } = params
  const filters: FilterSpec[] = [
    { col: 'categoryName', op: 'ilike', val: categoryName ? `%${categoryName}%` : undefined },
    { col: 'categoryCode', op: 'ilike', val: categoryCode ? `%${categoryCode}%` : undefined },
    { col: 'status', op: 'eq', val: status }
  ]

  let query = supabase
    .from('mdm_part_category')
    .select('*', { count: 'exact' })
    .order('sort', { ascending: true })
    .order('create_time', { ascending: false })
    .range(from, to)

  query =
    parentId === null || parentId === undefined || parentId === ''
      ? query.is('parent_id', null)
      : query.eq('parent_id', parentId)
  query = applyFilters(query, filters, { skipEmpty: true, camelToSnake: true })

  return await responseHandle(() => withRequestOptions(query, options), {
    showErrorMessage: true
  })
}

export async function fetchPartsCategoryTree(
  params: Partial<Pick<PartsCategory, 'categoryName' | 'tenantId'>> = {},
  options?: ApiRequestOptions & ApiFeedbackOptions
): Promise<QueryResult<PartsCategory[]>> {
  const result = await fetchAllRangePages<PartsCategory>(async ({ from, to }) => {
    let query = supabase
      .from('mdm_part_category')
      .select('*')
      .order('sort', { ascending: true })
      .order('create_time', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to)
    if (params.categoryName) {
      query = query.ilike('category_name', `%${params.categoryName}%`)
    }
    if (params.tenantId) query = query.eq('tenant_id', params.tenantId)
    return responseHandle<PartsCategory[]>(() => withRequestOptions(query, options), {
      showErrorMessage: options?.showErrorMessage ?? true
    })
  })
  return {
    ...result,
    data: result.data
      ? categoryTree.listToTree(result.data.filter((item) => Boolean(item.id)))
      : null
  }
}

export async function exportPartsCategoryList(
  params: PartsCategorySearchParams & { ids?: string[]; maxRows?: number }
) {
  const { parentId, categoryName, categoryCode, status, ids, maxRows = 10000 } = params
  const filters: FilterSpec[] = [
    { col: 'categoryName', op: 'ilike', val: categoryName ? `%${categoryName}%` : undefined },
    { col: 'categoryCode', op: 'ilike', val: categoryCode ? `%${categoryCode}%` : undefined },
    { col: 'status', op: 'eq', val: status }
  ]

  let query = supabase
    .from('mdm_part_category')
    .select('*')
    .order('sort', { ascending: true })
    .order('create_time', { ascending: false })
    .limit(maxRows)

  if (ids?.length) {
    query = query.in('id', ids)
  } else {
    query =
      parentId === null || parentId === undefined || parentId === ''
        ? query.is('parent_id', null)
        : query.eq('parent_id', parentId)
    query = applyFilters(query, filters, { skipEmpty: true, camelToSnake: true })
  }

  return await responseHandle(() => query, {
    showErrorMessage: true
  })
}

export async function addPartsCategory(params: PartsCategory) {
  return await responseHandle(
    () => supabase.from('mdm_part_category').insert(keysToSnakeDeep(params)),
    { showMessage: true, breakReturn: true }
  )
}

export async function editPartsCategory(params: PartsCategory) {
  const { id, ...data } = params
  return await responseHandle(
    () =>
      supabase
        .from('mdm_part_category')
        .update(keysToSnakeDeep(data), { count: 'exact' })
        .eq('id', id),
    { showMessage: true, breakReturn: true, requireAffected: true }
  )
}

export async function deletePartsCategory(id: string) {
  return await responseHandle(
    () => supabase.from('mdm_part_category').delete({ count: 'exact' }).eq('id', id),
    { showMessage: true, showErrorMessage: false, breakReturn: true, requireAffected: true }
  )
}

export async function deletePartsCategoryBatch(ids: string[]) {
  return await responseHandle(
    () => supabase.from('mdm_part_category').delete({ count: 'exact' }).in('id', ids),
    { showMessage: true, showErrorMessage: false, breakReturn: true, requireAffected: true }
  )
}

export async function importPartsCategories(rows: PartsCategory[]) {
  const selectedTenantId = useTenantScopeStore().effectiveTenantId
  const userStore = useUserStore()
  const resolvedRows = rows.map((row, index) => {
    let tenantId: string
    try {
      tenantId = resolveTenantWriteTargetId({
        explicitTenantId: row.tenantId,
        effectiveTenantId: selectedTenantId,
        actorTenantId: userStore.getUserInfo.tenantId,
        canWriteToOtherTenant: userStore.isPlatformSuper
      })
    } catch (error) {
      throw new Error(
        `第 ${index + 1} 行${error instanceof Error ? error.message : '目标租户无效'}`,
        {
          cause: error
        }
      )
    }
    return { ...row, tenantId }
  })
  if (uniq(resolvedRows.map((row) => row.tenantId)).length > 1) {
    throw new Error('一次只能导入同一租户的零部件类别，请按租户拆分文件后重试')
  }
  return await responseHandle(
    () =>
      supabase.from('mdm_part_category').upsert(keysToSnakeDeep(resolvedRows), {
        onConflict: 'category_code'
      }),
    { showMessage: true, breakReturn: true }
  )
}

// 零部件
const getPartsSearchFilters = (params: PartsSearchParams): FilterSpec[] => [
  { col: 'partName', op: 'ilike', val: params.partName ? `%${params.partName}%` : undefined },
  { col: 'partCode', op: 'ilike', val: params.partCode ? `%${params.partCode}%` : undefined },
  ...(!params.categoryIds?.length
    ? [{ col: 'categoryId', op: 'eq' as const, val: params.categoryId }]
    : []),
  { col: 'brand', op: 'ilike', val: params.brand ? `%${params.brand}%` : undefined },
  { col: 'model', op: 'ilike', val: params.model ? `%${params.model}%` : undefined },
  { col: 'supplierId', op: 'eq', val: params.supplierId },
  { col: 'status', op: 'eq', val: params.status }
]

const PARTS_SELECT = `
  *,
  material:mdm_material!mdm_part_material_tenant_fkey(id,material_code,material_name),
  unitRef:mdm_unit_of_measure!mdm_part_unit_tenant_fkey(id,unit_code,unit_name),
  category:mdm_part_category!vehicle_parts_category_id_fkey(
    id,
    category_name
  )
`

const enrichPartsWithSupplierNames = async (
  records: Parts[],
  options?: ApiRequestOptions
): Promise<Parts[]> => {
  const supplierIds = uniq(
    records
      .map((row) => row.supplierId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
  )
  if (!supplierIds.length) return records
  const { data } = await fetchSupplierOptions({ ids: supplierIds }, options)
  const suppliers = new Map<string, Supplier>(
    (data ?? []).flatMap((row) => (row.id ? ([[row.id, row]] as const) : []))
  )
  return records.map((row) => ({
    ...row,
    supplier: row.supplierId ? (suppliers.get(row.supplierId) ?? null) : null
  }))
}

export async function fetchPartsList(params: PartsSearchParams, options?: ApiRequestOptions) {
  const { from = 0, to = 9 } = params
  const filters = getPartsSearchFilters(params)

  let query = supabase
    .from('mdm_part')
    .select(PARTS_SELECT, { count: 'exact' })
    .order('create_time', { ascending: false })
    .range(from, to)

  query = applyFilters(query, filters, { skipEmpty: true, camelToSnake: true })
  if (params.categoryIds?.length) query = query.in('category_id', params.categoryIds)
  const result = await responseHandle<Parts[]>(() => withRequestOptions(query, options), {
    showErrorMessage: true
  })
  return { ...result, data: await enrichPartsWithSupplierNames(result.data ?? [], options) }
}

export async function exportPartsList(
  params: PartsSearchParams & { ids?: string[]; maxRows?: number }
) {
  const { ids, maxRows = 10000 } = params
  const filters = getPartsSearchFilters(params)

  let query = supabase
    .from('mdm_part')
    .select(PARTS_SELECT)
    .order('create_time', { ascending: false })
    .limit(maxRows)

  if (ids?.length) {
    query = query.in('id', ids)
  } else {
    query = applyFilters(query, filters, { skipEmpty: true, camelToSnake: true })
    if (params.categoryIds?.length) query = query.in('category_id', params.categoryIds)
  }

  const result = await responseHandle<Parts[]>(() => query, {
    showErrorMessage: true
  })
  return { ...result, data: await enrichPartsWithSupplierNames(result.data ?? []) }
}

export async function addParts(params: Parts) {
  return await responseHandle(() => supabase.from('mdm_part').insert(keysToSnakeDeep(params)), {
    showMessage: true,
    breakReturn: true
  })
}

export async function addPartsBatch(rows: Parts[]) {
  if (!rows.length) throw new Error('请至少选择一个物料')
  return await responseHandle(() => supabase.from('mdm_part').insert(keysToSnakeDeep(rows)), {
    showMessage: true,
    breakReturn: true
  })
}

export async function editParts(params: Parts) {
  const { id, ...data } = params
  return await responseHandle(
    () => supabase.from('mdm_part').update(keysToSnakeDeep(data)).eq('id', id),
    { showMessage: true, breakReturn: true }
  )
}

export async function deleteParts(id: string) {
  return await responseHandle(
    () => supabase.from('mdm_part').delete({ count: 'exact' }).eq('id', id),
    {
      showMessage: true,
      showErrorMessage: false,
      breakReturn: true,
      requireAffected: true
    }
  )
}

export async function deletePartsBatch(ids: string[]) {
  return await responseHandle(
    () => supabase.from('mdm_part').delete({ count: 'exact' }).in('id', ids),
    {
      showMessage: true,
      showErrorMessage: false,
      breakReturn: true,
      requireAffected: true
    }
  )
}

export async function importParts(rows: Parts[]) {
  const selectedTenantId = useTenantScopeStore().effectiveTenantId
  const userStore = useUserStore()
  const indexedRows = rows.map((row, index) => {
    let tenantId: string
    try {
      tenantId = resolveTenantWriteTargetId({
        explicitTenantId: row.tenantId,
        effectiveTenantId: selectedTenantId,
        actorTenantId: userStore.getUserInfo.tenantId,
        canWriteToOtherTenant: userStore.isPlatformSuper
      })
    } catch (error) {
      throw new Error(
        `第 ${index + 1} 行${error instanceof Error ? error.message : '目标租户无效'}`,
        {
          cause: error
        }
      )
    }
    return { row, index, tenantId }
  })
  if (uniq(indexedRows.map(({ tenantId }) => tenantId)).length > 1) {
    throw new Error('一次只能导入同一租户的零部件，请按租户拆分文件后重试')
  }
  const resolvedRows: Parts[] = []
  for (const [tenantId, group] of Object.entries(groupBy(indexedRows, 'tenantId'))) {
    const codeCounts = countBy(group, ({ row }) => String(row.partCode ?? '').trim())
    const invalid = group.find(({ row }) => {
      const code = String(row.partCode ?? '').trim()
      return !code || codeCounts[code] > 1
    })
    if (invalid) {
      throw new Error(`第 ${invalid.index + 1} 行物料编码为空或重复，请检查文件`)
    }
    const codes = uniq(group.map(({ row }) => String(row.partCode).trim()))
    const materialBatches: PartImportMaterial[][] = []
    for (const codeBatch of chunk(codes, 100)) {
      const result = await responseHandle<PartImportMaterial[]>(
        () =>
          supabase
            .from('mdm_material')
            .select('id,tenant_id,material_code,material_name,base_unit_id,status')
            .eq('tenant_id', tenantId)
            .eq('status', 'enabled')
            .in('material_code', codeBatch),
        {
          breakReturn: true,
          showErrorMessage: false,
          errorMessage: '物料编码核对失败，请重试'
        }
      )
      materialBatches.push(result.data ?? [])
    }
    const materialByCode = new Map(
      materialBatches.flat().map((material) => [material.materialCode, material])
    )
    const units = await fetchPartUnitOptions(tenantId)
    for (const { row, index } of group) {
      const material = materialByCode.get(String(row.partCode ?? '').trim())
      if (!material) {
        throw new Error(`第 ${index + 1} 行物料编码未在当前租户的 MDM 主数据中找到`)
      }
      const unit = resolvePartImportUnit(row, material, units)
      if (!unit) {
        throw new Error(`第 ${index + 1} 行计量单位未在当前租户的 MDM 主数据中找到`)
      }
      resolvedRows.push({
        ...omit(row, ['category', 'material', 'unitRef', 'supplier']),
        tenantId,
        materialId: material.id,
        unitId: unit.id,
        partName: material.materialName,
        partCode: material.materialCode,
        unit: unit.unitName
      })
    }
  }
  return await responseHandle(
    () =>
      supabase.from('mdm_part').upsert(keysToSnakeDeep(resolvedRows), {
        onConflict: 'tenant_id,part_code'
      }),
    { showMessage: true, breakReturn: true }
  )
}

export async function fetchSupplierOptions(
  params?: { ids?: string[]; supplierName?: string; tenantId?: string },
  options?: ApiRequestOptions
) {
  const result = await responseHandle<SecureSupplierPayload>(
    () =>
      withRequestOptions(
        params?.tenantId
          ? supabase.rpc('vms_list_vehicle_supplier_options_for_tenant_secure', {
              p_tenant_id: params.tenantId,
              p_ids: params.ids?.length ? params.ids : null,
              p_supplier_name: normalizeNullableText(String(params.supplierName ?? ''))
            })
          : supabase.rpc(
              'vms_list_vehicle_suppliers_secure',
              createSupplierRpcParams({ ...params, from: 0, to: 9999 }, 'options')
            ),
        options
      ),
    { showErrorMessage: true }
  )
  return {
    data: result.data?.records ?? [],
    total: result.data?.total ?? 0,
    error: result.error
  }
}
