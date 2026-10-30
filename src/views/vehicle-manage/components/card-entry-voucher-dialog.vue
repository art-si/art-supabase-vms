<template>
  <ArtDialog ref="dialogRef" size="md">
    <template #subtitle>为已有流水补充现场图片；金额和余额不会改变。</template>
    <ElAlert
      type="info"
      :closable="false"
      show-icon
      :title="`${entry?.cardNo || '当前卡'} · 已有 ${entry?.voucherPaths.length || 0} 张，最多 5 张`"
      :description="entry?.referenceNo ? `业务凭证号：${entry.referenceNo}` : undefined"
    />
    <div class="mt-5">
      <span class="mb-2 block text-sm font-medium">补传图片</span>
      <ArtUploadImage
        v-model="voucherUrls"
        :resource-tenant-id="entry?.tenantId || ''"
        title="现场凭证"
        :size="88"
        multiple
        :limit="remainingSlots"
        :file-size="8 * 1024 * 1024"
        file-type="image/png,image/jpeg,image/webp"
        :upload-request="uploadVoucher"
        :show-resource-picker="false"
      />
      <p class="mt-2 text-xs text-[var(--el-text-color-secondary)]">
        支持 PNG、JPG、WebP，单张不超过 8 MB。提交后只追加图片，原凭证保留。
      </p>
    </div>
  </ArtDialog>
</template>

<script setup lang="ts">
  import { ElAlert } from 'element-plus'
  import ArtDialog from '@/components/core/dialogs/art-dialog/index.vue'
  import type { ArtDialogExpose } from '@/components/core/dialogs/art-dialog/types'
  import ArtUploadImage from '@/components/core/forms/art-upload-image/index.vue'
  import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
  import {
    privateAttachmentPathFromSignedUrl,
    uploadPrivateAttachment
  } from '@/utils/supabase/private-attachment'
  import { appendFuelCardEntryVouchers } from '@/api/fuel-card'
  import { appendElectricCardEntryVouchers } from '@/api/electric-card'

  defineOptions({ name: 'VmsCardEntryVoucherDialog' })

  type CardKind = 'fuel' | 'electric'
  interface CardEntry {
    id: string
    tenantId: string
    cardNo: string
    referenceNo?: string | null
    voucherPaths: string[]
  }

  const props = defineProps<{ kind: CardKind }>()
  const emit = defineEmits<{ success: [] }>()
  const dialogRef = ref<ArtDialogExpose<void>>()
  const entry = ref<CardEntry>()
  const voucherUrls = ref<string[]>([])
  const bucket = computed(() =>
    props.kind === 'fuel' ? 'vms-fuel-card-private' : 'vms-electric-card-private'
  )
  const remainingSlots = computed(() => Math.max(1, 5 - (entry.value?.voucherPaths.length || 0)))
  const uploadVoucher = (file: File) =>
    uploadPrivateAttachment(file, {
      bucket: bucket.value,
      tenantId: entry.value?.tenantId || '',
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
      maxBytes: 8 * 1024 * 1024
    })

  async function handleConfirm(): Promise<boolean> {
    if (!entry.value || !voucherUrls.value.length) {
      notifyFriendlyError(new Error('请先上传至少一张现场凭证'), '请先上传至少一张现场凭证')
      return false
    }
    try {
      const paths = voucherUrls.value.map((url) =>
        privateAttachmentPathFromSignedUrl(url, bucket.value)
      )
      if (props.kind === 'fuel') await appendFuelCardEntryVouchers(entry.value.id, paths)
      else await appendElectricCardEntryVouchers(entry.value.id, paths)
      emit('success')
      return true
    } catch (error) {
      notifyFriendlyError(error, '现场凭证补传失败，请核对图片后重试')
      return false
    }
  }

  async function handleOpen(selected: CardEntry): Promise<void> {
    entry.value = selected
    voucherUrls.value = []
    await dialogRef.value?.handleOpen(undefined, {
      title: '补传现场凭证',
      confirmText: '保存凭证',
      onConfirm: handleConfirm
    })
  }

  defineExpose({ handleOpen })
</script>
