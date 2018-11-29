exports = module.exports = async function (env, currency, address) {
  const Blocktrail = require('./clients/blocktrail')
  const config = require('./config')
  const baseUrl = Blocktrail.resolveUrl(currency, env)
  const blocktrail = new Blocktrail(baseUrl, {
    api_key: config.get('blocktrail.key')
  })

  let page = 1
  const items = []
  while (true) {
    const resp = await blocktrail.queryUtxo({
      address: address,
      page: page,
      limit: 50
    })

    if (resp.status !== 200) {
      throw new Error('query utxo failed')
    }
    if (!resp.data.data) {
      return // Resource Not Found
    }
    const data = resp.data
    const list = data.data
    for (const item of list) {
      items.push(item)
    }
    if (data.per_page !== list.length) {
      break
    }
    page++
  }
  return items
}
