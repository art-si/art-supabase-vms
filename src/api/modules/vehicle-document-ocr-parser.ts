import type { VehicleDocumentOcrResult, VehicleDocumentOcrType } from './vehicle-document-ocr'

const labels = [
  '车辆识别代号',
  '车辆识别代码',
  '道路运输证号',
  '号牌号码',
  '发动机号码',
  '发动机号',
  '品牌型号',
  '厂牌型号',
  '车辆类型',
  '所有人',
  '注册日期',
  '登记日期',
  '发证日期',
  '营运证号',
  '经营范围',
  '车牌号',
  '车架号'
]
const fieldBoundary = new RegExp(`(?:${labels.join('|')}):`)
const datePattern = /\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?/g

function normalizedLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/\s+/g, '')
        .replace(/[：﹕]/g, ':')
        .trim()
    )
    .filter(Boolean)
}

function labeledValue(lines: string[], ...candidates: string[]): string | null {
  for (const candidate of candidates) {
    const marker = `${candidate}:`
    const line = lines.find((item) => item.includes(marker))
    if (!line) continue
    const after = line.slice(line.indexOf(marker) + marker.length)
    const boundary = after.search(fieldBoundary)
    const value = (boundary < 0 ? after : after.slice(0, boundary))
      .replace(/^[：:，,。.-]+|[：:，,。.-]+$/g, '')
      .trim()
    if (value) return value
  }
  return null
}

function normalizedDate(value: string | null): string | null {
  const source = value?.match(datePattern)?.[0]
  const parts = source?.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/)
  if (!parts) return null
  const date = `${parts[1]}-${parts[2].padStart(2, '0')}-${parts[3].padStart(2, '0')}`
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null
}

function labeledText(lines: string[], maxLength: number, ...candidates: string[]): string | null {
  const value = labeledValue(lines, ...candidates)
  return value && value.length <= maxLength ? value : null
}

/** Extract only label-bound fields. Unlabeled OCR text stays in rawText for human review. */
export function parseLocalVehicleDocumentOcr(
  rawText: string,
  documentType: VehicleDocumentOcrType,
  confidence: number
): VehicleDocumentOcrResult {
  const lines = normalizedLines(rawText)
  const document: VehicleDocumentOcrResult['document'] = {}
  const plate = labeledValue(lines, '号牌号码', '车牌号')?.toUpperCase()
  document.plateNo = plate && /^[\u4e00-\u9fff][A-Z][A-Z0-9]{5,6}$/.test(plate) ? plate : null
  const vin = labeledValue(lines, '车辆识别代号', '车辆识别代码', '车架号')?.toUpperCase()
  document.vin = vin && /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : null
  const engine = labeledValue(lines, '发动机号码', '发动机号')?.toUpperCase()
  document.engineNo = engine && /^[A-Z0-9-]{5,30}$/.test(engine) ? engine : null
  document.vehicleType = labeledText(lines, 80, '车辆类型')
  document.brandModel = labeledText(lines, 100, '品牌型号', '厂牌型号')
  document.ownerName = labeledText(lines, 100, '所有人')
  document.registerDate = normalizedDate(labeledValue(lines, '注册日期', '登记日期'))
  document.issueDate = normalizedDate(labeledValue(lines, '发证日期'))
  if (documentType === 'operation_license') {
    const permit = labeledValue(lines, '道路运输证号', '营运证号')?.toUpperCase()
    document.operationCertNo =
      permit && /^[\u4e00-\u9fffA-Z0-9-]{5,40}$/.test(permit) ? permit : null
    document.operationType = labeledText(lines, 160, '经营范围')
  }
  const reliableDocument = confidence >= 0.55 ? document : {}
  const count = Object.values(reliableDocument).filter(
    (value) => typeof value === 'string' && value
  ).length
  return {
    rawText,
    summary: count
      ? `本地识别提取了 ${count} 项候选内容，请对照原件逐项核对。`
      : '已读取图片文字，但没有可靠匹配到车辆证照字段。',
    confidence,
    fieldConfidence: {},
    missingFields: [],
    warnings: [
      '本地识别不验证证件真伪或认证状态，请对照原件人工核对',
      ...(confidence < 0.55 ? ['整体识别置信度较低，不生成自动填入候选'] : []),
      ...(count ? [] : ['当前图片无可自动填入字段；原始文字供人工查看。'])
    ],
    document: reliableDocument
  }
}
