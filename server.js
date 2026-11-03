// ==============================================================================
// Vercel 배포 및 로컬 실행을 위한 단일 통합 서버 엔트리포인트 (server.js)
// ==============================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// [1] 로컬 테스트 환경 시 .env.local 파일에서 인증키 로드
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        process.env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
      }
    }
  });
}

// MIME 타입 매핑 정의
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

/**
 * [2] Vercel 서버리스 및 로컬 HTTP 공용 요청 핸들러 함수
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
async function handler(req, res) {
  // CORS 및 캐시 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // -------------------------------------------------------------
  // [A] 에어코리아 대기오염 API 엔드포인트 (/api/dust)
  // -------------------------------------------------------------
  if (pathname === '/api/dust' || pathname === '/api/dust.js') {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'GET 요청만 지원합니다.' }));
    }

    const sido = (parsedUrl.query.sido || '서울').trim();
    const serviceKey = process.env.AIRKOREA_KEY;

    if (!serviceKey) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({
        error: '서버 환경변수(AIRKOREA_KEY)가 설정되지 않았습니다. Vercel Settings > Environment Variables를 확인해주세요.'
      }));
    }

    try {
      const rawKey = serviceKey.trim();
      const cleanKey = rawKey.includes('%') ? decodeURIComponent(rawKey) : rawKey;
      const encodedKey = encodeURIComponent(cleanKey);

      const apiUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${encodedKey}&returnType=json&numOfRows=100&pageNo=1&ver=1.3&sidoName=${encodeURIComponent(sido)}`;

      const apiRes = await fetch(apiUrl);
      const text = await apiRes.text();

      // 공공데이터포털 XML 에러 반환 체크
      if (text.trim().startsWith('<')) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: '인증키 또는 요청값을 확인해주세요' }));
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ error: '인증키 또는 요청값을 확인해주세요' }));
      }

      const resultCode = data?.response?.header?.resultCode;
      const resultMsg = data?.response?.header?.resultMsg || '알 수 없는 오류';

      if (resultCode !== '00' && resultCode !== '0') {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({
          error: `공공데이터 API 오류: ${resultMsg} (코드: ${resultCode})`
        }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(data));

    } catch (err) {
      console.error('API 처리 에러:', err);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: `서버 내부 오류: ${err.message}` }));
    }
  }

  // -------------------------------------------------------------
  // [B] 정적 웹 파일 서빙 (index.html, style.css, script.js 등)
  // -------------------------------------------------------------
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(path.join(__dirname, reqPath));

  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(safePath).pipe(res);
  });
}

// [3] Vercel의 Node.js 빌더가 직접 호출할 수 있도록 핸들러 함수를 내보냅니다.
module.exports = handler;

// [4] 로컬 컴퓨터에서 `node server.js`로 직접 실행할 때 3000번 포트로 구동
if (require.main === module) {
  const PORT = 3000;
  const server = http.createServer(handler);

  server.listen(PORT, () => {
    const localUrl = `http://localhost:${PORT}`;
    console.log(`=================================================`);
    console.log(`🚀 대기오염 웹앱이 성공적으로 실행되었습니다!`);
    console.log(`👉 웹 브라우저를 자동으로 실행합니다: ${localUrl}`);
    console.log(`종료하려면 이 창을 닫으시거나 Ctrl + C 를 누르세요.`);
    console.log(`=================================================`);

    try {
      const { exec } = require('child_process');
      exec(`start ${localUrl}`);
    } catch (e) {}
  });
}
