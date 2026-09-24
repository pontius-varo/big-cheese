import express from 'express';
import { PortfolioRepository } from './data/portfolio_repository.js';
import { createPortfolioRouter } from './routes/portfolio_routes.js';

export function createApp(db) {
  const app = express();
  const portfolioRepository = new PortfolioRepository(db);

  app.disable('x-powered-by');
  app.use(express.json());

  app.get('/health', (_request, response) => {
    db.prepare('SELECT 1').get();
    response.json({ status: 'ok' });
  });
  app.use('/api', createPortfolioRouter(portfolioRepository));

  app.use((_request, response) => {
    response.status(404).json({ error: 'Route not found' });
  });
  app.use((error, _request, response, _next) => {
    console.error('API request failed', error);
    response.status(error.status ?? 500).json({
      error: error.status && error.status < 500 ? error.message : 'Internal server error',
    });
  });

  return app;
}
