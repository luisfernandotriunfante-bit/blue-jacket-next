import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAudit, buildAiAuditJson } from '../../src/domain/audit'
import { sampleUploadedFiles } from '../../fixtures/domain/uploadedFiles'

test('buildAudit: marca como ok só as areas com arquivo recebido', () => {
  const audit = buildAudit(sampleUploadedFiles)
  const byArea = new Map(audit.map(item => [item.area, item]))
  assert.equal(byArea.get('produtos')?.level, 'ok')
  assert.equal(byArea.get('clientes')?.level, 'ok')
  assert.equal(byArea.get('diario')?.level, 'action')
  assert.equal(audit.length, 6)
})

test('buildAudit: conta mais de um arquivo na mesma area no plural', () => {
  const audit = buildAudit(sampleUploadedFiles)
  const clientes = audit.find(item => item.area === 'clientes')
  assert.match(clientes!.detail, /2 arquivos foram enviados/)
})

test('buildAiAuditJson: lista apenas pendencias e nao inventa contexto tecnico', () => {
  const audit = buildAudit(sampleUploadedFiles)
  const json = buildAiAuditJson(sampleUploadedFiles, audit)
  assert.equal(json.files_received.length, sampleUploadedFiles.length)
  const pendingAreas = json.pending_or_attention.map(item => item.area)
  assert.ok(!pendingAreas.includes('Produtos'))
  assert.ok(json.pending_or_attention.length > 0)
  for (const item of json.pending_or_attention) {
    assert.match(item.technical_context_for_ai, /Não inventar dados/)
  }
})
