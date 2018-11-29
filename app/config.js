const rc = require('rc')
const dotProp = require('dot-prop')

const configInstance = rc('jbw', {
  network: 'bitcoin',
  currency: 'BTC',
  feeLimit: '0',
  utxoLimit: '5',
  wallet: {
    path: './jbw'
  },
  mnemonic: {
    strength: '128'
  },
  blocktrail: {
    key: 'ca4945be3ad10c5e9895f8e2b6b5c4036aca3f8b'
  }
})

module.exports = {
  get: function (name) {
    return dotProp.get(configInstance, name)
  }
}
