module.exports = function (prog) {
  const sjcl = require('sjcl')
  const Wallet = require('../lib/wallet')
  const co = require('co')

  const BN = require('bn.js')

  const toSatoshi = function (amount) {
    const satoshi = parseInt((parseFloat(amount) * 1e8).toFixed())
    return satoshi
  }

  const toAmount = function (value) {
    const amount = parseFloat((parseInt(value) / 1e8).toFixed(8))
    return amount
  }

  const getWallet = function () {
    const env = (prog.env === 'test') ? 'test' : 'prod'
    const currency = (prog.currency === 'bch') ? 'bch' : 'btc'
    process.on('uncaughtException', function (err) {
      console.error(err.stack)
    })

    process.on('unhandledRejection', function (err) {
      console.error(err.stack)
    })
    return new Wallet(env, currency)
  }

  prog.command('query-utxo <address>')
    .action(async function (address, opts) {
      const currency = prog.currency.toLowerCase()
      const env = prog.env
      const queryUtxo = require('../app/query-utxo')
      const items = await queryUtxo(env, currency, address)
      for (const item of items) {
        const hash = item.hash
        const index = item.index
        const value = item.value
        console.log(`${env} ${currency} utxo ${address} ${hash} ${index} ${value}`)
      }
    })

  prog
    .command('init')
    .description('init wallet secret')
    .action(function (opts) {
      new Wallet().initSeed()
    })

  prog
    .command('node')
    .description('show wallet node m/44\'/0\'/0\' bip32 pubkey')
    .action(function (opts) {
      new Wallet().initNode().then(function (node) {
        console.log(node.toBase58())
      })
    })

  prog
    .command('seed')
    .description('show wallet seed mnemonic')
    .action(function (opts) {
      new Wallet().showSeed()
    })

  prog
    .command('create')
    .description('create wallet address')
    .action(function (opts) {
      const wallet = getWallet()
      wallet.initNode().then(function (node) {
        return wallet.createP2PKH()
      }).then(function (item) {
        console.log(item.address)
      })
    })

  prog
    .command('dump')
    .description('dump store data')
    .action(function (opts) {
      const currency = prog.currency.toLowerCase()
      const env = prog.env
      const queryUtxo = require('../app/query-utxo')
      const store = require('../app/store')(env, currency)
      const s = store.createReadStream({
        keys: true,
        values: true
      })
      console.log('{')
      let isFirst = true
      s.on('data', function (item) {
        const text = (isFirst ? '' : ',') + JSON.stringify(item.key) + ':' + JSON.stringify(item.value)
        console.log(text)
        if (isFirst) {
          isFirst = false
        }
      })
      s.on('end', function () {
        console.log('}')
      })
    })

  prog
    .command('balance [address]')
    .option('--satoshi', 'satoshi unit display', false)
    .description('show balance satoshi')
    .action(async function (address, opts) {
      const currency = prog.currency.toLowerCase()
      const env = prog.env
      const unit = currency.toUpperCase()
      const satoshi = (opts.satoshi) ? 'satoshi' : unit
      const store = require('../app/store')(env, currency)

      const balanceOf = async function (address) {
        let balance = 0
        await store.walk(`utxo/${address}`, async function (item) {
          balance += item.value.value
        })

        let amount = balance
        if (!opts.satoshi) {
          amount = toAmount(balance)
        }

        console.log(`${address} ${amount} ${unit}`)
        return balance
      }

      if (address) {
        await balanceOf(address)
        return
      }

      let total = 0
      await store.walk('/', async function (item) {
        const address = item.value.address
        const balance = await balanceOf(address)
        total += balance
      })
      let amount = total
      if (!opts.satoshi) {
        amount = toAmount(total)
      }
      console.log(`total balance: ${amount} ${unit}`)
    })

  prog
    .command('passwd')
    .description('change wallet password')
    .action(function (opts) {
      const wallet = getWallet()
      wallet.changePassword()
    })

  prog
    .command('pull [address]')
    .description('pull utxo from remote service')
    .action(async function (oneAddress, opts) {
      const currency = prog.currency.toLowerCase()
      const env = prog.env
      const store = require('../app/store')(env, currency)
      const queryUtxo = require('../app/query-utxo')

      const items = []
      if (oneAddress) {
        items.push(oneAddress)
      }

      if (!items.length) {
        await store.walk('/', function (item) {
          items.push(item.value.address)
        })
      }

      store.walk('utxo', async function (item) {
        console.log(`[del] ${env} ${currency} utxo ${item.key}`)
        await store.del(item.key)
      })

      for (const address of items) {
        const meta = await store.get(`/${address}`).catch(function (err) {
          if (err.notFound) {
            return null
          }
          throw err
        })
        const utxos = await queryUtxo(env, currency, address)
        for (const utxo of utxos) {
          const hash = utxo.hash
          const index = utxo.index
          const value = utxo.value
          const key = `utxo/${address}/${hash}/${index}`
          console.log(`[pull] ${env} ${currency} utxo ${address} ${hash} ${index} ${value}`)

          await store.put(key, {
            address: address,
            hash: hash,
            value: value,
            index: index,
            path: meta.path
          })
        }
      }
    })

  prog
    .command('transfer')
    .option('--feePerKb <feePerKb>', 'set fee feePerKb (default: 0.000001000)', '0.00001000')
    .option('--dust <dust>', 'set dust amount', '0.00000546')
    .description('transfer')
    .action(async function (opts) {
      const currency = prog.currency.toLowerCase()
      const unit = currency.toUpperCase()
      const env = prog.env
      const dustValue = toSatoshi(opts.dust) || 546
      const feePerKb = toSatoshi(opts.feePerKb) || 1000
      const store = require('../app/store')(env, currency)

      const prompt = require('prompt-sync')({
        sigint: true
      })
      const outputs = []

      while (true) {
        const address = prompt(`transfer ${unit} address[empty]: `)
        if (!address) {
          break
        }
        let amount
        while (!amount) {
          amount = prompt(`transfer ${unit}: `)
        }
        outputs.push({
          address: address,
          value: toSatoshi(amount)
        })
      }

      const utxos = []
      await store.walk('utxo/', function (val) {
        utxos.push(val.value)
      })

      const takeUtxo = require('../app/take-utxo')
      let coin = await takeUtxo(utxos, outputs)
      const Transaction = require('../app/transaction')(env, currency)
      let estimate = Transaction.estimate(coin.inputs, outputs, feePerKb)
      if (estimate.fee > coin.available) {
        coin = await takeUtxo(utxos, outputs, {
          available: estimate.fee
        })
        estimate = Transaction.estimate(coin.inputs, outputs, feePerKb)
      }

      console.log()
      console.log(`input Total: ${toAmount(estimate.inputTotal)} ${unit}`)
      console.log(`output Total: ${toAmount(estimate.outputTotal)} ${unit}`)
      console.log(`available: ${toAmount(estimate.available)} ${unit}`)
      console.log(`feePerKb: ${toAmount(estimate.feePerKb)} ${unit}`)
      console.log(`estimate size:${estimate.size}`)
      console.log()

      let fee = 0
      while (true) {
        fee = prompt(`fee(estimate: ${toAmount(estimate.fee)}  max: ${toAmount(estimate.available)} ${unit}): `)
        if (fee) {
          fee = toSatoshi(fee)
          break
        }
      }

      if (fee > coin.outputs) {
        console.error('fee over limit')
        return
      }

      let changeValue = coin.available - fee
      let change
      if (changeValue > dustValue) {
        while (!change) {
          change = prompt(`address for change send (${toAmount(changeValue)} ${unit}): `)
        }
      }

      const config = require('../app/config')
      const fs = require('fs')
      const walletPath = config.get('wallet.path')
      const exists = fs.existsSync(walletPath)
      if (!exists) {
        throw new Error('wallet not exists')
      }
      let ciphertext = fs.readFileSync(walletPath).toString()
      let mnemonic
      try {
        const password = prompt('enter password: ', {
          echo: '*'
        })
        mnemonic = sjcl.decrypt(password, ciphertext)
      } catch (e) {
        throw new Error('password not match')
      }
      const bip39 = require('bip39')
      const seed = bip39.mnemonicToSeedHex(mnemonic)
      const HDNode = require('../app/hdnode')(env, currency)
      const node = HDNode.fromSeed(seed)

      const tx = Transaction.build(node, coin.inputs, outputs, {
        change: change,
        fee: fee
      })

      const txBuf = tx.toBuffer()
      const size = txBuf.length
      console.log()
      for (const out of outputs) {
        console.log(`to ${out.address} ${toAmount(out.value)} ${unit}`)
      }

      if (tx._changeScript) {
        console.log(`change ${change} ${toAmount(changeValue)} ${unit}`)
      }

      console.log()
      console.log(`total output: ${toAmount(estimate.outputTotal)} ${unit}`)
      console.log(`feePerKb: ${toAmount(fee * 1000 / size)} fee: ${toAmount(fee)} ${unit}`)
      console.log()
      const yes = prompt(`Do you transfer (y/N):`)

      if (!/y/i.exec(yes)) {
        return
      }

      console.log(`transfer ${tx.id}`)

      await Transaction.transfer(txBuf)
    })
}
