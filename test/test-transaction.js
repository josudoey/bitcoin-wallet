/* eslint-env node, mocha */

const assert = require('assert')
describe('hdnode', function () {
  const seed = 'b95ef9089a4b6e437e875fcca32dad09a1cff3cf01118c315d63c4a86f436f83502aec9b0ab2676fd49c1fc4be3d83c65bca9ea0ff30dc5cdf7146a6c915ff25'

  describe('btc', function () {
    const HDNode = require('../app/hdnode')('test', 'btc')
    const Transaction = require('../app/transaction')('test', 'btc')
    const node = HDNode.fromSeed(seed)
    it('estimate', async function () {
      const feePerKb = 10000

      const result = Transaction.estimate([
        {
          hash: '16ec683e1abe4168555b42cd4d0fc06268054267ffe73659075b8b938db14d6f',
          index: 0,
          value: 1000000,
          address: 'mmTZkw5GE8t7LyPwmsB6UDgMCmeVtJMoSd'
        }
      ], [
        {
          value: 200000,
          address: 'mmTZkw5GE8t7LyPwmsB6UDgMCmeVtJMoSd'
        }
      ], feePerKb)

      assert.deepStrictEqual(result, {
        'feePerKb': 10000,
        'size': 229,
        'fee': 2290,
        'inputTotal': 1000000,
        'outputTotal': 200000,
        'available': 800000
      })
    })

    it('build exists change', async function () {
      const tx = Transaction.build(node, [
        {
          hash: '16ec683e1abe4168555b42cd4d0fc06268054267ffe73659075b8b938db14d6f',
          index: 0,
          value: 1000000,
          address: 'mmTZkw5GE8t7LyPwmsB6UDgMCmeVtJMoSd',
          path: 'm/44\'/0\'/0\'/0'
        }
      ], [
        {
          value: 100000,
          address: 'mmTZkw5GE8t7LyPwmsB6UDgMCmeVtJMoSd'
        }
      ], {
        change: 'mmTZkw5GE8t7LyPwmsB6UDgMCmeVtJMoSd',
        fee: 1000
      })
      tx.serialize()
      const available = tx._getUnspentValue()
      assert.deepStrictEqual(available, 1000)
      assert.deepStrictEqual(tx.getFee(), 1000)
      assert.deepStrictEqual(tx._estimateSize(), 201)
      assert.deepStrictEqual(tx.toBuffer().length, 226)
      assert.deepStrictEqual(tx._changeScript.toAddress().toString(), 'mmTZkw5GE8t7LyPwmsB6UDgMCmeVtJMoSd')
      assert(tx.isFullySigned())
      assert.deepStrictEqual(tx.id, '298c604add42132bb41e91b7518551b36fd25413006ec933ea0b4414c8db6323')
    })

    it('build exists dust', async function () {
      const tx = Transaction.build(node, [
        {
          hash: '16ec683e1abe4168555b42cd4d0fc06268054267ffe73659075b8b938db14d6f',
          index: 0,
          value: 1000000,
          address: 'mmTZkw5GE8t7LyPwmsB6UDgMCmeVtJMoSd',
          path: 'm/44\'/0\'/0\'/0'
        }
      ], [
        {
          value: 900000,
          address: 'mmTZkw5GE8t7LyPwmsB6UDgMCmeVtJMoSd'
        }
      ], {

        change: 'mmTZkw5GE8t7LyPwmsB6UDgMCmeVtJMoSd',
        fee: 99900
      })
      tx.serialize()
      const available = tx._getUnspentValue()
      assert.deepStrictEqual(available, 100000)
      assert.deepStrictEqual(tx.getFee(), 100000)
      assert.deepStrictEqual(tx._estimateSize(), 167)
      assert.deepStrictEqual(tx.toBuffer().length, 191)
      assert.deepStrictEqual(tx._changeScript, undefined)
      assert(tx.isFullySigned())
      assert.deepStrictEqual(tx.id, '190a8f8638800b5a89d8b0b746d20c87564f216677b559ce3aab76247196a73d')
    })
  })
})
