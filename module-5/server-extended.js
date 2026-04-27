const http = require('http');
 
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  const parsedUrl = new URL(req.url, `http://localhost`);
  const path = parsedUrl.pathname;
 
  if (path === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Hello from Node.js!' }));
    return;
  }
  
  if (path === '/about' && req.method === 'GET'){
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ name: "My First Server", version: "1.0.0"}));
    return;
  }

  if (path === '/time' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({ now: new Date().toISOString()}));
    return;
  }

  if (path === '/echo' && req.method === 'GET') {
    const message = parsedUrl.searchParams.get('message') || 'Nothing to echo';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ echo: message }));
    return;
  }
 
  if (path === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
 
  if (path === '/users' && req.method === 'GET') {
    const users = [
      { id: 1, name: 'Ana' },
      { id: 2, name: 'Bruno' }
    ];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(users));
    return;
  }

  if (path === '/users' && req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => { 
        body += chunk.toString(); 
    });
    
    req.on('end', () => {
        try {
            const parsed = JSON.parse(body);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ received: parsed }));
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON format' }));
        }
    });
    
    return; 
  }
 
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});
 
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});