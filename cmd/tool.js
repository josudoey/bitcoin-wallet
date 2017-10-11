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
    .description('init wallet')
    .action(function (opts) {
      new Wallet().initNode()
    })

  prog
    .command('node')
    .description('show node')
    .action(function (opts) {
      new Wallet().initNode().then(function (node) {
        console.log(node.toBase58())
      })
    })

  prog
    .command('create')
    .description('create address')
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
    .description('dump store')
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
    .option('--satoshi', 'show satoshi', false)
    .description('show balance satoshi')
    .action(function (address, opts) {
      //TODO
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
      //TODO
    })

  prog
    .command('clear')
    .description('clear utxo')
    .action(function (opts) {
      const wallet = new Wallet()
      wallet.clear()
    })

  prog
    .command('pull [address]')
    .description('pull utxo')
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
    .description('show fee per kb')
    .action(function (opts) {
      const network = require('../lib/config').network
      const blocktrail = require('../lib/blocktrail')
      console.log(`network: ${network}`)
      blocktrail.feePerKB().then(console.log)
    })

  prog
    .command('estimate-rate')
    .description('calc estimate tx size function')
    .action(function (opts) {
      console.log('txSize = base + inputRate * inputCount + outputRate * outputCount')
      let baseMax = 0
      let inputRateMax = 0
      let outputRateMax = 0
      for (let i = 0; i < 10; i++) {
        const tb = Wallet.getSizeTable()
        const base = tb[2][1] + tb[1][2] - tb[3][3]
        const inputRate = tb[2][1] - tb[1][1]
        const outputRate = tb[1][2] - tb[1][1]
        const base2 = tb[2][2] + tb[1][1] - tb[3][3]
        const inputRate2 = tb[3][2] - tb[2][2]
        const outputRate2 = tb[2][3] - tb[2][2]
        baseMax = (base > baseMax) ? base : baseMax
        baseMax = (base2 > baseMax) ? base2 : baseMax
        inputRateMax = (inputRate > inputRateMax) ? inputRate : inputRateMax
        inputRateMax = (inputRate2 > inputRateMax) ? inputRate2 : inputRateMax
        outputRateMax = (outputRate > outputRateMax) ? outputRate : outputRateMax
        outputRateMax = (outputRate2 > outputRateMax) ? outputRate2 : outputRateMax
      }
      console.log(`base: ${baseMax}`)
      console.log(`inputRate: ${inputRateMax}`)
      console.log(`outputRate: ${outputRateMax}`)
    })

}

