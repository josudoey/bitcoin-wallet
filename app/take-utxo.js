exports = module.exports = async function (utxos, outputs, opts) {
  opts = opts || {}
  const utxoRetention = parseInt(opts.utxoRetention) || 1
  const available = parseInt(opts.available) || 0

  const inputs = []

  utxos = utxos.slice().sort(function (a, b) {
    // asc
    return a.value - b.value
  })
  let outputTotal = 0
  for (const output of outputs) {
    outputTotal += output.value
  }
  let inputTotal = 0
  if (utxos.length > utxoRetention) {
    const item = utxos.pop()
    inputTotal += item.value
    inputs.push(item)
  }

  const enoughValue = outputTotal + available
  while (true) {
    if (inputTotal > enoughValue) {
      break
    }
    if (!utxos.length) {
      // console.error(`utxo total: ${inputTotal}  total output: ${outputTotal} fee limit: ${estimateFee}`)
      throw new Error('balance not enough')
    }
    const remaining = enoughValue - inputTotal
    if (remaining > utxos[utxos.length - 1].value) {
      const item = utxos.pop()
      inputTotal += item.value
      inputs.push(item)
      continue
    }

    for (let i = 0; i < utxos.length; i++) {
      if (remaining > utxos[i].value) {
        continue
      }
      const item = utxos.splice(i, 1).pop()
      inputTotal += item.value
      inputs.push(item)
      break
    }
  }

  return {
    inputs: inputs,
    inputTotal: inputTotal,
    outputTotal: outputTotal,
    available: inputTotal - outputTotal
  }
}
