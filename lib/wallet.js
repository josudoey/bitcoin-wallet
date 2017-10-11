const fs = require('fs')
const bip39 = require('bip39')
const sjcl = require('sjcl')
const co = require('co')
const BigNumber = require('bignumber.js')
const Network = require('bitcoinjs-lib/src/networks')
const HDNode = require('bitcoinjs-lib/src/hdnode')
const TransactionBuilder = require('bitcoinjs-lib/src/transaction_builder')
const transfer = require('./transfer')
const config = require('./config')
const blocktrail = require('./blocktrail')
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
  this.utxoLimit = parseInt(config.utxoLimit) || 10
  this.feeLimit = parseInt(config.feeLimit) || 10
}

const toBTC = function (satoshi) {
  const valueOfUnit = '100000000'
  const n = new BigNumber(satoshi.toString()).dividedBy(valueOfUnit)
  return n.toString(10)
}

const toSatoshi = function (btc) {
  const valueOfUnit = '100000000'
  const n = new BigNumber(btc.toString()).mul(valueOfUnit)
  return n.toFixed(8)
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

Wallet.prototype.createP2PKH = function () {
  const self = this
  const indexKey = 'addressCount'
  return self.store.get(indexKey).catch(function (err) {
    if (err.notFound) {
      return Promise.resolve(0)
    }
    throw err
  }).then(function (index) {
    index = index % 2147483648
    const child = self.node.derive(index)
    const derivePath = self.derivePrefix + '/' + index
    const address = child.getAddress()
    const key = '/' + address
    const newData = {
      type: 'p2pkh',
      path: derivePath,
      address: address,
      createdAt: Date.now()
    }
    return self.store.put(key, newData)
      .then(function () {
        self.store.put(indexKey, ++index)
      }).then(function () {
        return Promise.resolve(newData)
      })
  })
}

Wallet.prototype.clear = function () {
  const self = this
  return this.store.walk('utxo', function* (item) {
    console.log(`del ${item.key}`)
    yield self.store.del(item.key)
  })
}

Wallet.prototype.balanceOf = function (address) {
  let sum = 0
  return this.store.walk(`utxo/${address}`, function* (item) {
    sum += item.value.value
  }).then(function () {
    return sum
  })
}

Wallet.prototype.pullUTXO = function (address) {
  const self = this
  return co(function* () {
    const inStore = yield self.store.get(`/${address}`).catch(function (err) {
      if (err.notFound) {
        return null
      }
      throw err
    })
    let page = 1
    while (true) {
      const resp = yield blocktrail.addressUnspentOutputs({
        address: address,
        page: page
      })
      for (const item of resp.data) {
        if (!item.confirmations) {
          continue
        }
        const hash = item.hash
        const index = item.index
        const value = item.value
        const key = `utxo/${address}/${hash}`
        console.log(`utxo ${address} ${hash} ${index} ${value}`)
        if (!inStore) {
          continue
        }
        yield self.store.put(key, {
          address: address,
          hash: hash,
          value: value,
          index: index
        })
      }
      if (resp.current_page * resp.per_page < resp.total) {
        page += 1
        continue
      }
      break
    }
  })
}

Wallet.prototype.pull = function () {
  const self = this
  return this.store.walk('/', function* (item) {
    const address = item.value.address
    yield self.pullUTXO(address)
  })
}

Wallet.prototype.estimateSize = function (inputCount, outputCount) {
  return 12 + inputCount * 150 + outputCount * 36
}

Wallet.prototype.estimateFee = function (inputCount, outputCount) {
  const size = this.estimateSize(inputCount, outputCount)
  return blocktrail.feePerKB().then(function (perKb) {
    const kb = size / 1024
    return Promise.resolve({
      optimal: parseInt(perKb.optimal * kb),
      low: parseInt(perKb.low_priority * kb),
      min: parseInt(perKb.min_relay_fee * kb)
    })
  })
}

Wallet.prototype.take = function (outputs, feeLimit) {
  const self = this
  const utxoLimit = self.utxoLimit
  feeLimit = parseInt(feeLimit) || self.feeLimit
  return co(function* () {
    let items = []
    const utxo = []
    yield self.store.walk('utxo', function* (item) {
      items.push(item.value)
    })
    items = items.sort(function (a, b) {
      //asc
      return a.value - b.value
    })
    let totalOutputs = 0
    for (const output of outputs) {
      totalOutputs += output.satoshi
    }
    let totalInputs = 0
    if (items.length > utxoLimit) {
      const item = items.pop()
      totalInputs += item.value
      utxo.push(item)
    }
    while (true) {
      if (totalInputs > totalOutputs + feeLimit) {
        break
      }
      console.log(totalInputs, totalOutputs, feeLimit)
      if (!items.length) {
        throw new Error('balance not enough')
      }
      const remaining = totalOutputs + feeLimit - totalInputs
      if (remaining > items[items.length - 1].value) {
        const item = items.pop()
        totalInputs += item.value
        utxo.push(item)
        continue
      }

      for (let i = 0; i < items.length; i++) {
        if (remaining > items[i].value) {
          continue
        }
        const item = items.splice(i, 1).pop()
        totalInputs += item.value
        utxo.push(item)
        break
      }
    }

    return {
      utxo: utxo,
      totalInputs: totalInputs,
      totalOutputs: totalOutputs
    }

  })
}

Wallet.prototype.build = function (utxo, outputs) {
  const self = this
  this.initRoot()
  return co(function* () {
    const builder = new TransactionBuilder(self.network)
    for (const input of utxo) {
      builder.addInput(input.hash, input.index)
    }
    for (const output of outputs) {
      builder.addOutput(output.address, output.satoshi)
    }
    for (let i = 0; i < utxo.length; i++) {
      const input = utxo[i]
      const address = input.address
      const hash = input.hash
      const meta = yield self.store.get('/' + address)
      const keyPair = self.root.derivePath(meta.path).keyPair
      builder.sign(i, keyPair)
    }
    const tx = builder.build()

    for (let i = 0; i < utxo.length; i++) {
      const input = utxo[i]
      const address = input.address
      const hash = input.hash
      yield self.store.del(`utxo/${address}/${hash}`)
    }

    /*
              console.log(tx.toBuffer().length)
              console.log(tx.toHex().length / 2)
              console.log(tx.virtualSize())
              console.log(tx.getId())
          */
    return tx

  })

}

Wallet.prototype.send = function (tx) {
  return transfer(tx.toBuffer())
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

exports.toBTC = toBTC
exports.toSatoshi = toSatoshi
exports.getSizeTable = function () {
  //ref https://github.com/bitcoin/bitcoin/blob/e5f1f5a26399c7d36fa8e2c29ec411eea49b0a4c/src/main.h#L56
  //ref https://github.com/bitcoin/bitcoin/blob/e5f1f5a26399c7d36fa8e2c29ec411eea49b0a4c/src/main.cpp#L644-L648
  const maxStandardTxSize = 100000
  const mnemonic = bip39.generateMnemonic()
  const seed = bip39.mnemonicToSeedHex(mnemonic).toString('hex')
  const root = HDNode.fromSeedHex(seed)
  const keyPair = root.keyPair
  const address = root.getAddress()
  const hash = '0000000000000000000000000000000000000000000000000000000000000001'
  const getSize = function (inputCount, outputCount) {
    const builder = new TransactionBuilder()
    for (let i = 0; i < inputCount; i++) {
      builder.addInput(hash, i)
    }
    for (let j = 0; j < outputCount; j++) {
      builder.addOutput(address, 1)
    }
    for (let i = 0; i < inputCount; i++) {
      builder.sign(i, keyPair)
    }

    let tx = builder.build()
    let size = tx.toBuffer().length
    return size
  }
  const table = []
  for (let i = 1; i <= 3; i++) {
    table[i] = []
    for (let o = 1; o <= 3; o++) {
      const size = getSize(i, o)
      if (size > maxStandardTxSize) {
        break
      }
      table[i][o] = size
    }
  }
  return table
}

