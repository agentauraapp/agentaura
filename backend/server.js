import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

const app = express()
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*' }))
app.use(express.json())
app.use(morgan('dev'))

app.get('/', (_req, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 8788
app.listen(PORT, () => console.log(`API listening on :${PORT}`))
