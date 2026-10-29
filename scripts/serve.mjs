import http from 'node:http';
import process from 'node:process';

// adapter-node treats a missing protocol as https. This app is served over
// plain HTTP, so the browser origin would not match and the login form would
// be rejected as cross-site. Set the header before the adapter reads it.
process.env.PROTOCOL_HEADER ??= 'x-forwarded-proto';

const { handler } = await import('../build/handler.js');

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

const server = http.createServer((req, res) => {
	req.headers['x-forwarded-proto'] = 'http';
	handler(req, res, () => {
		res.statusCode = 404;
		res.end('Not found');
	});
});

server.listen(port, host, () => {
	console.log(`Listening on http://${host}:${port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
	process.on(signal, () => {
		server.close(() => process.exit(0));
	});
}
