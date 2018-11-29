exports = module.exports = function (env, currency) {
  let Transaction, Script, Address, PublicKeyHash

  if (currency === 'btc') {
    PublicKeyHash = require('bitcore-lib/lib/transaction/input/publickeyhash')
    Address = require('bitcore-lib/lib/address')
    Script = require('bitcore-lib/lib/script')
    Transaction = require('bitcore-lib/lib/transaction')
  }

  if (currency === 'bch') {
    PublicKeyHash = require('bitcore-lib-cash/lib/transaction/input/publickeyhash')
    Address = require('bitcore-lib-cash/lib/address')
    Script = require('bitcore-lib-cash/lib/script')
    Transaction = require('bitcore-lib-cash/lib/transaction')
  }

  if (!Transaction) {
    throw new Error('currency not support')
  }

  const network = require('./network')(env, currency)

  return Object.assign(Transaction, {
    estimate: function (inputs, outputs, feePerKb) {
      const transaction = new Transaction()
      for (const output of outputs) {
        transaction.to(
          Address.fromString(output.address, network)
          , output.value)
      }

      for (const input of inputs) {
        const address = Address.fromString(input.address, network)
        transaction.addInput(new PublicKeyHash({
          prevTxId: input.hash,
          outputIndex: input.index,
          script: Script.empty()
        }), Script.buildPublicKeyHashOut(address), input.value)
      }

      const size = transaction._estimateSize() + Transaction.CHANGE_OUTPUT_MAX_SIZE
      const fee = parseInt((size / 1000 * feePerKb).toFixed(0))
      const inputTotal = transaction._getInputAmount()
      const outputTotal = transaction._getOutputAmount()
      const available = transaction._getUnspentValue()
      return {
        feePerKb: feePerKb,
        size: size,
        fee: fee,
        inputTotal: inputTotal,
        outputTotal: outputTotal,
        available: available
      }
    },
    build: function (hdnode, inputs, outputs, opts) {
      opts = opts || {}

      const transaction = new Transaction()

      for (const input of inputs) {
        const address = Address.fromString(input.address)
        transaction.addInput(new PublicKeyHash({
          prevTxId: input.hash,
          outputIndex: input.index,
          script: Script.empty()
        }), Script.buildPublicKeyHashOut(address), input.value)
      }

      for (const output of outputs) {
        transaction.to(
          Address.fromString(output.address, network)
          , output.value)
      }

      if (opts.change && opts.fee) {
        const available = transaction._getUnspentValue()
        const changeValue = available - opts.fee
        const dust = opts.dust || Transaction.DUST_AMOUNT
        const isDust = dust > changeValue
        if (!isDust) {
          transaction.change(
            Address.fromString(opts.change, network)
          )
          transaction.fee(opts.fee)
        }
      }

      for (const input of inputs) {
        transaction.sign(hdnode.deriveChild(input.path).privateKey)
      }

      return transaction
    },
    transfer: network.transfer
  })
}
