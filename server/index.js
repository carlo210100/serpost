const { parse } = require('url')
const { createClientAsync } = require('soap')

let client = null
const { API_URL, API_CODE, API_TOKEN } = process.env

module.exports = async (req, res) => {
  let answer = null

  try {
    const { track } = parse(req.url, true).query
    if (!track) throw new Error('Missing tracking number.')

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
