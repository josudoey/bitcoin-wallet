const fs = require('fs')
const bip39 = require('bip39')
const sjcl = require('sjcl')
const co = require('co')
const Network = require('bitcoinjs-lib/src/networks')
const HDNode = require('bitcoinjs-lib/src/hdnode')
const config = require('./config')
const Store = require('./store')
const prompt = require('prompt-sync')({
  sigint: true,
  echo: '*'
})

const Wallet = function (opts) {
  this.network = Network[config.network]
  if (!this.network) {
    throw new Error('not support ' + config.network + ' network')
  }
  this.store = Store(config.wallet.path + '.' + config.network)
  this.derivePrefix = 'm/44\'/0\'/0\''
}

Wallet.getNewPassword = function () {
  let password = ''
  while (true) {
    password = prompt('new password: ', {
      echo: '*'
    })
    if (!password) {
      continue
    }
    let password2 = prompt('retype new password: ', {
      echo: '*'
    })

    if (password !== password2) {
      console.log('password not match')
      continue
    }
    break
  }
  return password
}

Wallet.prototype.initSeed = function () {
  const walletPath = config.wallet.path
  const exists = fs.existsSync(walletPath)
  if (exists) {
    console.log('wallet seed already exists')
    return
  }
  let mnemonic = prompt('input seed mnemonic word [empty is random]:')
  if (!mnemonic) {
    mnemonic = bip39.generateMnemonic()
  }
  const password = Wallet.getNewPassword()
  const ciphertext = sjcl.encrypt(password, mnemonic)
  console.log(`write wallet secret on ${walletPath}`)
  fs.writeFileSync(walletPath, ciphertext)
  return mnemonic
}

Wallet.prototype.initRoot = function () {
  if (this.root) {
    return this.root
  }
  const walletPath = config.wallet.path
  const exists = fs.existsSync(walletPath)
  if (!exists) {
    const mnemonic = this.initSeed()
    const seed = bip39.mnemonicToSeedHex(mnemonic).toString('hex')
    this.root = HDNode.fromSeedHex(seed, this.network)
    return this.root
  }
  const ciphertext = fs.readFileSync(walletPath).toString()
  try {
    const password = prompt('enter password: ', {
      echo: '*'
    })
    const mnemonic = sjcl.decrypt(password, ciphertext)
    const seed = bip39.mnemonicToSeedHex(mnemonic).toString('hex')
    this.root = HDNode.fromSeedHex(seed, this.network)
    return this.root
  } catch (e) {
    throw new Error('password not match')
  }
}

Wallet.prototype.initNode = function () {
  if (this.node) {
    return Promise.resolve(this.node)
  }
  const self = this
  return co(function* () {
    let nodeKey = yield self.store.get('node').catch(function (err) {
      if (err.notFound) {
        return Promise.resolve(null)
      }
      throw err
    })

    if (nodeKey) {
      self.node = HDNode.fromBase58(nodeKey, self.network)
      return self.node
    }

    const root = self.initRoot()
    self.node = root.derivePath(self.derivePrefix).neutered()
    yield self.store.put('node', self.node.toBase58())
    return self.node
  })
}

Wallet.prototype.createP2PKH = function (i) {
  const index = parseInt(i) % 2147483648
  const child = this.node.derive(index)
  const derivePath = this.derivePrefix + '/' + index
  const address = child.getAddress()
  const key = '/' + address
  const newData = {
    type: 'p2pkh',
    path: derivePath,
    address: address,
    createdAt: Date.now()
  }

  return this.store.put(key, newData).then(function () {
    return Promise.resolve(newData)
  })
}

exports = module.exports = function (opts) {
  process.on('uncaughtException', function (err) {
    console.error(err.stack)
  })

  process.on('unhandledRejection', function (err) {
    console.error(err.stack)
  })
  return new Wallet(opts)
}

