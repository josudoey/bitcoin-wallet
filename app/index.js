
const events = require('events')
exports = module.exports = function (opts) {
  const app = new events.EventEmitter()
  return app
}
