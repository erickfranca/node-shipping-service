import express from 'express';
import { setTimeout as sleep } from 'node:timers/promises';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;
const SERVICE_NAME = process.env.SERVICE_NAME || 'shipping-service';

// Probabilidade de cair na "cauda longa" (requisição lenta).
// É isso que faz o p99 divergir do p50 nos dashboards — o cenário
// que torna histogramas interessantes de estudar.
const SLOW_REQUEST_RATE = Number(process.env.SLOW_REQUEST_RATE ?? 0.1);

function log(level, message, extra = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    message,
    ...extra,
  }));
}

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: SERVICE_NAME });
});

// ---------------------------------------------------------------------------
// POST /shipments
//
// Latência bimodal de propósito:
//   - caso comum (90%): 100-400ms
//   - cauda longa (10%): 800-2000ms
//
// Isso cria a diferença entre p50 e p99 que você vai visualizar no Grafana.
// ---------------------------------------------------------------------------
app.post('/shipments', async (req, res) => {
  const { orderId, shippingAddress } = req.body ?? {};

  if (!orderId || !shippingAddress) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'orderId (string) and shippingAddress (string) are required',
    });
  }

  log('info', 'Scheduling shipment', { orderId });

  const isSlow = Math.random() < SLOW_REQUEST_RATE;
  const latency = isSlow
    ? 800 + Math.floor(Math.random() * 1200)
    : 100 + Math.floor(Math.random() * 300);

  await sleep(latency);

  const trackingCode = `BR${Date.now()}`;
  const estimatedDelivery = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  log('info', 'Shipment scheduled', { orderId, trackingCode, latencyMs: latency, slow: isSlow });

  res.status(201).json({
    trackingCode,
    orderId,
    shippingAddress,
    carrier: 'CORREIOS',
    status: 'SCHEDULED',
    estimatedDelivery: estimatedDelivery.toISOString(),
  });
});

app.listen(PORT, () => {
  log('info', `${SERVICE_NAME} listening on port ${PORT}`);
});
