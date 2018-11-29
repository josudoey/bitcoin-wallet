
const ApiClientBuilder = require('./api-client-builder')
const apiList = [{
  name: 'feePerKB',
  method: 'get',
  url: '/fee-per-kb{?api_key}'
}, {
  name: 'queryUtxo',
  method: 'get',
  url: '/address/{address}/unspent-outputs{?api_key,limit,page,sort_dir}'
}]

exports = module.exports = ApiClientBuilder(apiList)
exports.resolveUrl = function (currency, env) {
  const prefixMap = {
    'btc': 'btc',
    'bch': 'bcc'
  }
  const prefix = prefixMap[currency]
  const network = env === 'prod' ? prefix : `t${prefix}`
  if (!network) {
    throw new Error('currency not support')
  }
  return `https://api.blocktrail.com/v1/${network}`
}
