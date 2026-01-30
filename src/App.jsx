import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Container, Row, Col, Form, Table, Alert, Spinner, Badge } from 'react-bootstrap'

function dateOnly(value) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  if (s.includes('T')) return s.split('T')[0]
  return s.split(' ')[0]
}

function leftOfDoubleDash(value) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  return s.split('--')[0].trim()
}

function normalizeHeader(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // quita tildes
    .replace(/\s+/g, ' ')
}

function normalizeRowKeys(row) {
  const out = {}
  for (const k of Object.keys(row)) {
    out[normalizeHeader(k)] = row[k]
  }
  return out
}

export default function App() {
  const csvUrl = import.meta.env.VITE_SHEET_CSV_URL

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [selectedEmail, setSelectedEmail] = useState('')

  // Define aquí los nombres “lógicos” de columnas (las buscamos normalizadas)
  const keys = useMemo(() => {
    return {
      email: normalizeHeader('Correo del instructor'),
      marca: normalizeHeader('Marca temporal'),
      aprob: normalizeHeader('Fecha de aprobación'),
      nombreProg: normalizeHeader('NOMBRE DEL PROGRAMA DE FORMACIÓN'),
      codigoProg: normalizeHeader('CODIGO DE PROGRAMA'),
      ini: normalizeHeader('FECHA DE INICIO DE LA FORMACIÓN'),
      fin: normalizeHeader('FECHA DE FINALIZACIÓN DE LA FORMACIÓN'),
      ficha: normalizeHeader('Número de ficha'),
      codSol: normalizeHeader('Código de solicitud'),
    }
  }, [])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError('')

        if (!csvUrl) {
          throw new Error('Falta VITE_SHEET_CSV_URL en el archivo .env')
        }

        const res = await fetch(csvUrl)
        if (!res.ok) throw new Error(`No se pudo leer el CSV (HTTP ${res.status}). Verifica que la hoja esté “Publicada en la web”.`)

        const csvText = await res.text()

        const parsed = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
        })

        if (parsed.errors?.length) {
          // No es fatal siempre, pero avisamos si hay problemas de parseo
          console.warn('CSV parse errors:', parsed.errors)
        }

        // Normalizamos headers para que “tildes/mayúsculas/espacios” no rompan el mapeo
        const normalized = (parsed.data || []).map(normalizeRowKeys)

        setRows(normalized)

        // Cargar correos y autoseleccionar primero
        const emails = [...new Set(normalized.map(r => (r[keys.email] || '').trim()).filter(Boolean))].sort()
        if (emails.length) setSelectedEmail(emails[0])
        else setSelectedEmail('')
      } catch (e) {
        setError(e?.message || 'Error cargando datos')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [csvUrl, keys.email])

  const instructorEmails = useMemo(() => {
    return [...new Set(rows.map(r => (r[keys.email] || '').trim()).filter(Boolean))].sort()
  }, [rows, keys.email])

  const filtered = useMemo(() => {
    if (!selectedEmail) return []
    return rows.filter(r => (r[keys.email] || '').trim() === selectedEmail)
  }, [rows, selectedEmail, keys.email])

  return (
    <Container className="py-4">
      <Row className="mb-3">
        <Col>
          <h3 className="mb-1">Solicitudes</h3>

        </Col>
      </Row>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-3 align-items-end mb-3">
        <Col md={6} lg={4}>
          <Form.Select
            value={selectedEmail}
            onChange={(e) => setSelectedEmail(e.target.value)}
            disabled={loading || instructorEmails.length === 0}
          >
            {instructorEmails.length === 0 ? (
              <option value="">(No hay correos encontrados)</option>
            ) : (
              instructorEmails.map((em) => (
                <option key={em} value={em}>
                  {em}
                </option>
              ))
            )}
          </Form.Select>
        </Col>

        <Col>
          {loading ? (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span>Cargando…</span>
            </div>
          ) : (
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted">Registros:</span>
              <Badge bg="secondary">{filtered.length}</Badge>
            </div>
          )}
        </Col>
      </Row>

      <Table striped bordered hover responsive className="align-middle">
        <thead className="text-center align-middle">
          <tr>
            <th>Fecha de solicitud</th>
            <th>Fecha de aprobación</th>
            <th>Nombre del programa</th>
            <th>Código de programa</th>
            <th>Inicio</th>
            <th>Finalización</th>
            <th>Número de ficha</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r, idx) => (
            <tr key={idx}>
              <td>{dateOnly(r[keys.marca]) || ''}</td>
              <td>{dateOnly(r[keys.aprob]) || ''}</td>
              <td>{leftOfDoubleDash(r[keys.nombreProg]) || ''}</td>
              <td>{r[keys.codigoProg] || ''}</td>
              <td>{r[keys.ini] || ''}</td>
              <td>{r[keys.fin] || ''}</td>
              <td>{r[keys.ficha] || ''}</td>
            </tr>
          ))}

          {!loading && filtered.length === 0 && (
            <tr>
              <td colSpan={8} className="text-center text-muted">
                No hay registros para ese instructor (o no se detectaron columnas).
              </td>
            </tr>
          )}
        </tbody>
      </Table>


    </Container>
  )
}
