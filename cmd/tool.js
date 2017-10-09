module.exports = function (prog) {
  const bip39 = require('bip39');
  const sjcl = require('sjcl')
  const Wallet = require('../lib/wallet')
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
        return wallet.createP2PKH(Date.now())
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
    .option('-n, --name <name>', 'show name', 'alice')
    .description('show balance satoshi')
    .action(function (address, opts) {
      //TODO
      console.log(`aaaa 100
bbbb 2000`)
    })

  prog
    .command('passwd')
    .description('change wallet password')
    .action(function (opts) {
      //TODO
    })

  prog
    .command('utxo-sync <address>')
    .description('sync address utxo')
    .action(function (opts) {
      //TODO
    })

  prog
    .command('list')
    .description('show all address')
    .action(function (opts) {
      //TODO
    })

  prog
    .command('create')
    .description('create address')
    .action(function (opts) {
      //TODO
    })

  prog
    .command('transfer')
    .description('transfer bitcoin')
    .action(function (opts) {
      //TODO
    })

}

