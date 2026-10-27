import {
  isPrivateAttachmentPath,
  privateAttachmentPathFromSignedUrl,
  signPrivateAttachmentPaths,
  uploadPrivateAttachment
} from '@/utils/supabase/private-attachment'

export const VEHICLE_DOCUMENT_BUCKET = 'vms-vehicle-private'
export const TRAILER_DOCUMENT_BUCKET = 'vms-trailer-private'

export function uploadVehiclePrivateDocument(file: File, tenantId: string) {
  return uploadPrivateAttachment(file, {
    bucket: VEHICLE_DOCUMENT_BUCKET,
    tenantId,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
    maxBytes: 15 * 1024 * 1024
  })
}

export function uploadTrailerPrivateImage(file: File, tenantId: string) {
  return uploadPrivateAttachment(file, {
    bucket: TRAILER_DOCUMENT_BUCKET,
    tenantId,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    maxBytes: 8 * 1024 * 1024
  })
}

export function privateDocumentPathForWrite(value: string | null | undefined, bucket: string) {
  if (!value || isPrivateAttachmentPath(value)) return value
  if (value.includes(`/storage/v1/object/sign/${bucket}/`)) {
    return privateAttachmentPathFromSignedUrl(value, bucket)
  }
  // Historical public links remain readable on their original row; DB guards reject new public links.
  return value
}

export async function signVmsPrivateDocuments<T extends object>(
  record: T,
  fields: readonly (keyof T)[],
  bucket: string
): Promise<T> {
  const paths = fields.flatMap((field) => {
    const value = record[field]
    return typeof value === 'string' && isPrivateAttachmentPath(value) ? [value] : []
  })
  if (!paths.length) return record
  const signed = await signPrivateAttachmentPaths(bucket, paths)
  const signedValues: Record<string, string> = {}
  for (const field of fields) {
    const value = record[field]
    if (typeof value === 'string' && isPrivateAttachmentPath(value)) {
      signedValues[String(field)] = signed.get(value) ?? ''
    }
  }
  return { ...record, ...signedValues }
}
