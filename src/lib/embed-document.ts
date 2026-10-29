export const EMBED_SOURCE = 'amedia-embed';

export const VIEWER_CSP =
	"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:; media-src data: blob: https:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'";

function escapeAttr(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function heightScript(embedId: string): string {
	const id = JSON.stringify(embedId);
	// documentElement.scrollHeight is at least the iframe viewport, so a short embed
	// loaded into a 240px frame would report 240 forever and could never shrink.
	return `<script>(function(){var id=${id};function height(){var d=document.documentElement;var max=d?d.getBoundingClientRect().bottom+window.scrollY:0;var nodes=document.querySelectorAll('body *');for(var i=0;i<nodes.length;i++){var bottom=nodes[i].getBoundingClientRect().bottom+window.scrollY;if(bottom>max)max=bottom;}return Math.ceil(max);}function send(){parent.postMessage({source:${JSON.stringify(EMBED_SOURCE)},id:id,height:height()},'*');}send();window.addEventListener('load',send);if(window.ResizeObserver){new ResizeObserver(send).observe(document.documentElement);}setInterval(send,400);})();</script>`;
}

export function prepareEmbedDocument(raw: string, embedId: string): string {
	let html = raw.trim();
	if (!html) return '';

	if (!/<html\b/i.test(html)) {
		html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
	} else if (!/^\s*<!doctype/i.test(html)) {
		html = `<!DOCTYPE html>\n${html}`;
	}

	html = html.replace(/<base\b[^>]*>/gi, '');
	html = html.replace(/<meta\b[^>]*>/gi, (tag) =>
		/http-equiv\s*=\s*["']?(?:content-security-policy|refresh)\b/i.test(tag) ? '' : tag
	);

	const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${VIEWER_CSP}">`;
	if (/<head\b[^>]*>/i.test(html)) {
		html = html.replace(/<head\b[^>]*>/i, (open) => `${open}${cspMeta}`);
	} else {
		html = html.replace(/<html\b[^>]*>/i, (open) => `${open}<head>${cspMeta}</head>`);
	}

	const script = heightScript(embedId);
	const bodyClose = html.toLowerCase().lastIndexOf('</body>');
	if (bodyClose >= 0) {
		html = html.slice(0, bodyClose) + script + html.slice(bodyClose);
	} else {
		html += script;
	}
	return html;
}

export function readEmbedHeightMessage(data: unknown, embedId: string): number | null {
	if (!data || typeof data !== 'object') return null;
	const message = data as Record<string, unknown>;
	if (message.source !== EMBED_SOURCE || message.id !== embedId) return null;
	const height = typeof message.height === 'number' ? message.height : Number.NaN;
	if (!Number.isFinite(height) || height < 0 || height > 8000) return null;
	return Math.ceil(height);
}

export function embedSnippet(origin: string, id: string, title: string): string {
	const src = `${origin.replace(/\/$/, '')}/view/${encodeURIComponent(id)}`;
	const frameId = `amedia-embed-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
	return `<iframe id="${frameId}" src="${escapeAttr(src)}" sandbox="allow-scripts" referrerpolicy="no-referrer" title="${escapeAttr(title)}" style="width:100%;border:0;height:240px"></iframe>
<script>(function(){var frame=document.getElementById(${JSON.stringify(frameId)});if(!frame)return;window.addEventListener('message',function(event){if(event.origin!=='null')return;if(event.source!==frame.contentWindow)return;var data=event.data;if(!data||data.source!==${JSON.stringify(EMBED_SOURCE)}||data.id!==${JSON.stringify(id)})return;var height=Number(data.height);if(!isFinite(height)||height<0||height>8000)return;frame.style.height=Math.ceil(height)+'px';});})();</script>`;
}
