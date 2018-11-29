
exports = module.exports = function (env, currency) {
  let Network

  if (currency === 'btc') {
    Network = require('bitcore-lib/lib/networks')
  }

  if (currency === 'bch') {
    Network = require('bitcore-lib-cash/lib/networks')
  }

  if (!Network) {
    throw new Error('currency not support')
  }

  const network = (env === 'prod') ? Network.mainnet : Network.testnet

  const Transfer = function () {
    let Pool, Messages, Inventory
    if (currency === 'btc') {
      Pool = require('bitcore-p2p').Pool
      Messages = require('bitcore-p2p').Messages
      Inventory = require('bitcore-p2p').Inventory
    }

    if (currency === 'bch') {
      Pool = require('bitcore-p2p-cash').Pool
      Messages = require('bitcore-p2p-cash').Messages
      Inventory = require('bitcore-p2p-cash').Inventory
    }

    const messages = new Messages({
      network: network
    })

    return function (txBuf, opts) {
      opts = opts || {}
      let send = 0
      const count = opts.count || 3
      const maxSize = opts.maxSize || 30
      const timeout = opts.timeout || 60000
      const pool = new Pool({
        network: network,
        maxSize: maxSize
      })

      const txMsg = messages.Transaction.fromBuffer(txBuf)

      return new Promise(function (resolve, reject) {
        const t = setTimeout(function () {
          reject(new Error('send timeout'))
          pool.disconnect()
        }, timeout)

        pool.on('peerready', function (peer) {
          peer.sendMessage(txMsg)
          send++
          if (send < count) {
            return
          }
          clearTimeout(t)
          pool.disconnect()
          resolve()
        })
        pool.connect()
      })
    }
  }

  network.transfer = Transfer()
  return network
}
