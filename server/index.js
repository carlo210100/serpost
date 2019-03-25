const { parse } = require('url')
const { request } = require('http')
const { xml2js } = require('xml-js')

const UPU_WG = [8, 6, 4, 2, 3, 5, 9, 7]
const UPU_RX = /^[CARVEL][A-Z]\d{9}[A-Z]{2}$/
const ERRORS = {
  UNKNOWN: 'El número de origen no tiene historial.',
  INVALID: 'Dato inválido. Error en el formato del número de origen.',
  MISSING: 'Dato obligatorio faltante. No se ingresó el número de origen.',
}

const XML_PM = {
  trim: true,
  compact: true,
  textKey: '$text',
  ignoreAttributes: true,
  elementNameFn(name) {
    if (name.includes(':')) {
      return name.split(':')[1]
    }
    return name
  },
}

const BODY = [
  '<?xml version="1.0" encoding="utf-8"?>',
  '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">',
  '<s:Body>',
  '<WS_ConsultarTracking xmlns="WebService.net">',
  `<TOKEN>${process.env.API_TOKEN}</TOKEN>`,
  `<CODCLIENTE>${process.env.API_CODE}</CODCLIENTE>`,
  '<NUMORIGEN>%s</NUMORIGEN>',
  '</WS_ConsultarTracking>',
  '</s:Body>',
  '</s:Envelope>',
].join('')

async function handler(req, res) {
  let answer = {}

  try {
    const { track } = parse(req.url, true).query
    if (!track) throw new Error(ERRORS.MISSING)
    if (!isUPU(track)) throw new Error(ERRORS.INVALID)

    const result = await getData(track)
    if (!result) throw new Error(ERRORS.UNKNOWN)

    answer.data = result
  } catch (err) {
    answer.error = {
      code: err.code,
      message: err.message,
    }
  }

  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(answer))
}

function isUPU(id) {
  id = (id + '').toUpperCase()
  if (!UPU_RX.test(id)) return false

  let check = id
    .substr(2, 8)
    .split('')
    .map((d, i) => d * UPU_WG[i])
    .reduce((p, c) => c + p)
  check = 11 - (check % 11)
  if (check == 10) check = 0
  if (check == 11) check = 5
  return check == id[10]
}

function getData(id) {
  let resp = ''
  const body = BODY.replace('%s', id)
  return new Promise((resolve, reject) => {
    request({
      method: 'POST',
      host: 'webservice.serpost.com.pe',
      path: '/ws_appmovil/ServiceAppMovil.svc',
      headers: {
        'content-length': body.length,
        'content-type': 'text/xml; charset=utf-8',
        soapaction: 'WebService.net/IServiceAppMovil/WS_ConsultarTracking',
      },
    })
      .on('error', reject)
      .on('response', (res) => {
        res
          .setEncoding('utf8')
          .on('data', (chunk) => (resp += chunk))
          .on('end', () => resolve(parseXML(resp)))
      })
      .end(body)
  })
}

function parseXML(xml) {
  xml = normalize(xml2js(xml, XML_PM).Envelope.Body)
  if (xml.Fault) {
    const err = new Error(xml.Fault.faultstring)
    err.code = xml.Fault.faultcode.slice(2)
    return Promise.reject(err)
  }
  xml = xml.WS_ConsultarTrackingResponse.WS_ConsultarTrackingResult
  return xml.ITEMS ? xml : null
}

function normalize(obj) {
  if ('$text' in obj) return obj.$text
  if (typeof obj == 'string') return obj
  if (!Object.keys(obj).length) return null
  if (Array.isArray(obj)) return obj.map(normalize)
  return Object.keys(obj).reduce((o, k) => {
    o[k] = normalize(obj[k])
    return o
  }, {})
}

module.exports = handler
