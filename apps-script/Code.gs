const BRIEFING = {
  recipient: 'wlrtm4723@pusan.ac.kr',
  timezone: 'Asia/Seoul',
  symbols: [
    ['S&P 500', '^GSPC'], ['나스닥 종합', '^IXIC'], ['다우 존스', '^DJI'],
    ['러셀 2000', '^RUT'], ['나스닥 100', '^NDX'], ['필라델피아 반도체', '^SOX'],
    ['TQQQ', 'TQQQ'], ['VIX', '^VIX'], ['미 10년물 국채 금리', '^TNX']
  ]
};

// 처음 한 번 실행하고 Google 권한 요청을 승인합니다. 시험 메일은 보내지 않습니다.
function setupBriefing() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(BRIEFING.recipient)) {
    throw new Error('수신 이메일 주소를 확인해 주세요.');
  }
  if (MailApp.getRemainingDailyQuota() < 1) throw new Error('오늘의 메일 발송 한도를 다 썼습니다.');
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'checkAndSendBriefing') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('checkAndSendBriefing').timeBased().everyMinutes(1).create();
  console.log('설정 완료: 서울 08:00 이후 첫 실행에 하루 한 번 발송합니다. 수신: ' + BRIEFING.recipient);
}

function isBriefingDue(now, lastDate, pendingDate) {
  const date = Utilities.formatDate(now, BRIEFING.timezone, 'yyyy-MM-dd');
  const hour = Utilities.formatDate(now, BRIEFING.timezone, 'HH');
  return hour === '08' && lastDate !== date && pendingDate !== date;
}

function checkAndSendBriefing() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const properties = PropertiesService.getScriptProperties();
    const now = new Date();
    const date = Utilities.formatDate(now, BRIEFING.timezone, 'yyyy-MM-dd');
    if (!isBriefingDue(now, properties.getProperty('LAST_SENT_DATE'), properties.getProperty('PENDING_DATE'))) return;
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error('메일 발송 한도 부족');
    const message = buildBriefing(now);
    // 전송 결과가 불확실한 경우 같은 날 자동 재전송하지 않아 중복을 방지합니다.
    properties.setProperty('PENDING_DATE', date);
    MailApp.sendEmail(message);
    properties.setProperty('LAST_SENT_DATE', date);
    properties.deleteProperty('PENDING_DATE');
    console.log('발송 완료: ' + date);
  } finally {
    lock.releaseLock();
  }
}

function fetchText(url) {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: {'User-Agent': 'MorningBriefing/1.0', 'Cache-Control': 'no-cache'}
  });
  if (response.getResponseCode() !== 200) throw new Error('HTTP ' + response.getResponseCode());
  return response.getContentText('UTF-8');
}

