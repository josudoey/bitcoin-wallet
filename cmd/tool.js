module.exports = function (prog) {
  const bip39 = require('bip39');
  const sjcl = require('sjcl')
  const Wallet = require('../lib/wallet')
  const co = require('co')
  const prompt = require('prompt-sync')({
    sigint: true,
    echo: '*'
  });

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
      const wallet = new Wallet()
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
      const wallet = new Wallet()
      const s = wallet.store.createReadStream({
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
    .action(function (address, opts) {
      const wallet = new Wallet()
      const balanceOf = function (address) {
        return wallet.balanceOf(address).then(function (balance) {
          let n = balance
          if (!opts.satoshi) {
            n = Wallet.toBTC(balance)
          }
          console.log(address + ' ' + n + ' ' + unit)
          return Promise.resolve(balance)
        })
      }
      if (address) {
        balanceOf(address)
        return
      }
      let total = 0
      const unit = (opts.satoshi) ? 'satoshi' : 'BTC'
      wallet.store.walk('/', function* (item) {
        const address = item.value.address
        const balance = yield balanceOf(address)
        total += balance
      }).then(function () {
        let n = total
        if (!opts.satoshi) {
          n = Wallet.toBTC(n)
        }
        console.log('total balance: ' + n + ' ' + unit)
      })
    })

  prog
    .command('passwd')
    .description('change wallet password')
    .action(function (opts) {
      const wallet = new Wallet()
      wallet.changePassword()
    })

  prog
    .command('clear')
    .description('clear store for utxo')
    .action(function (opts) {
      const wallet = new Wallet()
      wallet.clear()
    })

  prog
    .command('pull [address]')
    .description('pull utxo from remote service')
    .action(function (address, opts) {
      const wallet = new Wallet()
      if (address) {
        wallet.pullUTXO(address)
        return
      }
      wallet.pull()
    })

  prog
    .command('transfer')
    .option('--limit <fee>', 'set fee limit', '0')
    .description('transfer bitcoin')
    .action(co.wrap(function* (opts) {
      const prompt = require('prompt-sync')({
        sigint: true
      })
      const outputs = []
      const feeLimit = Wallet.toSatoshi(opts.limit)
      while (true) {
        const address = prompt('transfer address[empty]: ')
        if (!address) {
          break
        }
        let btc
        while (true) {
          btc = prompt('transfer BTC: ')
          if (btc) {
            break
          }
        }
        outputs.push({
          address: address,
          satoshi: Wallet.toSatoshi(btc)
        })
      }
      if (!outputs.length) {
        return
      }

      const wallet = new Wallet()
      console.log(feeLimit)
      const result = yield wallet.take(outputs, feeLimit)
      const utxo = result.utxo
      console.log()
      console.log(`=====input=====`)
      for (const input of utxo) {
        const address = input.address
        const hash = input.hash
        const btc = Wallet.toBTC(input.value)
        console.log(`input ${hash} ${address} ${btc} BTC`)
      }
      console.log(`====output====`)
      for (const output of outputs) {
        const address = output.address
        const btc = Wallet.toBTC(output.satoshi)
        console.log(`output ${address} ${btc} BTC`)
      }

      console.log(`=====total=====`)
      const totalInputs = result.totalInputs
      const totalOutputs = result.totalOutputs
      const btcInputs = Wallet.toBTC(result.totalInputs)
      const btcOutputs = Wallet.toBTC(result.totalOutputs)
      console.log(`totalInputs: ${btcInputs} totalOutputs: ${btcOutputs}`)
      const data = yield wallet.estimateFee(result.utxo.length, outputs.length + 1)
      const limit = Wallet.toBTC(totalInputs - totalOutputs)
      const optimal = Wallet.toBTC(data.optimal)
      const low = Wallet.toBTC(data.low)
      const min = Wallet.toBTC(data.min)
      console.log(`==estimate fee==`)
      console.log(`limit: ${limit} optimal: ${optimal} low: ${low} min: ${min}`)
      let fee
      while (true) {
        fee = prompt('please input fee BTC: ')
        fee = Wallet.toSatoshi(fee)
        if (fee) {
          break
        }
      }
      const change = totalInputs - totalOutputs - fee
      while (true) {
        if (isNaN(change) || change < 0) {
          throw new Error('fee is faild')
        }
        if (!change) {
          break
        }
        const changeBTC = Wallet.toBTC(change)
        const address = prompt(`address for change send (${changeBTC}):`)
        if (address) {
          outputs.push({
            address: address,
            satoshi: change
          })
          break
        }
      }
      const tx = yield wallet.build(utxo, outputs)
      const hash = tx.getId()
      console.log(`tx hash: ${hash}`)
      yield wallet.send(tx)
    }))

  prog
    .command('fee')
    .description('show estimate fee per kb')
    .action(function (opts) {
      const network = require('../lib/config').network
      const blocktrail = require('../lib/blocktrail')
      console.log(`network: ${network}`)
      blocktrail.feePerKB().then(console.log)
    })
}

