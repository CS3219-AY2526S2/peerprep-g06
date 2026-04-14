import express from 'express';
import cors from 'cors';
import questionRoutes from './routes/questionRoutes';

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const startedAt = Date.now();
  console.log(`[question-service] ${req.method} ${req.originalUrl} started`);

  res.on('finish', () => {
    console.log(
      `[question-service] ${req.method} ${req.originalUrl} completed ${res.statusCode} in ${Date.now() - startedAt}ms`,
    );
  });

  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/questions', questionRoutes);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Question service running on port ${PORT}`);
});
