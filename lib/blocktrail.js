const config = require('./config')
const rp = require('request-promise')
const template = require('url-template')
const merge = require('merge')

const Service = function () {
  const opts = this.defaultParams = {
    api_key: config.blocktrail.key
  }

  if (config.network === 'bitcoin') {
    opts.network = 'btc'
    opts.testnet = false
  } else {
    opts.network = 'tbtc'
    opts.testnet = true
  }

  this.prefix = 'https://api.blocktrail.com'
}

const apiList = [{
  name: 'feePerKB',
  method: 'get',
  uri: '/v1/{network}/fee-per-kb{?api_key}'
}, {
  name: 'addressUnspentOutputs',
  method: 'get',
  uri: '/v1/{network}/address/{address}/unspent-outputs{?api_key,limit,page,sort_dir}'
}]

const stubMethod = function (opts) {
  const urlResolver = template.parse(opts.uri);
  return function (query, body) {
    const params = merge(true, this.defaultParams)
    merge(params, query)
    const uri = urlResolver.expand(params)
    const method = opts.method
    const prefix = this.prefix
    const req = {
      method: method,
      uri: `${prefix}${uri}`,
      json: true,
      body: body
    }
    return rp(req)
  }
}

for (const api of apiList) {
  Service.prototype[api.name] = stubMethod(api)
}

exports = module.exports = new Service()

