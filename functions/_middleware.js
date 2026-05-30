// Cloudflare Pages middleware: pick the landing-page language by visitor country.
// Vietnam -> Vietnamese, everywhere else -> English. Runs on every request but
// only rewrites the landing page HTML; assets and the legal pages pass through.
//
// It sets data-lang / lang on <html> (so the right language shows on first paint,
// with no flash, and crawlers see the correct language) and swaps the <title> +
// meta description for English. A client script (index.html <head>) still lets a
// visitor override the choice with the VI|EN toggle or a ?lang= query param.

const EN = {
  title: 'StoryAI · You choose. AI weaves the tale.',
  description:
    'StoryAI — an interactive AI storytelling app. Every choice you make leads AI to write a different story. Romance, horror, fantasy, school life.',
  ogTitle: 'StoryAI · You choose. AI weaves the tale.',
  ogDescription: 'An interactive AI storytelling app. Every choice opens a new branch.',
};

export async function onRequest(context) {
  const { request, next } = context;
  const response = await next();

  // Only touch the landing page itself.
  const url = new URL(request.url);
  if (url.pathname !== '/' && url.pathname !== '/index.html') return response;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const country =
    (request.cf && request.cf.country) || request.headers.get('cf-ipcountry') || '';
  const lang = country === 'VN' ? 'vi' : 'en';

  let rewriter = new HTMLRewriter().on('html', {
    element(el) {
      el.setAttribute('lang', lang);
      el.setAttribute('data-lang', lang);
    },
  });

  if (lang === 'en') {
    rewriter = rewriter
      .on('title', { element(el) { el.setInnerContent(EN.title); } })
      .on('meta[name="description"]', { element(el) { el.setAttribute('content', EN.description); } })
      .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', EN.ogTitle); } })
      .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', EN.ogDescription); } });
  }

  const transformed = rewriter.transform(response);

  // Different content per country: keep caches from serving the wrong language.
  const headers = new Headers(transformed.headers);
  headers.set('Cache-Control', 'no-cache');
  const vary = headers.get('Vary');
  headers.set('Vary', vary ? `${vary}, CF-IPCountry` : 'CF-IPCountry');

  return new Response(transformed.body, {
    status: transformed.status,
    statusText: transformed.statusText,
    headers,
  });
}
