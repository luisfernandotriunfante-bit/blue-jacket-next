import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyCommercialLine, resolveCommercialLine, classifyProduct } from '../../src/domain/productGrouping'
import type { CanonicalProduct } from '../../src/domain/productMotor'

test('classifyCommercialLine: reconhece creme dental pela subcategoria em ingles', () => {
  assert.equal(classifyCommercialLine('Qualquer', undefined, 'Toothpaste'), 'Creme Dental')
})

test('classifyCommercialLine: sem pista nenhuma retorna null', () => {
  assert.equal(classifyCommercialLine('Item sem padrao conhecido', undefined, undefined), null)
})

test('resolveCommercialLine: prioriza a familia do agrupamento sobre a descricao', () => {
  const line = resolveCommercialLine({ groupFamily: 'SHAMPOO', description: 'CD TOTAL 90G' })
  assert.equal(line, 'Hair')
})

function product(partial: Partial<CanonicalProduct>): CanonicalProduct {
  return { id: 'x', status: 'active', sources: [], ...partial }
}

test('classifyProduct: produto com uma unica regra compativel fica automatico', () => {
  const result = classifyProduct(product({ description: 'AJAX LIMPEZA MULTIUSO 500ML' }))
  assert.equal(result.status, 'automatic')
  assert.equal(result.group?.family, 'LIMPEZA')
})

test('classifyProduct: produto sem nenhuma regra compativel vai para revisao manual', () => {
  const result = classifyProduct(product({ description: 'ITEM NAO CATALOGADO XYZ' }))
  assert.equal(result.status, 'review')
  assert.equal(result.group, undefined)
})
