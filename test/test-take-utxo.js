/* eslint-env node, mocha */

const assert = require('assert')
describe('take-utxo', function () {
  const take = require('../app/take-utxo')
  it('base', async function () {
    const utxos = [
      { 'address': 'fake-address', 'hash': 'fake-hash', 'value': 10000, 'index': 1 },
      { 'address': 'fake-address', 'hash': 'fake-hash', 'value': 20000, 'index': 2 },
      { 'address': 'fake-address', 'hash': 'fake-hash', 'value': 30000, 'index': 3 }
    ]

    const outputs = [
      { value: 50000 },
      { value: 1000 }
    ]

    const result = await take(utxos, outputs)
    assert.deepStrictEqual(result, {
      'inputs': [
        { 'address': 'fake-address', 'hash': 'fake-hash', 'value': 30000, 'index': 3 },
        { 'address': 'fake-address', 'hash': 'fake-hash', 'value': 20000, 'index': 2 },
        { 'address': 'fake-address', 'hash': 'fake-hash', 'value': 10000, 'index': 1 }
      ],
      'inputTotal': 60000,
      'outputTotal': 51000,
      'available': 9000
    })
  })

  it('available', async function () {
    const utxos = [
      { 'address': 'fake-address', 'hash': 'fake-hash', 'value': 10000, 'index': 1 },
      { 'address': 'fake-address', 'hash': 'fake-hash', 'value': 20000, 'index': 2 },
      { 'address': 'fake-address', 'hash': 'fake-hash', 'value': 30000, 'index': 3 }
    ]

    const outputs = [
      { value: 1000 }
    ]

    const result = await take(utxos, outputs, {
      available: 50000
    })
    assert.deepStrictEqual(result, {
      'inputs': [
        { 'address': 'fake-address', 'hash': 'fake-hash', 'value': 30000, 'index': 3 },
        { 'address': 'fake-address', 'hash': 'fake-hash', 'value': 20000, 'index': 2 },
        { 'address': 'fake-address', 'hash': 'fake-hash', 'value': 10000, 'index': 1 }
      ],
      'inputTotal': 60000,
      'outputTotal': 1000,
      'available': 59000

    })
  })
})
