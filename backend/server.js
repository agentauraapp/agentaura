import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

const app = express()

// CORS: allow your frontend
app.use(cors({ origin: (process.env.CORS_ORIGIN?.split(',') || '*') }))

app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

// Health/root
app.get('/', (_req, res) => res.json({ ok: true }))

// ✅ Test route you’re hitting
app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from Agent Aura API 🎉' })
})

// (optional) 404 handler so logs are clearer
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }))

const PORT = process.env.PORT || 8788
app.listen(PORT, () => console.log(`API listening on :${PORT}`))
