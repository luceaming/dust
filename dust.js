// ==============================================================================
// Vercel Serverless Function: 에어코리아 대기오염 오픈 API 프록시 엔드포인트
// ==============================================================================

/**
 * Vercel 서버리스 요청 핸들러 함수입니다.
 * @param {import('@vercel/node').VercelRequest} req - 클라이언트 요청 객체
 * @param {import('@vercel/node').VercelResponse} res - 서버 응답 객체
 */
module.exports = async function handler(req, res) {
  // CORS 및 캐시 제어 헤더를 설정합니다. (브라우저 접근 허용 및 5분간 캐싱)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

  // GET 요청이 아닌 경우 405 Method Not Allowed를 반환합니다.
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET 요청만 지원합니다.' });
  }

  // 쿼리스트링에서 시도 이름(sido)을 추출하며, 전달되지 않은 경우 기본값으로 '서울'을 사용합니다.
  const sido = (req.query.sido || '서울').trim();

  // 환경변수(process.env.AIRKOREA_KEY)에서 에어코리아 인증키를 읽어옵니다.
  const serviceKey = process.env.AIRKOREA_KEY;

  // 서버 환경변수에 인증키가 설정되지 않은 경우 오류를 반환합니다.
  if (!serviceKey) {
    return res.status(500).json({
      error: '서버 환경변수(AIRKOREA_KEY)가 설정되지 않았습니다. .env.local 또는 Vercel 환경변수 설정을 확인해주세요.'
    });
  }

  try {
    // 사용자가 Decoding 키 또는 Encoding 키 중 무엇을 넣어도 작동하도록 정규화합니다.
    const rawKey = serviceKey.trim();
    const cleanKey = rawKey.includes('%') ? decodeURIComponent(rawKey) : rawKey;
    const encodedKey = encodeURIComponent(cleanKey);

    // 공공데이터포털 에어코리아 실시간 시도별 측정정보 API 요청 URL을 생성합니다.
    const apiUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${encodedKey}&returnType=json&numOfRows=100&pageNo=1&ver=1.3&sidoName=${encodeURIComponent(sido)}`;

    // 공공데이터포털 서버로 비동기 GET 요청을 전송합니다.
    const apiResponse = await fetch(apiUrl);

    // 원본 응답 텍스트를 문자열로 먼저 수신합니다.
    const responseText = await apiResponse.text();

    // 응답이 JSON 형식이 아닌 XML 태그(예: <OpenAPI_ServiceResponse>)로 시작하는 경우 예외 처리합니다.
    if (responseText.trim().startsWith('<')) {
      return res.status(400).json({
        error: '인증키 또는 요청값을 확인해주세요'
      });
    }

    // 수신한 응답 텍스트를 JSON 객체로 파싱합니다.
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      // JSON 파싱 실패 시에도 인증키 또는 요청값 오류 메시지를 반환합니다.
      return res.status(400).json({
        error: '인증키 또는 요청값을 확인해주세요'
      });
    }

    // 공공데이터 API 응답 헤더의 결과 코드 및 메시지를 확인합니다.
    const header = data?.response?.header;
    const resultCode = header?.resultCode;
    const resultMsg = header?.resultMsg || '알 수 없는 오류';

    // resultCode가 성공('00' 또는 '0')이 아닌 경우 한국어 안내 메시지를 반환합니다.
    if (resultCode !== '00' && resultCode !== '0') {
      return res.status(400).json({
        error: `공공데이터 API 오류가 발생했습니다: ${resultMsg} (오류 코드: ${resultCode})`
      });
    }

    // 성공한 대기오염 데이터 JSON을 클라이언트에 200 OK 상태로 전달합니다.
    return res.status(200).json(data);

  } catch (error) {
    // 서버 내부 오류 발생 시 콘솔 로그를 남기고 에러 메시지를 반환합니다.
    console.error('Vercel 서버리스 함수 처리 중 에러:', error);
    return res.status(500).json({
      error: `서버 내부 처리 중 오류가 발생했습니다: ${error.message}`
    });
  }
};

