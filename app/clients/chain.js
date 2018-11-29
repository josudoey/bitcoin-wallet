
const ApiClientBuilder = require('./api-client-builder')
// /address/{address}/unspent
const apiList = [{
  name: 'queryUnspent',
  method: 'get',
  url: '/address/{address}/unspent{?page,pagesize}'
}, {
  name: 'queryBlock',
  method: 'get',
  url: '/block/{height}{?verbose}'
}]

exports = module.exports = ApiClientBuilder(apiList)
exports.resolveUrl = function (currency, env) {
  const prefixMap = {
    'btc': '',
    'bch': 'bch-'
  }
  const prefix = prefixMap[currency]
  const chainName = env === 'prod' ? 'chain' : 'tchain'

  if (!chainName) {
    throw new Error('currency not support')
  }
  return `https://${prefix}${chainName}.api.btc.com/v3`
}
