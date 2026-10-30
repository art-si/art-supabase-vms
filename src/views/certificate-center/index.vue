<template>
  <div class="certificate-center-page art-full-height min-w-0 gap-3">
    <BusinessWorkspaceHeader
      eyebrow="COMPLIANCE CONTROL"
      title="证件与到期预警"
      description="统一追踪车辆和司机证件；旧保险、审车台账在缺少新证件时作为只读回退。"
      icon="ri:shield-check-line"
      :metrics="metrics"
    >
      <template #actions><BusinessTableWorkspaceActions :table="tableRef" /></template>
    </BusinessWorkspaceHeader>

    <ArtTableQuery
      v-if="canView"
      :key="subjectContextKey"
      ref="tableRef"
      v-model="search"
      :search-items="searchItems"
      :api-fn="fetchTableData"
      :columns-factory="createColumns"
      :header-actions="headerActions"
      header-actions-placement="workspace"
      :search-bar-props="{ span: 6, labelWidth: 100, showExpand: false }"
      :table-props="{
        rowKey: 'id',
        tableLayout: 'fixed',
        emptyText: '暂无证件记录',
        emptyDescription: '可新增车辆或司机证件，或调整筛选条件后重试。',
        rowClassName: certificateRowClass
      }"
      :on-success="handleTableSuccess"
      focusable
    />
    <ArtEmptyState
      v-else
      title="暂无证件查看权限"
      description="请联系管理员在角色权限中授权证件查看。"
    />
    <CertificateDialog ref="dialogRef" @success="handleSaved" />
  </div>
</template>

