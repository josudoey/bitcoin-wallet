const path = require('path')
const rc = require('rc')
module.exports = rc('bw', {
  network: 'bitcoin',
  wallet: {
    path: path.resolve(__dirname, '..', '.wallet')
  }
})

