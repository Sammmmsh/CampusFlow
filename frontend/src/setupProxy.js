const { createProxyMiddleware } = require('http-proxy-middleware');
module.exports = function(app) {
  app.use('/api/ops', createProxyMiddleware({ target: process.env.OPS_PROXY_TARGET || 'http://localhost:8080', changeOrigin: true, proxyTimeout: 20000 }));
};
