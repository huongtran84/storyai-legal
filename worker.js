// Landing-page language by visitor country: VN -> vi, ID -> id, JP -> ja, elsewhere -> en.
// Only "/" and "/index.html" reach this Worker (see run_worker_first in
// wrangler.jsonc); all other assets are served directly. Everything is wrapped
// so that any failure falls back to serving the untransformed asset.

const L10N = {
  en: {
    title: 'StoryAI · You choose. AI weaves the tale.',
    description:
      'StoryAI — an interactive AI storytelling app. Every choice you make leads AI to write a different story. Romance, horror, fantasy, school life.',
    ogTitle: 'StoryAI · You choose. AI weaves the tale.',
    ogDescription: 'An interactive AI storytelling app. Every choice opens a new branch.',
  },
  id: {
    title: 'StoryAI · Kamu memilih. AI merangkai cerita.',
    description:
      'StoryAI — aplikasi cerita AI interaktif. Setiap pilihanmu membuat AI menulis cerita yang berbeda. Romansa, horor, fantasi, drama sekolah.',
    ogTitle: 'StoryAI · Kamu memilih. AI merangkai cerita.',
    ogDescription: 'Aplikasi cerita AI interaktif. Setiap pilihan membuka cabang baru.',
  },
  ja: {
    title: 'StoryAI · 選ぶのはあなた。紡ぐのはAI。',
    description:
      'StoryAI — インタラクティブAIストーリーアプリ。あなたの選択でAIが異なる物語を書き続けます。恋愛、ホラー、ファンタジー、学園ドラマ。',
    ogTitle: 'StoryAI · 選ぶのはあなた。紡ぐのはAI。',
    ogDescription: 'インタラクティブAIストーリーアプリ。選ぶたびに新しい分岐が開く。',
  },
};

export default {
  async fetch(request, env) {
    const assetResponse = await env.ASSETS.fetch(request);
    try {
      // Defense in depth: only ever transform the landing page, no matter how
      // routing is configured. Legal pages / assets always pass through as-is.
      const path = new URL(request.url).pathname;
      if (path !== '/' && path !== '/index.html') return assetResponse;

      const contentType = assetResponse.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) return assetResponse;

      const country =
        (request.cf && request.cf.country) || request.headers.get('cf-ipcountry') || '';
      const lang = { VN: 'vi', ID: 'id', JP: 'ja' }[country] || 'en';

      let rewriter = new HTMLRewriter().on('html', {
        element(el) {
          el.setAttribute('lang', lang);
          el.setAttribute('data-lang', lang);
        },
      });

      const meta = L10N[lang];
      if (meta) {
        rewriter = rewriter
          .on('title', { element(el) { el.setInnerContent(meta.title); } })
          .on('meta[name="description"]', { element(el) { el.setAttribute('content', meta.description); } })
          .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', meta.ogTitle); } })
          .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', meta.ogDescription); } });
      }

      const transformed = rewriter.transform(assetResponse);

      // Per-country content: don't let a shared cache serve the wrong language.
      const headers = new Headers(transformed.headers);
      headers.set('Cache-Control', 'no-cache');
      const vary = headers.get('Vary');
      headers.set('Vary', vary ? `${vary}, CF-IPCountry` : 'CF-IPCountry');

      return new Response(transformed.body, {
        status: transformed.status,
        statusText: transformed.statusText,
        headers,
      });
    } catch (e) {
      // Never break serving on a transform error.
      return assetResponse;
    }
  },
};
