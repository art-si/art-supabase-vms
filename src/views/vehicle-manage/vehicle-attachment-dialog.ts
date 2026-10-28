import { nextTick, type ComputedRef, type Ref } from 'vue'
import type { FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import type { FormItem } from '@/components/core/forms/art-form/index.vue'
import { notifyFriendlyError } from '@/hooks/core/useArtFeedback'
import { getFileExtension } from '@/utils/file'
import { validateArtFormForSubmit } from '@/utils/form/validate-art-form'

type VehicleAttachment = Api.Vms.VehicleManage.VehicleAttachment

export interface VehicleAttachmentFormData {
  name: string
  file: string
  fileName: string
  url: string
  fileType?: string
  fileSize?: string
}

export interface VehicleAttachmentGroup {
  data: VehicleAttachmentFormData
  items: ComputedRef<FormItem[]>
  rules: ComputedRef<FormRules<VehicleAttachmentFormData>>
}

export interface VehicleFormExpose {
  validate: () => Promise<boolean>
  clearValidate: () => void
}

export interface VehicleAttachmentDialogHandlers {
  resetAttachmentForm: () => Promise<void>
  handleAttachmentFileChange: (resources: Api.DataCenter.Resources.ResourceListItem[]) => void
  handleAttachmentConfirm: () => Promise<boolean>
}

export const createInitialAttachmentForm = (): VehicleAttachmentFormData => ({
  name: '',
  file: '',
  fileName: '',
  url: '',
  fileType: '',
  fileSize: ''
})

/** Shared upload-dialog behavior for the three vehicle record forms. */
export function useVehicleAttachmentDialog(
  form: { data: { attachments?: VehicleAttachment[] | null } },
  attachment: { data: VehicleAttachmentFormData },
  attachmentFormRef: Ref<VehicleFormExpose | undefined>
): VehicleAttachmentDialogHandlers {
  const resetAttachmentForm = async (): Promise<void> => {
    Object.assign(attachment.data, createInitialAttachmentForm())
    await nextTick()
    attachmentFormRef.value?.clearValidate()
  }

  const handleAttachmentFileChange = (
    resources: Api.DataCenter.Resources.ResourceListItem[]
  ): void => {
    const resource = resources[0]
    if (!resource?.url) return

    const fileName = resource.originName || resource.objectName || '附件'
    Object.assign(attachment.data, {
      file: resource.url,
      fileName,
      url: resource.url,
      fileType: getFileExtension(fileName, resource.suffix),
      fileSize: resource.sizeInfo,
      name: attachment.data.name || fileName
    })
    attachmentFormRef.value?.clearValidate()
    ElMessage.success('附件已选择')
  }

  const handleAttachmentConfirm = async (): Promise<boolean> => {
    try {
      if (!(await validateArtFormForSubmit(attachmentFormRef.value))) return false
    } catch (error) {
      notifyFriendlyError(error, '附件校验未完成，请稍后重试', 'warning')
      return false
    }

    if ((form.data.attachments ?? []).some((item) => item.url === attachment.data.url)) {
      ElMessage.info('该附件已在当前记录中')
      return false
    }
    form.data.attachments = [
      ...(form.data.attachments ?? []),
      {
        name: attachment.data.name,
        url: attachment.data.url,
        fileType: attachment.data.fileType,
        fileSize: attachment.data.fileSize
      }
    ]
    return true
  }

  return { resetAttachmentForm, handleAttachmentFileChange, handleAttachmentConfirm }
}
