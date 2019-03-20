const { parse } = require('url')
const { createClientAsync } = require('soap')

let client = null
const { API_URL, API_CODE, API_TOKEN } = process.env

module.exports = async (req, res) => {
  let answer = null

  try {
    const { track } = parse(req.url, true).query
    if (!track) throw new Error('Missing tracking number.')

    const weight = [8, 6, 4, 2, 3, 5, 9, 7]
    const digits = track.substr(2, 8).split('')
    let check = digits
      .map((dg, i) => dg * weight[i])
      .reduce((pre, acc) => pre + acc)
    check = 11 - (check % 11)
    if (check == 10) check = 0
    if (check == 11) check = 5
    if (check != track[10]) throw new Error('Invalid tracking number.')

    // TODO: Check order IS NOT changed
    if (!client) client = await createClientAsync(API_URL)
    const [result] = await client.WS_ConsultarTrackingAsync({
      TOKEN: API_TOKEN,
      CODCLIENTE: API_CODE,
      NUMORIGEN: track,
    })

    answer = { data: result.WS_ConsultarTrackingResult }
  } catch (err) {
    answer = {
      error: {
        code: err.code || 0,
        message: err.message,
      },
    }
  }

  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(answer))
}
