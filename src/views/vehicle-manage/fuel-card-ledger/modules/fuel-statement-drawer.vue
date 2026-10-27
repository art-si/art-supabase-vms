<template>
  <ArtDrawer ref="drawerRef" size="xl" :show-footer="false">
    <div class="min-w-0 space-y-5">
      <ElAlert
        title="导入加油站账单后，按卡号、时间和站点匹配消费流水；差异只提示核对，不修改油卡余额。"
        type="info"
        :closable="false"
        show-icon
      />

      <div
        class="flex flex-wrap items-end justify-between gap-3 rounded-[var(--el-border-radius-base)] border border-[var(--el-border-color-light)] p-4"
      >
        <div class="min-w-0 flex-1 space-y-1">
          <label
            class="text-xs font-medium text-[var(--el-text-color-secondary)]"
            for="statement-batch"
            >对账批次</label
          >
          <ElSelect
            id="statement-batch"
            v-model="selectedBatchId"
            class="w-full"
            filterable
            placeholder="选择已导入的加油站账单"
            :loading="loadingBatches"
            @change="loadRows"
          >
            <ElOption
              v-for="batch in batches"
              :key="batch.id"
              :label="`${batch.fileName} · ${formatWithDayjs(batch.importedAt)}`"
              :value="batch.id"
            />
          </ElSelect>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span v-auth="'FuelCardLedger:Import'">
            <ArtExcelImport
              accept=".xlsx,.xls,.csv"
              icon="ri:upload-2-line"
              :button-props="{ plain: true, loading: importing }"
              :disabled="importing"
              @import-success="prepareImport"
              @import-error="handleImportError"
            >
              导入加油站账单
            </ArtExcelImport>
          </span>
          <ElButton
            v-auth="'FuelCardLedger:Reconcile'"
            :loading="reconciling"
            :disabled="!selectedBatchId"
            @click="reconcileSelected"
          >
            重新核对
          </ElButton>
        </div>
      </div>

      <ElAlert v-if="loadError" :title="loadError" type="error" :closable="false" show-icon>
        <ElButton link type="primary" @click="reload">重试</ElButton>
      </ElAlert>

      <div v-if="selectedBatch" class="grid gap-3 sm:grid-cols-3">
        <div class="rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-light)] p-4">
          <p class="text-xs text-[var(--el-text-color-secondary)]">已匹配</p>
          <strong class="mt-1 block text-xl tabular-nums">{{ selectedBatch.matched }}</strong>
        </div>
        <div class="rounded-[var(--el-border-radius-base)] bg-[var(--el-color-danger-light-9)] p-4">
          <p class="text-xs text-[var(--el-color-danger)]">金额或明细差异</p>
          <strong class="mt-1 block text-xl tabular-nums text-[var(--el-color-danger)]">{{
            selectedBatch.difference
          }}</strong>
        </div>
        <div
          class="rounded-[var(--el-border-radius-base)] bg-[var(--el-color-warning-light-9)] p-4"
        >
          <p class="text-xs text-[var(--el-color-warning)]">未匹配</p>
          <strong class="mt-1 block text-xl tabular-nums text-[var(--el-color-warning)]">{{
            selectedBatch.unmatched
          }}</strong>
        </div>
      </div>

      <div
        v-if="preparedRows.length"
        class="space-y-3 rounded-[var(--el-border-radius-base)] border border-[var(--el-color-primary-light-5)] bg-[var(--el-color-primary-light-9)] p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="font-semibold">待导入 · {{ preparedFile?.name }}</h3>
            <p class="mt-1 text-xs text-[var(--el-text-color-secondary)]">
              共
              {{ preparedRows.length }}
              行；核对卡号、消费时间、金额、升数和加油站后提交。相同文件再次导入会返回原批次。
            </p>
          </div>
          <div class="flex items-center gap-2">
            <ElButton :disabled="importing" @click="clearPrepared">取消</ElButton>
            <ElButton type="primary" :loading="importing" @click="submitImport">确认导入</ElButton>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[620px] text-left text-xs">
            <thead class="text-[var(--el-text-color-secondary)]">
              <tr>
                <th class="px-2 py-2">行号</th>
                <th class="px-2 py-2">油卡号</th>
                <th class="px-2 py-2">消费时间</th>
                <th class="px-2 py-2">加油站</th>
                <th class="px-2 py-2 text-right">金额</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in preparedRows.slice(0, 5)" :key="row.sourceRow">
                <td class="px-2 py-2 tabular-nums">{{ row.sourceRow }}</td>
                <td class="px-2 py-2">{{ row.cardNo }}</td>
                <td class="px-2 py-2">{{ formatWithDayjs(row.occurredAt) }}</td>
                <td class="px-2 py-2">{{ row.stationName }}</td>
                <td class="px-2 py-2 text-right tabular-nums">{{
                  formatCurrencyValue(row.amount)
                }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="preparedRows.length > 5" class="text-xs text-[var(--el-text-color-secondary)]">
          仅预览前 5 行；提交时导入全部 {{ preparedRows.length }} 行。
        </p>
      </div>

      <div
        v-if="!loadingBatches && !batches.length && !preparedRows.length && !loadError"
        class="rounded-[var(--el-border-radius-base)] border border-dashed border-[var(--el-border-color)] px-6 py-12 text-center"
      >
        <p class="font-medium">暂无加油站对账单</p>
        <p class="mt-2 text-sm text-[var(--el-text-color-secondary)]">
          导入含“油卡号、消费时间、金额、加油升数、加油站”列的 CSV 或 Excel 文件。
        </p>
      </div>

      <div v-if="selectedBatchId" class="min-w-0">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-semibold">对账明细</h3>
            <p class="mt-1 text-xs text-[var(--el-text-color-secondary)]">
              金额差超过 1 元、升数差超过 0.5 升或站点不符标红；未找到消费流水标黄。
            </p>
          </div>
          <span class="text-xs text-[var(--el-text-color-secondary)]">
            原始文件校验码：{{ selectedBatch?.fileSha256.slice(0, 12) }}…
          </span>
        </div>
        <ArtTable
          :data="pagedRows"
          :columns="columns"
          :loading="loadingRows"
          :pagination="false"
          :show-table-header="false"
          border
          stripe
          class="w-full"
          :row-class-name="rowClassName"
          empty-text="该批次暂无对账明细"
        />
        <div v-if="rows.length > pageSize" class="mt-3 flex justify-end">
          <ElPagination
            v-model:current-page="page"
            :page-size="pageSize"
            :total="rows.length"
            layout="prev, pager, next"
          />
        </div>
      </div>
    </div>
  </ArtDrawer>
</template>

<script setup lang="tsx">
  import { ElMessage, ElTag } from 'element-plus'
  import type { ColumnOption } from '@/types'
  import ArtDrawer from '@/components/core/drawers/art-drawer/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import type { ArtDrawerExpose } from '@/components/core/drawers/art-drawer/types'
  import ArtExcelImport from '@/components/core/forms/art-excel-import/index.vue'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import {
    fetchFuelStatementBatches,
    fetchFuelStatementRows,
    importFuelStatement,
    reconcileFuelStatement,
    type FuelStatementBatch,
    type FuelStatementImportRow,
    type FuelStatementRow
  } from '@/api/fuel-card-statement'
  import { formatCurrencyValue } from '@/utils/ui/format'
  import { formatWithDayjs } from '@/utils/time'
  import { parseFuelStatementRows, sha256File } from './fuel-statement-import'

  defineOptions({ name: 'VmsFuelStatementDrawer' })

  const drawerRef = ref<ArtDrawerExpose>()
  const batches = ref<FuelStatementBatch[]>([])
  const rows = ref<FuelStatementRow[]>([])
  const selectedBatchId = ref('')
  const preparedFile = ref<File | null>(null)
  const preparedRows = ref<FuelStatementImportRow[]>([])
  const loadingBatches = ref(false)
  const loadingRows = ref(false)
  const importing = ref(false)
  const reconciling = ref(false)
  const loadError = ref('')
  const page = ref(1)
  const pageSize = 20
  let rowRequest = 0
  const selectedBatch = computed(() =>
    batches.value.find((batch) => batch.id === selectedBatchId.value)
  )
  const pagedRows = computed(() =>
    rows.value.slice((page.value - 1) * pageSize, page.value * pageSize)
  )

  const statusTone = (row: FuelStatementRow): 'success' | 'danger' | 'warning' =>
    row.matchStatus === 'difference'
      ? 'danger'
      : row.matchStatus === 'unmatched' || Number(row.amountDifference) !== 0
        ? 'warning'
        : 'success'
  const statusText = (row: FuelStatementRow): string =>
    row.matchStatus === 'difference'
      ? '有差异'
      : row.matchStatus === 'unmatched'
        ? '未匹配'
        : Number(row.amountDifference) !== 0
          ? '微差'
          : '一致'
  const columns: ColumnOption<FuelStatementRow>[] = [
    { prop: 'sourceRow', label: '行号', width: 72 },
    { prop: 'cardNo', label: '油卡号', minWidth: 165, showOverflowTooltip: true },
    {
      prop: 'occurredAt',
      label: '消费时间',
      width: 166,
      formatter: (row) => formatWithDayjs(row.occurredAt)
    },
    { prop: 'stationName', label: '加油站', minWidth: 150, showOverflowTooltip: true },
    {
      prop: 'amount',
      label: '站点金额',
      width: 112,
      align: 'right',
      formatter: (row) => formatCurrencyValue(row.amount)
    },
    {
      prop: 'ledgerAmount',
      label: '流水金额',
      width: 112,
      align: 'right',
      formatter: (row) => (row.ledgerAmount == null ? '—' : formatCurrencyValue(row.ledgerAmount))
    },
    {
      prop: 'amountDifference',
      label: '差额',
      width: 110,
      align: 'right',
      formatter: (row) =>
        row.amountDifference == null ? (
          '—'
        ) : (
          <strong
            class={[
              'tabular-nums',
              Math.abs(row.amountDifference) > 1 && 'text-[var(--el-color-danger)]'
            ]}
          >
            {formatCurrencyValue(row.amountDifference)}
          </strong>
        )
    },
    {
      prop: 'matchStatus',
      label: '结果',
      width: 108,
      formatter: (row) => (
        <ElTag type={statusTone(row)} size="small">
          {statusText(row)}
        </ElTag>
      )
    }
  ]
  const rowClassName = ({ row }: { row: FuelStatementRow; rowIndex: number }): string =>
    row.matchStatus === 'difference'
      ? 'fuel-statement-difference-row'
      : row.matchStatus === 'unmatched'
        ? 'fuel-statement-unmatched-row'
        : ''

  const clearPrepared = (): void => {
    preparedFile.value = null
    preparedRows.value = []
  }
  const prepareImport = (records: Array<Record<string, unknown>>, file: File): void => {
    try {
      if (file.size > 5_000_000) throw new Error('对账文件不能超过 5 MB，请分批导入。')
      preparedRows.value = parseFuelStatementRows(records)
      preparedFile.value = file
      loadError.value = ''
    } catch (error) {
      clearPrepared()
      notifyFriendlyError(
        error,
        '对账文件解析失败，请检查列名、时间与金额；单次最多 500 行且不超过 5 MB。'
      )
    }
  }
  const handleImportError = (): void => {
    ElMessage.error('对账文件解析失败，请检查 CSV 或 Excel 文件。')
  }
  const loadBatches = async (): Promise<void> => {
    loadingBatches.value = true
    loadError.value = ''
    try {
      batches.value = await fetchFuelStatementBatches()
      if (
        selectedBatchId.value &&
        !batches.value.some((batch) => batch.id === selectedBatchId.value)
      )
        selectedBatchId.value = ''
      if (!selectedBatchId.value) selectedBatchId.value = batches.value[0]?.id ?? ''
      await loadRows()
    } catch {
      loadError.value = '对账批次加载失败，请重试。'
    } finally {
      loadingBatches.value = false
    }
  }
  const loadRows = async (): Promise<void> => {
    const request = ++rowRequest
    page.value = 1
    if (!selectedBatchId.value) {
      rows.value = []
      return
    }
    loadingRows.value = true
    loadError.value = ''
    try {
      const result = await fetchFuelStatementRows(selectedBatchId.value)
      if (request === rowRequest) rows.value = result
    } catch {
      if (request === rowRequest) loadError.value = '对账明细加载失败，请重试。'
    } finally {
      if (request === rowRequest) loadingRows.value = false
    }
  }
  const reload = (): void => {
    if (batches.value.length) void loadRows()
    else void loadBatches()
  }
  const submitImport = async (): Promise<void> => {
    if (!preparedFile.value || !preparedRows.value.length || importing.value) return
    importing.value = true
    try {
      const result = await importFuelStatement({
        fileName: preparedFile.value.name,
        fileSha256: await sha256File(preparedFile.value),
        rows: preparedRows.value
      })
      clearPrepared()
      selectedBatchId.value = result.batchId
      ElMessage.success(
        result.duplicate
          ? '该文件已导入，已打开原对账批次。'
          : `已导入：一致 ${result.matched} 条，差异 ${result.difference} 条，未匹配 ${result.unmatched} 条。`
      )
      await loadBatches()
    } catch {
      ElMessage.error('导入失败，请核对卡号、租户、时间和文件内容后重试。')
    } finally {
      importing.value = false
    }
  }
  const reconcileSelected = async (): Promise<void> => {
    if (!selectedBatchId.value || reconciling.value) return
    reconciling.value = true
    try {
      const result = await reconcileFuelStatement(selectedBatchId.value)
      ElMessage.success(
        `核对完成：一致 ${result.matched} 条，差异 ${result.difference} 条，未匹配 ${result.unmatched} 条。`
      )
      await loadBatches()
    } catch {
      ElMessage.error('重新核对失败，请稍后重试。')
    } finally {
      reconciling.value = false
    }
  }
  const handleOpen = async (): Promise<void> => {
    await drawerRef.value?.handleOpen(undefined, {
      title: '加油站对账',
      subtitle: '导入站点消费账单，核对油卡流水并定位金额差异。',
      headerIcon: 'ri:scales-3-line'
    })
    await loadBatches()
  }
  defineExpose({ handleOpen })
</script>

<style scoped>
  :deep(.fuel-statement-difference-row td.el-table__cell) {
    background-color: var(--el-color-danger-light-9);
  }

  :deep(.fuel-statement-unmatched-row td.el-table__cell) {
    background-color: var(--el-color-warning-light-9);
  }
</style>
