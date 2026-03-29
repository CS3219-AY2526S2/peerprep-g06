import express from 'express'
import cors from 'cors'
import questionRoutes from './routes/questionRoutes'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/questions', questionRoutes)

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`Question service running on port ${PORT}`)
})