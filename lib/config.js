const path = require('path')
const rc = require('rc')
module.exports = rc('jbw', {
  network: 'bitcoin',
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

