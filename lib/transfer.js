const config = require('./config')
const bitcore = require('bitcore-lib');
const Networks = bitcore.Networks;
const Pool = require('bitcore-p2p').Pool;
const Messages = require('bitcore-p2p').Messages;
const Inventory = require('bitcore-p2p').Inventory;
let network = Networks.testnet
if (config.network === 'bitcoin') {
  network = Networks.livenet
}
const messages = new Messages({
  network: network
})
exports = module.exports = function (txBuf, opts) {
  let count = 0
  const maxSize = 10
  const timeout = 60000
  const pool = new Pool({
    network: network,
    maxSize: maxSize
  })
  const txMsg = messages.Transaction.fromBuffer(txBuf)

  return new Promise(function (resolve, reject) {
    const t = setTimeout(function () {
      reject(new Error('send timeout'))
    }, timeout)

    pool.on('peerready', function (peer) {
      peer.sendMessage(txMsg)
      count++
      if (maxSize > count) {
        return
      }
      clearTimeout(t)
      pool.disconnect()
      resolve()
    })
    pool.connect()
  })

}

