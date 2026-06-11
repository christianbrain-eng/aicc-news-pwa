const https = require('https')

const RSS_FEEDS = [
  // 한국 뉴스
  { url: 'https://news.google.com/rss/search?q=AICC+AI+컨택센터&hl=ko&gl=KR&ceid=KR:ko', category: '시장 뉴스' },
  { url: 'https://news.google.com/rss/search?q=AI+고객센터+상담+자동화&hl=ko&gl=KR&ceid=KR:ko', category: '시장 뉴스' },
  { url: 'https://news.google.com/rss/search?q=콜센터+AI+챗봇+보이스봇&hl=ko&gl=KR&ceid=KR:ko', category: '시장 뉴스' },

  // 글로벌 경쟁사 동향
  { url: 'https://news.google.com/rss/search?q=Genesys+contact+center+AI&hl=en&gl=US&ceid=US:en', category: '경쟁사 동향' },
  { url: 'https://news.google.com/rss/search?q=NICE+CXone+Mpower+AI&hl=en&gl=US&ceid=US:en', category: '경쟁사 동향' },
  { url: 'https://news.google.com/rss/search?q=Five9+Talkdesk+Salesforce+Agentforce+contact+center&hl=en&gl=US&ceid=US:en', category: '경쟁사 동향' },
  { url: 'https://news.google.com/rss/search?q=Amazon+Connect+Google+CCAI+Microsoft+contact+center&hl=en&gl=US&ceid=US:en', category: '경쟁사 동향' },

  // 글로벌 기술 트렌드
  { url: 'https://news.google.com/rss/search?q=agentic+AI+contact+center+CCaaS+2026&hl=en&gl=US&ceid=US:en', category: '기술 트렌드' },
  { url: 'https://news.google.com/rss/search?q=AI+voice+agent+LLM+customer+experience&hl=en&gl=US&ceid=US:en', category: '기술 트렌드' },
  { url: 'https://news.google.com/rss/search?q=contact+center+AI+automation+workforce&hl=en&gl=US&ceid=US:en', category: '기술 트렌드' },

  // 전문 미디어 RSS
  { url: 'https://www.cxtoday.com/feed/', category: '경쟁사 동향' },
  { url: 'https://www.nojitter.com/rss.xml', category: '기술 트렌드' },
  { url: 'https://feeds.feedburner.com/cxnetwork', category: '시장 뉴스' },
]

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http')
    const req = mod.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

function parseRSS(xml, category, feedUrl) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const get = (tag) => {
      const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`))
      return m ? (m[1] || m[2] || '').trim() : ''
    }
    const title = get('title')
    const link = get('link') || get('guid')
    const desc = get('description').replace(/<[^>]*>/g, '').slice(0, 200)
    const pubDate = get('pubDate')
    const source = get('source') || new URL(feedUrl).hostname.replace('www.', '')
    if (!title || !link) continue
    let date = ''
    try { date = new Date(pubDate).toISOString().slice(0, 10) } catch {}
    items.push({
      id: `rss-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      summary: desc,
      url: link,
      date,
      source,
      importance: '중간',
      category,
      trendTags: [],
      relatedLinks: [],
      sourceType: '미디어/분석',
      researchPriority: '중간',
    })
  }
  return items
}

exports.handler = async () => {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async ({ url, category }) => {
      const xml = await fetchUrl(url)
      return parseRSS(xml, category, url)
    })
  )

  const articles = results
    .flatMap(r => r.status === 'fulfilled' ? r.value : [])
    .filter(a => a.title && a.url)

  // 중복 제거 (URL 기준), 최신순 정렬
  const seen = new Set()
  const unique = articles
    .filter(a => {
      if (seen.has(a.url)) return false
      seen.add(a.url)
      return true
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ articles: unique }),
  }
}
