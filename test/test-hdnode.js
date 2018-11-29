/* eslint-env node, mocha */

const assert = require('assert')
describe('hdnode', function () {
  const seed = 'b95ef9089a4b6e437e875fcca32dad09a1cff3cf01118c315d63c4a86f436f83502aec9b0ab2676fd49c1fc4be3d83c65bca9ea0ff30dc5cdf7146a6c915ff25'

  describe('btc', function () {
    it('fromSeed', async function () {
      const HDNode = require('../app/hdnode')('test', 'btc')
      const node = HDNode.fromSeed(seed)
      const n = node.deriveChild('m/44\'/0\'/0\'/0')
      assert.strictEqual(n.privateKey.toAddress().toString(), 'mmTZkw5GE8t7LyPwmsB6UDgMCmeVtJMoSd')
    })
  })

  describe('bch', function () {
    it('fromSeed', async function () {
      const HDNode = require('../app/hdnode')('test', 'bch')
      const node = HDNode.fromSeed(seed)
      const n = node.deriveChild('m/44\'/0\'/0\'/0')
      assert.strictEqual(n.privateKey.toAddress().toString(), 'mmTZkw5GE8t7LyPwmsB6UDgMCmeVtJMoSd')
    })
  })
})
