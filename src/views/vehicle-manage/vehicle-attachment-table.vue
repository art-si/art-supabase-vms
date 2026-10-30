<template>
  <ArtTable
    :data="attachments"
    :columns="columns"
    :pagination="undefined"
    :show-table-header="false"
    empty-height="160px"
  />
</template>

<script setup lang="tsx">
  import BusinessAttachmentRowActions from '@/components/business/business-attachment-row-actions/index.vue'
  import ArtTable from '@/components/core/tables/art-table/index.vue'
  import { attachmentTableLink } from '@/components/core/media/art-file-viewer/table-link'
  import type { ColumnOption } from '@/types'

  type Attachment = Api.Vms.VehicleManage.VehicleAttachment

  const props = withDefaults(
    defineProps<{
      attachments: Attachment[]
      nameLabel?: string
      nameMinWidth?: number
      removable: boolean
    }>(),
    { nameLabel: '附件名称' }
  )
  const emit = defineEmits<{ remove: [row: Attachment] }>()

  const columns = computed<ColumnOption<Attachment>[]>(() => [
    { type: 'globalIndex', label: '序号', width: 56 },
    {
      prop: 'name',
      label: props.nameLabel,
      ...(props.nameMinWidth ? { minWidth: props.nameMinWidth } : {}),
      link: attachmentTableLink
    },
    {
      prop: 'fileType',
      label: '格式类型',
      width: 110,
      dict: { code: 'FILE_EXTENSION_LABEL_MAP', display: 'text' }
    },
    { prop: 'fileSize', label: '附件大小', width: 110 },
    {
      prop: 'operation',
      label: '操作',
      width: 144,
      fixed: 'right',
      formatter: (row) => (
        <BusinessAttachmentRowActions
          file={row}
          removable={props.removable}
          removeLabel="删除附件"
          onRemove={() => emit('remove', row)}
        />
      )
    }
  ])
</script>
