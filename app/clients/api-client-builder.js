const axios = require('axios')
const urlTemplate = require('url-template')

const Axios = Symbol('Axios')
const Method = Symbol('Method')
const Data = Symbol('Data')
const Headers = Symbol('Headers')
const Config = Symbol('Config')
const Url = Symbol('Url')
const QueryString = Symbol('QueryString')

class AxiosChain {
  constructor (axios, method, url) {
    this[Axios] = axios
    this[Method] = method
    this[Url] = url
    this[Headers] = undefined
    this[Data] = undefined
    this[Config] = undefined
  }

  headers (headers) {
    this[Headers] = headers
    return this
  }

  data (data) {
    this[Data] = data
    return this
  }

  config (config) {
    this[Config] = config
    return this
  }

  exec () {
    const axios = this[Axios]
    const method = this[Method]
    const url = this[Url]
    const data = this[Data]
    const config = this[Config]
    const axiosConfig = Object.assign({}, config)
    axiosConfig.headers = Object.assign({}, axiosConfig.headers, this[Headers])
    Object.assign(
      axiosConfig,
      {
        method: method,
        url: url,
        data: data
      }
    )
    return axios(axiosConfig)
  }

  then (onFulfilled, onRejected) {
    return this.exec().then(onFulfilled).catch(onRejected)
  }
}

exports = module.exports = function (apiList) {
  class Client {
    constructor (baseURL, defaultQueryString) {
      this[QueryString] = defaultQueryString
      this.axios = axios.create({
        baseURL: baseURL,
        headers: {
          common: {}
        },
        validateStatus: function () {
          return true
        }
      })
    }
  }

  for (const define of apiList) {
    const name = define.name
    const method = define.method
    const url = define.url
    if (!name) {
      throw new Error('name is require')
    }

    if (!method) {
      throw new Error('method is require')
    }

    if (!url) {
      throw new Error('url is require')
    }

    const template = urlTemplate.parse(url)
    Client.prototype[name] = function (expand) {
      const url = template.expand(Object.assign({}, this[QueryString], expand))
      return new AxiosChain(this.axios, method, url)
    }
  }
  return Client
}
