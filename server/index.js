const { parse } = require('url')
const { createClientAsync } = require('soap')

let client = null
const { API_URL, API_CODE, API_TOKEN } = process.env

const ERROR = {
  UNKNOWN: 'El número de origen no tiene historial.',
  INVALID: 'Dato inválido. Error en el formato del número de origen.',
  MISSING: 'Dato obligatorio faltante. No se ingresó el número de origen.',
}

module.exports = async (req, res) => {
  let answer = null

  try {
    let { track } = parse(req.url, true).query
    if (!track) throw new Error(ERROR.MISSING)

    track = track.toUpperCase()
    if (!/^[CARVEL][A-Z]\d{9}[A-Z]{2}$/.test(track))
      throw new Error(ERROR.INVALID)

    const weight = [8, 6, 4, 2, 3, 5, 9, 7]
    const digits = track.substr(2, 8).split('')
    let check = digits
      .map((dg, i) => dg * weight[i])
      .reduce((pre, acc) => pre + acc)
    check = 11 - (check % 11)
    if (check == 10) check = 0
    if (check == 11) check = 5
    if (check != track[10]) throw new Error(ERROR.INVALID)

    // TODO: Check order IS NOT changed
    if (!client) client = await createClientAsync(API_URL)
    const [result] = await client.WS_ConsultarTrackingAsync({
      TOKEN: API_TOKEN,
      CODCLIENTE: API_CODE,
      NUMORIGEN: track,
    })

    answer = { data: result.WS_ConsultarTrackingResult }
    if (!answer.data) throw new Error(ERROR.UNKNOWN)
  } catch (err) {
    let message = null
    if (!err.root) message = err.message
    else message = err.root.Envelope.Body.Fault.faultstring.$value

    answer = { error: { message } }
  }

  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(answer))
}
