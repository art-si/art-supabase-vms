import { useSupabase } from '@/hooks/core/useSupabase'
import { normalizeSupabaseFunctionError } from '@/utils/supabase'
import { TENANT_SCOPE_HEADER } from '@/utils/tenant-scope-context'
import {
  isPrivateAttachmentPath,
  privateAttachmentPathFromSignedUrl
} from '@/utils/supabase/private-attachment'
import { recognizeImageTextLocally } from '@/utils/ocr/local-image-ocr'
import { parseLocalVehicleDocumentOcr } from './vehicle-document-ocr-parser'

export type VehicleDocumentOcrType = 'driving_license' | 'operation_license'

export interface VehicleDocumentOcrResult {
  rawText: string
  summary: string
  confidence: number
  fieldConfidence: Record<string, number>
  missingFields: string[]
  warnings: string[]
  document: Partial<
    Record<
      | 'plateNo'
      | 'vin'
      | 'engineNo'
      | 'vehicleType'
      | 'brandModel'
      | 'ownerName'
      | 'registerDate'
      | 'issueDate'
      | 'operationCertNo'
      | 'operationType',
      string | null
    >
  >
  artifactId?: string
}

const { supabase } = useSupabase()

export async function analyzeVehicleDocumentByAi(
  imageUrl: string,
  documentType: VehicleDocumentOcrType,
  tenantId?: string | null,
  vehicleId?: string | null
) {
  const imageInput = imageUrl.includes('/storage/v1/object/sign/vms-vehicle-private/')
    ? privateAttachmentPathFromSignedUrl(imageUrl, 'vms-vehicle-private')
    : imageUrl
  const { data, error } = await supabase.functions.invoke<VehicleDocumentOcrResult>(
    'ai-vms-vehicle-document-ocr',
    {
      body: {
        action: 'analyze',
        imageUrls: [imageInput],
        documentType,
        vehicleId: vehicleId ?? null,
        targetTenantId: tenantId ?? null
      },
      headers: tenantId ? { [TENANT_SCOPE_HEADER]: tenantId } : undefined
    }
  )
  return { data: data ?? null, error: await normalizeSupabaseFunctionError(error) }
}

export async function analyzeVehicleDocumentLocally(
  imageUrl: string,
  documentType: VehicleDocumentOcrType
): Promise<VehicleDocumentOcrResult> {
  const imagePath = imageUrl.includes('/storage/v1/object/sign/vms-vehicle-private/')
    ? privateAttachmentPathFromSignedUrl(imageUrl, 'vms-vehicle-private')
    : imageUrl
  if (!isPrivateAttachmentPath(imagePath) || !/\.(png|jpg|webp)$/i.test(imagePath)) {
    throw new Error('请重新上传私有 JPG、PNG 或 WebP 证照图片后使用本地识别')
  }
  const { data, error } = await supabase.storage
    .from('vms-vehicle-private')
    .createSignedUrl(imagePath, 60)
  if (error) throw error
  if (
    !data?.signedUrl ||
    privateAttachmentPathFromSignedUrl(data.signedUrl, 'vms-vehicle-private') !== imagePath
  ) {
    throw new Error('证照图片预览凭证无效，请重新打开档案')
  }
  const response = await fetch(data.signedUrl, { credentials: 'omit', cache: 'no-store' })
  if (!response.ok) throw new Error('证照图片无法读取，请重新打开档案后重试')
  const image = await response.blob()
  if (image.size > 8 * 1024 * 1024) {
    throw new Error('本地识别图片不能超过 8 MB')
  }
  const result = await recognizeImageTextLocally(image)
  if (!result.text) throw new Error('本地识别未找到文字，请换用清晰照片或手工填写')
  return parseLocalVehicleDocumentOcr(result.text, documentType, result.confidence)
}
