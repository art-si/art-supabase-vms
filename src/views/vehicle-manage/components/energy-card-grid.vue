<template>
  <div class="energy-card-grid grid gap-3 p-4">
    <article
      v-for="card in cards"
      :key="card.id"
      class="min-w-0 rounded-[var(--el-border-radius-base)] border border-[var(--el-border-color-light)] bg-[var(--el-bg-color)] p-4"
    >
      <div class="flex min-w-0 items-start justify-between gap-3">
        <img
          v-if="imagePreviews[card.imagePath || '']"
          :src="imagePreviews[card.imagePath || '']"
          :alt="`${card.cardNo} 卡面照片`"
          width="56"
          height="56"
          class="h-14 w-14 shrink-0 rounded-[var(--el-border-radius-base)] object-cover"
        />
        <span
          v-else
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--el-border-radius-base)] bg-[var(--el-fill-color-light)] text-[var(--theme-color)]"
          aria-hidden="true"
          ><ArtSvgIcon
            :icon="kind === 'fuel' ? 'ri:bank-card-line' : 'ri:flashlight-line'"
            class="text-2xl"
        /></span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold" :title="card.issuer || defaultIssuer"
            >{{ card.issuer || defaultIssuer }}
            <span class="ml-1 text-xs font-normal text-[var(--el-text-color-secondary)]"
              >记账卡</span
            ></p
          >
          <p class="mt-1 text-xs text-[var(--el-text-color-secondary)]">{{ card.plateNo }}</p>
          <button
            type="button"
            class="mt-1 block max-w-full truncate text-left text-lg font-semibold text-[var(--theme-color)] hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-color)]"
            :title="card.cardNo"
            @click="emit('detail', card.id)"
            >{{ card.cardNo }}</button
          >
        </div>
        <ArtDictDisplay class="shrink-0" dict-code="fuelCardStatus" :value="card.status" />
      </div>
      <div class="mt-4 border-t border-[var(--el-border-color-lighter)] pt-3">
        <span class="text-xs text-[var(--el-text-color-secondary)]">当前余额</span>
        <strong class="mt-1 block text-2xl tabular-nums text-[var(--el-text-color-primary)]">{{
          formatCurrencyValue(card.balance)
        }}</strong>
      </div>
      <div class="mt-3 flex min-w-0 items-end justify-between gap-2 text-sm">
        <div class="min-w-0 text-[var(--el-text-color-secondary)]">
          <p class="truncate" :title="`所属公司：${card.companyName || '未设置'}`"
            >所属公司 {{ card.companyName || '未设置' }}</p
          >
          <p
            class="mt-1 truncate"
            :title="`司机：${card.driverName || '未指定'} ${card.driverPhone || ''}`"
            >司机 {{ card.driverName || '未指定' }} {{ card.driverPhone || '' }}</p
          >
        </div>
        <ElButton v-if="canViewLedger" link type="primary" @click="emit('ledger', card.id)"
          >交易流水</ElButton
        >
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
  import { ElButton } from 'element-plus'
  import ArtDictDisplay from '@/components/core/base/art-dict-display/index.vue'
  import ArtSvgIcon from '@/components/core/base/art-svg-icon/index.vue'
  import { formatCurrencyValue } from '@/utils/ui/format'

  interface EnergyCard {
    id: string
    cardNo: string
    issuer: string
    plateNo: string
    status: string
    balance: number
    imagePath: string | null
    companyName: string | null
    driverName: string | null
    driverPhone: string | null
  }
  const props = defineProps<{
    cards: EnergyCard[]
    imagePreviews: Record<string, string>
    kind: 'fuel' | 'electric'
    canViewLedger: boolean
  }>()
  const emit = defineEmits<{ detail: [cardId: string]; ledger: [cardId: string] }>()
  const defaultIssuer = computed(() => (props.kind === 'fuel' ? '亿油卡' : '亿电卡'))
</script>

<style scoped lang="scss">
  .energy-card-grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
    max-width: 70rem;
  }
</style>
