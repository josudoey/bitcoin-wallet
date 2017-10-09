const level = require('level')
const pify = require('pify')
exports = module.exports = function (storePath) {
  return pify(level(storePath, {
    valueEncoding: 'json'
  }))
}

