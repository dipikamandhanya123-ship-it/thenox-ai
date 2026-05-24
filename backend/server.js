require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true, methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 300 }));
app.use('/api/auth/', rateLimit({ windowMs: 15*60*1000, max: 20 }));
app.use('/api/ai/', rateLimit({ windowMs: 60*1000, max: 40 }));

try { app.use('/api/auth', require('./routes/auth')); } catch(e) { console.warn('auth:', e.message); }
try { app.use('/api/ai', require('./routes/ai')); } catch(e) { console.warn('ai:', e.message); }
try { app.use('/api/usage', require('./routes/usage')); } catch(e) { console.warn('usage:', e.message); }
try { app.use('/api/billing', require('./routes/billing')); } catch(e) { console.warn('billing:', e.message); }
try { app.use('/api/upload', require('./routes/upload')); } catch(e) { console.warn('upload:', e.message); }

app.get('/', (req, res) => res.json({ status: 'ok', service: 'Thenox AI API', version: '1.0.0' }));
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});
app.use('*', (req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, '0.0.0.0', () => console.log(`⚡ Thenox AI Backend on port ${PORT}`));
module.exports = app;
