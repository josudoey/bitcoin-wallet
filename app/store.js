const level = require('level')
exports = module.exports = function (env, currency) {
  const config = require('./config')
  const networkName = (env === 'prod') ? 'mainnet' : 'testnet'
  const storePath = config.get('wallet.path') + '.' + currency + '.' + networkName

  const store = level(storePath, {
    valueEncoding: 'json'
  })

  store.walk = function (prefixKey, func, opts) {
    opts = opts || {}
    let concurrent = parseInt(opts.concurrent) || 1
    const params = {
      keys: opts.keys || true,
      values: opts.values || true
    }

    if (prefixKey) {
      const gte = params.gte = prefixKey
      const tailIndex = gte.length - 1
      const tailCode = gte.charCodeAt(tailIndex)
      params.lt = gte.substring(0, tailIndex) + String.fromCharCode(tailCode + 1)
    }

    let queue = new Set()
    return new Promise(function (resolve, reject) {
      const s = store.createReadStream(params)
      s.on('data', async function (data) {
        const task = async function () {
          await func(data)
        }
        const proc = task()
        try {
          queue.add(proc)
          if (queue.size === concurrent) {
            s.pause()
          }
          await proc
        } catch (err) {
          s.destroy()
          reject(err)
        } finally {
          if (queue.size === concurrent) {
            s.resume()
          }
          queue.delete(proc)
        }
      })

      s.on('end', function () {
        if (!queue.size) {
          return resolve()
        }
        Promise.all(queue).then(resolve).catch(reject)
      })
      s.on('error', reject)
    })
  }
  return store
}
