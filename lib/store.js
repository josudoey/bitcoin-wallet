const level = require('level')
const pify = require('pify')
const co = require('co')
exports = module.exports = function (storePath) {
  const store = pify(level(storePath, {
    valueEncoding: 'json'
  }))

  store.walk = function (prefixKey, func, opts) {
    opts = opts || {}
    concurrent = parseInt(opts.concurrent) || 1
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

    let proc = {}
    let count = 0
    return new Promise(function (resolve, reject) {
      const s = store.createReadStream(params)
      const fn = co.wrap(func)
      let running = 0
      s.on('data', function (data) {
        const index = count++
          running++
          if (concurrent === running) {
            s.pause()
          }
        proc[index] = fn(data).then(function () {
          if (concurrent === running) {
            s.resume()
          }
          running--
          delete proc[index]
        }).catch(function (err) {
          s.destroy()
          reject(err)
          delete proc[index]
        })
      })
      s.on('end', function () {
        if (!Object.keys(proc).length) {
          return resolve()
        }
        co(function* () {
          yield proc
          resolve()
        })
      })
      s.on('error', reject)
    })
  }
  return store
}

