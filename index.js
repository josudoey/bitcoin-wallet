const globby = require('globby')
const prog = require('commander')
const path = require('path')
const fs = require('fs')
const pkg = require('./package')

let version = pkg.version
try {
  let gitHead = pkg.gitHead
  if (!gitHead) {
    gitHead = fs.readFileSync(path.join(__dirname, '.git', 'refs', 'heads', 'master')).toString()
  }
  version += ' (' + gitHead.substring(0, 8) + ')'
} catch (e) {}
prog
  .version(version)

const paths = globby.sync('./cmd/**/*.js', {
  cwd: __dirname,
  absolute: false,
  nodir: true
})

for (const name of paths) {
  const mod = require(name)
  mod(prog)
}
prog.parse(process.argv)

if (prog.args.length === 0 || !prog.args[prog.args.length - 1]._name) {
  prog.outputHelp()
}

