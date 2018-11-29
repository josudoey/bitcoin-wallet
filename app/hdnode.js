const Network = require('./network')

exports = module.exports = function (env, currency) {
  let HDPublicKey, HDPrivateKey

  if (currency === 'btc') {
    HDPublicKey = require('bitcore-lib/lib/hdpublickey')
    HDPrivateKey = require('bitcore-lib/lib/hdprivatekey')
  }

  if (currency === 'bch') {
    HDPublicKey = require('bitcore-lib-cash/lib/hdpublickey')
    HDPrivateKey = require('bitcore-lib-cash/lib/hdprivatekey')
  }

  const network = Network(env, currency)

  return {
    HDPublicKey: HDPublicKey,
    HDPrivateKey: HDPrivateKey,
    network: network,
    fromSeed: function (seed) {
      return HDPrivateKey.fromSeed(seed, network)
    },
    fromPublicKey: function (key) {
      return HDPublicKey.fromString(key, network)
    }
  }
}