function fetchMarket() {
  return BRIEFING.symbols.map(function(entry) {
    try {
      const data = JSON.parse(fetchText('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(entry[1])));
      const meta = data.chart.result[0].meta;
      const price = meta.regularMarketPrice;
      const previous = meta.previousClose == null ? meta.chartPreviousClose : meta.previousClose;
      if (![price, previous].every(function(n) { return typeof n === 'number' && Number.isFinite(n) && n > 0; })) {
        throw new Error('유효한 가격 데이터가 없습니다');
      }
      return {name: entry[0], price: price, diff: price - previous, pct: (price - previous) / previous * 100};
    } catch (error) {
      console.warn(entry[0] + ': ' + error.message);
      return {name: entry[0], failed: true};
    }
  });
}

function fetchNews() {
  return [['사회', 'NATION'], ['IT/기술', 'SCITECH'], ['경제', 'BUSINESS']].map(function(entry) {
    try {
      const xml = fetchText('https://news.google.com/rss/headlines/section/topic/' + entry[1] + '?hl=ko&gl=KR&ceid=KR:ko');
      const item = XmlService.parse(xml).getRootElement().getChild('channel').getChild('item');
      const title = item.getChildText('title');
      const link = item.getChildText('link');
      if (!title || !/^https?:\/\//i.test(link || '')) throw new Error('뉴스 데이터 누락');
      return {category: entry[0], title: title, link: link};
    } catch (error) {
      console.warn(entry[0] + ': ' + error.message);
      return {category: entry[0], title: '뉴스 조회 실패', link: null};
    }
  });
}

function fetchQuote() {
  let quotes = [];
  ['life_advice.json', 'motivation_advice.json', 'etc_advice.json'].forEach(function(file) {
    try {
      const data = JSON.parse(fetchText('https://raw.githubusercontent.com/chkim116/kadvice/master/scripts/fixtures/' + file));
      if (!Array.isArray(data)) throw new Error('명언 목록 오류');
      quotes = quotes.concat(data.filter(function(item) {
        return item && typeof item.message === 'string' && item.message.trim();
      }));
    } catch (error) { console.warn('명언: ' + error.message); }
  });
  if (!quotes.length) return {message: '오늘은 명언을 불러오지 못했어요.', author: '명언 서비스 안내'};
  const item = quotes[Math.floor(Math.random() * quotes.length)];
  return {message: item.message, author: typeof item.author === 'string' ? item.author : '작자 미상'};
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function(c) {
    return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c];
  });
}

function marketText(item) {
  if (item.failed) return '조회 실패';
  const unit = item.name === '미 10년물 국채 금리' ? '%' : '';
  return item.price.toFixed(2) + unit + ' (' + (item.pct >= 0 ? '+' : '') + item.pct.toFixed(2) + '%)';
}

function buildBriefing(now) {
  const date = Utilities.formatDate(now, BRIEFING.timezone, 'yyyy.MM.dd');
  const news = fetchNews();
  const market = fetchMarket();
  const quote = fetchQuote();
  const cheer = '오늘도 네 속도로 하나씩 해보자. 상엽아, 좋은 하루 보내!';
  const body = '[아침 브리핑] ' + date + '\n\n오늘의 뉴스\n' + news.map(function(n) {
    return '[' + n.category + '] ' + n.title + (n.link ? '\n' + n.link : '');
  }).join('\n\n') + '\n\n해외 증시\n' + market.map(function(m) {
    return m.name + ': ' + marketText(m);
  }).join('\n') + '\n\n오늘의 명언\n' + quote.message + '\n— ' + quote.author + '\n\n' + cheer;
  const rows = market.map(function(m) {
    return '<tr><td style="padding:8px;border-bottom:1px solid #eee">' + escapeHtml(m.name) +
      '</td><td style="padding:8px;border-bottom:1px solid #eee">' + escapeHtml(marketText(m)) + '</td></tr>';
  }).join('');
  const chartItems = market.filter(function(m) { return !m.failed && !['VIX', '미 10년물 국채 금리'].includes(m.name); });
  const chartConfig = {type: 'bar', data: {labels: chartItems.map(function(m) { return m.name; }), datasets: [{
    label: '등락률 (%)', data: chartItems.map(function(m) { return Number(m.pct.toFixed(2)); }),
    backgroundColor: chartItems.map(function(m) { return m.pct >= 0 ? '#ef4444' : '#3b82f6'; })
  }]}};
  const chart = chartItems.length ? '<img style="max-width:100%" alt="증시 등락률" src="' +
    escapeHtml('https://quickchart.io/chart?w=600&h=260&bkg=white&c=' + encodeURIComponent(JSON.stringify(chartConfig))) + '">' :
    '<p>증시 데이터 조회 실패로 그래프를 표시할 수 없습니다.</p>';
  const html = '<div style="max-width:640px;margin:auto;font-family:sans-serif;color:#222;line-height:1.7">' +
    '<div style="background:#1e3a8a;color:white;padding:24px"><h1>상엽의 아침 브리핑</h1>' + date + '</div>' +
    '<div style="padding:24px"><h2>오늘의 뉴스</h2>' + news.map(function(n) {
      return '<p><strong>[' + escapeHtml(n.category) + '] ' + escapeHtml(n.title) + '</strong>' +
        (n.link ? '<br><a href="' + escapeHtml(n.link) + '">관련 보도 원문 보기</a>' : '') + '</p>';
    }).join('') + '<h2>해외 증시</h2><p>Yahoo Finance 최신 조회 시세 · 휴장 시 최근 거래일 수치</p>' +
    '<table style="width:100%;border-collapse:collapse">' + rows + '</table>' + chart +
    '<h2>오늘의 명언</h2><blockquote>' + escapeHtml(quote.message) + '<br>— ' + escapeHtml(quote.author) +
    '</blockquote><p>' + escapeHtml(cheer) + '</p></div></div>';
  return {to: BRIEFING.recipient, subject: '[상엽의 아침 브리핑] ' + date, body: body, htmlBody: html, name: '상엽의 아침 브리핑'};
}

// 직접 실행할 때만 실제 메일 한 통을 보냅니다. 자동 발송 기록에는 영향을 주지 않습니다.
function sendTestBriefing() {
  MailApp.sendEmail(buildBriefing(new Date()));
}
