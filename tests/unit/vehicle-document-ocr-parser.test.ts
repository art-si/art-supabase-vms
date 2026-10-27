import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createWorker } from 'tesseract.js'
import { parseLocalVehicleDocumentOcr } from '../../src/api/modules/vehicle-document-ocr-parser'

test('local vehicle OCR maps only labeled, valid document fields', () => {
  const result = parseLocalVehicleDocumentOcr(
    [
      '号牌号码：沪A12345 车辆识别代号：L123456789ABCDEFG',
      '发动机号码：AB123456',
      '所有人：示例物流有限公司',
      '注册日期：2026年10月21日 发证日期：2026年10月22日'
    ].join('\n'),
    'driving_license',
    0.91
  )
  assert.equal(result.document.plateNo, '沪A12345')
  assert.equal(result.document.vin, 'L123456789ABCDEFG')
  assert.equal(result.document.engineNo, 'AB123456')
  assert.equal(result.document.ownerName, '示例物流有限公司')
  assert.equal(result.document.registerDate, '2026-10-21')
  assert.equal(result.document.issueDate, '2026-10-22')
  assert.equal(result.document.operationCertNo, undefined)
  assert.equal(result.artifactId, undefined)
  const uncertain = parseLocalVehicleDocumentOcr('号牌号码：沪A12345', 'driving_license', 0.2)
  assert.deepEqual(uncertain.document, {})
  assert.match(uncertain.warnings.join('；'), /置信度较低/)
})

test('the saved synthetic watermark image yields raw text without fabricated vehicle fields', async () => {
  const worker = await createWorker('chi_sim', 1, {
    langPath: fileURLToPath(new URL('../../../../public/ocr/driver/langs/', import.meta.url)),
    cacheMethod: 'none'
  })
  try {
    const fixture = fileURLToPath(
      new URL('../fixtures/vehicle-license-watermark.png', import.meta.url)
    )
    const { data } = await worker.recognize(fixture)
    const rawText = data.text.trim()
    const result = parseLocalVehicleDocumentOcr(rawText, 'driving_license', data.confidence / 100)
    assert.ok(rawText.length > 10)
    assert.match(rawText, /测试|QA-ONLY/)
    assert.deepEqual(Object.values(result.document).filter(Boolean), [])
    assert.match(result.summary, /没有可靠匹配/)
    assert.equal(result.artifactId, undefined)
  } finally {
    await worker.terminate()
  }
})
