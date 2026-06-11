const https = require('https')

// 크롤링할 RSS 피드 목록
const RSS_FEEDS = [
  // 구글 뉴스 - AICC/AI 컨택센터 관련
  'https://news.google.com/rss/search?q=AICC+AI+컨택센터&hl=ko&gl=KR&ceid=KR:ko',
  'https://news.google.com/rss/search?q=AI+고객센터+상담+자동화&hl=ko&gl=KR&ceid=KR:ko',
  'https://news.google.com/rss/search?q=콜센터+AI+챗봇+보이스봇&hl=ko&gl=KR&ceid=KR:ko',
  'https://news.google.com/rss/search?q=Genesys+NICE+Five9+contact+center+AI&hl=en&gl=US&ceid=US:en',
  'https://news.google.com/rss/search?q=agentic+AI+contact+center+2026&hl=en&gl=US&ceid=US:en',
  // CX Today RSS
  'https://www.cxtoday.com/feed/',
  // No Jitter RSS
  'https://www.nojitter.com/rss.xml',
]

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http')
    const req = mod.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      // 리다이렉트 처리
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

function parseRSS(xml, feedUrl) {
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
    const isKo = feedUrl.includes('hl=ko') || feedUrl.includes('ceid=KR')
    items.push({
      id: `rss-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      summary: desc,
      url: link,
      date,
      source,
      importance: '중간',
      category: isKo ? '시장 뉴스' : '경쟁사 동향',
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
    RSS_FEEDS.map(async (feed) => {
      const xml = await fetchUrl(feed)
      return parseRSS(xml, feed)
    })
  )

  const articles = results
    .flatMap(r => r.status === 'fulfilled' ? r.value : [])
    .filter(a => a.title && a.url)

  // 중복 제거 (URL 기준)
  const seen = new Set()
  const unique = articles.filter(a => {
    if (seen.has(a.url)) return false
    seen.add(a.url)
    return true
  })

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ articles: unique }),
  }
}