<script setup lang="tsx">
  import { computed, reactive, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { ElMessage, ElTag } from 'element-plus'
  import type { ColumnOption } from '@/types'
  import type { SearchFormItem } from '@/components/core/forms/art-search-bar/index.vue'
  import type {
    ArtTableQueryExpose,
    ArtTableQueryHeaderAction,
    ArtTableQueryProps
  } from '@/components/core/tables/art-table-query/index.vue'
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import ArtEmptyState from '@/components/core/feedback/art-empty-state/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import ArtButtonMore, {
    type ButtonMoreItem
  } from '@/components/core/forms/art-button-more/index.vue'
  import BusinessTableRowActions from '@/components/business/business-table-row-actions/index.vue'
  import BusinessWorkspaceHeader, {
    type BusinessWorkspaceMetric
  } from '@/components/business/business-workspace-header/index.vue'
  import BusinessTableWorkspaceActions from '@/components/business/business-table-workspace-actions/index.vue'
  import { buildSupabasePageRange } from '@/utils/supabase/pagination'
  import { notifyFriendlyError, useArtFeedback } from '@/hooks/core/useArtFeedback'
  import type { CertificateRecord, CertificateSearchParams } from '../../types/certificate'
  import {
    fetchCertificateList,
    markCertificateHandled,
    revokeCertificate
  } from '../../api/providers/supabase/vehicle/certificates'
  import {
    CERTIFICATE_STATUS_OPTIONS,
    canMarkCertificateHandled,
    canRenewCertificate,
    certificateRiskCounts,
    certificateStatusLabel,
    certificateStatusTableLabel,
    certificateStatusTone,
    certificateTypeLabel,
    isLegacyCertificateRecord
  } from './modules/certificate-policy'
  import CertificateDialog from './modules/certificate-dialog.vue'

  defineOptions({ name: 'VmsCertificateCenter' })

  type TableParams = CertificateSearchParams & Pick<Api.Common.PaginationParams, 'current' | 'size'>

  const { confirmAction, promptReason } = useArtFeedback()
  const { hasAuth } = useAuth()
  const canView = computed(() => hasAuth('CertificateCenter:View'))
  const route = useRoute()
  const tableRef = ref<ArtTableQueryExpose>()
  const dialogRef = ref<{
    handleOpen: (row?: CertificateRecord, renewal?: boolean) => Promise<void>
  }>()
  const page = reactive<{ rows: CertificateRecord[]; total: number }>({ rows: [], total: 0 })
  const routeSubjectType = (): CertificateSearchParams['subjectType'] =>
    route.query.subjectType === 'vehicle' || route.query.subjectType === 'driver'
      ? route.query.subjectType
      : ''
  const routeSubjectId = (): string =>
    typeof route.query.subjectId === 'string' ? route.query.subjectId : ''
  const search = reactive<CertificateSearchParams>({
    subjectType: routeSubjectType(),
    subjectId: routeSubjectId(),
    status: '',
    keyword: ''
  })
  const subjectContextKey = ref(`${search.subjectType}:${search.subjectId}`)
  watch(
    () => [route.path, route.query.subjectType, route.query.subjectId],
    () => {
      if (route.path !== '/vms/certificate-center') return
      const subjectType = routeSubjectType()
      const subjectId = routeSubjectId()
      const nextContextKey = `${subjectType}:${subjectId}`
      if (subjectContextKey.value === nextContextKey) return

      tableRef.value?.cancelRequest()
      Object.assign(search, { subjectType, subjectId, status: '', keyword: '' })
      page.rows = []
      page.total = 0
      subjectContextKey.value = nextContextKey
    },
    { flush: 'post' }
  )
  const searchItems: SearchFormItem[] = [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      props: { placeholder: '车牌 / 司机 / 证件编号' }
    },
    {
      label: '归属对象',
      key: 'subjectType',
      type: 'select',
      options: [
        { label: '全部', value: '' },
        { label: '车辆', value: 'vehicle' },
        { label: '司机', value: 'driver' }
      ]
    },
    {
      label: '到期状态',
      key: 'status',
      type: 'select',
      options: [
        { label: '全部', value: '' },
        ...CERTIFICATE_STATUS_OPTIONS.map((item) => ({ label: item.label, value: item.value }))
      ]
    }
  ]
  const headerActions: ArtTableQueryHeaderAction[] = [
    { type: 'add', permission: 'CertificateCenter:Add', onClick: () => openDialog() }
  ]

  const counts = computed(() => certificateRiskCounts(page.rows))
  const metrics = computed<BusinessWorkspaceMetric[]>(() => [
    {
      label: '当前筛选',
      value: page.total,
      description: '证件记录与旧台账回退',
      icon: 'ri:file-list-3-line'
    },
    {
      label: '本页需补证',
      value: counts.value.expired + counts.value.revoked,
      description: '当前证件已过期或已作废，需登记新证',
      icon: 'ri:error-warning-line',
      tone: 'danger'
    },
    {
      label: '本页即将到期',
      value: counts.value.dueSoon,
      description: '司机 3 个月内、车辆 30 天内需跟进',
      icon: 'ri:time-line',
      tone: 'warning'
    },
    {
      label: '本页已处理',
      value: counts.value.handled,
      description: '有续证记录与处置人',
      icon: 'ri:checkbox-circle-line',
      tone: 'success'
    }
  ])

  function certificateRowClass({ row }: { row: Record<string, unknown> }): string {
    return row.status === 'expired' ? 'certificate-center-page__expired' : ''
  }

  function createColumns(): ColumnOption<CertificateRecord>[] {
    return [
      { type: 'globalIndex', label: '序号', width: 72 },
      {
        prop: 'subjectLabel',
        label: '车牌 / 司机',
        minWidth: 150,
        formatter: (row) => (
          <span class="font-semibold text-[var(--art-gray-900)]">{row.subjectLabel}</span>
        )
      },
      {
        prop: 'subjectType',
        label: '对象',
        width: 80,
        formatter: (row) => (row.subjectType === 'vehicle' ? '车辆' : '司机')
      },
      {
        prop: 'certificateType',
        label: '证件类型',
        minWidth: 168,
        formatter: (row) => (
          <span class="grid min-w-0 gap-0.5">
            <span>{certificateTypeLabel(row.certificateType)}</span>
            {isLegacyCertificateRecord(row) ? (
              <small class="text-xs text-[var(--el-text-color-secondary)]">旧台账 · 待补录</small>
            ) : row.isCurrent === false ? (
              <small class="text-xs text-[var(--el-text-color-secondary)]">历史记录</small>
            ) : null}
          </span>
        )
      },
      { prop: 'certificateNo', label: '证件编号', minWidth: 170 },
      { prop: 'expiresOn', label: '有效期截止', width: 130, sortable: true },
      {
        prop: 'status',
        label: '风险状态',
        width: 126,
        formatter: (row) => (
          <span
            class="inline-flex"
            title={
              row.status === 'revoked' && row.revokedReason
                ? `作废原因：${row.revokedReason}`
                : certificateStatusLabel(row.status)
            }
          >
            <ElTag type={certificateStatusTone(row.status)} effect="light">
              {certificateStatusTableLabel(row.status)}
            </ElTag>
          </span>
        )
      },
      { prop: 'responsibleName', label: '责任人', minWidth: 120 },
      {
        prop: 'attachments',
        label: '附件',
        width: 86,
        formatter: (row) => `${row.attachments.length} 份`
      },
      {
        prop: 'operation',
        label: '操作',
        width: 142,
        fixed: 'right',
        formatter: (row) => (
          <BusinessTableRowActions>
            {!isLegacyCertificateRecord(row) && row.status !== 'revoked' ? (
              <ArtButtonTable
                type="edit"
                permission="CertificateCenter:Edit"
                onClick={() => openDialog(row)}
              />
            ) : null}
            <ArtButtonMore
              list={rowActions(row)}
              onClick={(item: ButtonMoreItem) => void handleRowAction(String(item.key), row)}
            />
          </BusinessTableRowActions>
        )
      }
    ]
  }

  function rowActions(row: CertificateRecord): ButtonMoreItem[] {
    if (isLegacyCertificateRecord(row)) {
      return [
        {
          key: 'register',
          label: '登记新证件',
          icon: 'ri:file-add-line',
          auth: 'CertificateCenter:Add'
        }
      ]
    }
    return [
      ...(canRenewCertificate(row)
        ? [
            {
              key: 'renew',
              label: '登记续证',
              icon: 'ri:file-add-line',
              auth: 'CertificateCenter:Add'
            }
          ]
        : []),
      ...(canMarkCertificateHandled(row)
        ? [
            {
              key: 'handle',
              label: '标记已处理',
              icon: 'ri:checkbox-circle-line',
              auth: 'CertificateCenter:Handle'
            }
          ]
        : []),
      ...(row.status !== 'revoked' && row.status !== 'handled' && row.isCurrent !== false
        ? [
            {
              key: 'revoke',
              label: '作废证件',
              icon: 'ri:forbid-line',
              auth: 'CertificateCenter:Revoke'
            }
          ]
        : [])
    ]
  }

  async function handleRowAction(key: string, row: CertificateRecord): Promise<void> {
    if (key === 'renew' && !canRenewCertificate(row)) {
      ElMessage.warning('该证件已由新证替代，请查看当前证件后再续证')
      return
    }
    if (key === 'renew' || key === 'register') {
      openDialog(row, true)
      return
    }
    if (key === 'revoke') {
      try {
        const reason = await promptReason(
          `作废后保留“${row.subjectLabel} · ${certificateTypeLabel(row.certificateType)}”的历史记录，停止该证提醒，并阻止使用该证派车；登记有效新证后恢复资格。`,
          '作废证件',
          {
            confirmButtonText: '确认作废',
            placeholder: '请填写证件作废原因',
            emptyMessage: '请填写证件作废原因'
          }
        )
        await revokeCertificate(row.id, reason)
        await tableRef.value?.refreshUpdate()
      } catch (error) {
        if (error !== 'cancel' && error !== 'close') {
          notifyFriendlyError(error, '作废失败，请刷新证件记录后重试')
        }
      }
      return
    }
    if (key !== 'handle') return
    try {
      await confirmAction(
        `确认“${row.subjectLabel} · ${certificateTypeLabel(row.certificateType)}”已完成续证？系统会核对新证件后再闭环。`,
        '核对续证',
        {
          confirmButtonText: '核对并处理',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } catch {
      return
    }
    try {
      await markCertificateHandled(row.id)
      await tableRef.value?.refreshUpdate()
    } catch (error) {
      notifyFriendlyError(error, '处置未完成，请先登记有效的新证件，再重试核对')
    }
  }

  function openDialog(row?: CertificateRecord, renewal = false): void {
    void dialogRef.value?.handleOpen(row, renewal)
  }

  async function handleSaved(): Promise<void> {
    await tableRef.value?.refreshUpdate()
  }

  async function fetchTableData(params: TableParams) {
    const { from, to } = buildSupabasePageRange({ current: params.current, size: params.size })
    return await fetchCertificateList({ ...params, from, to })
  }

  const handleTableSuccess: NonNullable<ArtTableQueryProps['onSuccess']> = (rows, response) => {
    page.rows = rows as CertificateRecord[]
    page.total = response.total ?? rows.length
  }
</script>

<style scoped lang="scss">
  .certificate-center-page {
    :deep(.certificate-center-page__expired td:first-child) {
      box-shadow: inset 3px 0 0 var(--el-color-danger);
    }
  }
</style>
