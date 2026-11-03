// ==============================================================================
// 실시간 공기신호등, 공기지도, 막대그래프 통합 클라이언트 스크립트
// ==============================================================================

// [1] Vercel 서버리스 API 엔드포인트 상대 경로입니다.
const API_BASE_URL = '/api/dust';

// [2] 전역 인스턴스 관리 변수들 (Chart.js 및 Leaflet 지도/마커 레이어)
let dustChartInstance = null; // 막대그래프 인스턴스
let airMapInstance = null;    // Leaflet 지도 인스턴스
let markersLayerGroup = null; // 지도 마커 레이어 그룹

// [3] 대한민국 시·도별 중심 위경도 및 기본 줌 레벨 [위도, 경도, 줌레벨]
const REGION_CENTERS = {
  '전국': [36.2000, 127.8000, 7],
  '서울': [37.5665, 126.9780, 11],
  '부산': [35.1796, 129.0756, 11],
  '대구': [35.8714, 128.6014, 11],
  '인천': [37.4563, 126.7052, 11],
  '광주': [35.1595, 126.8526, 12],
  '대전': [36.3504, 127.3845, 12],
  '울산': [35.5384, 129.3114, 11],
  '세종': [36.4800, 127.2890, 12],
  '경기': [37.4138, 127.5183, 9],
  '강원': [37.8228, 128.1555, 9],
  '충북': [36.6357, 127.4912, 9],
  '충남': [36.5184, 126.8000, 9],
  '전북': [35.7175, 127.1530, 9],
  '전남': [34.8679, 126.9910, 9],
  '경북': [36.4919, 128.8889, 9],
  '경남': [35.4606, 128.2132, 9],
  '제주': [33.4996, 126.5312, 10]
};

// [4] 전국 주요 측정소 표준 위경도 좌표 데이터베이스 (별도 API 호출 없이 즉시 표시)
const STATION_COORDINATES = {
  // 서울특별시 (25개 자치구 측정소)
  '종로구': { lat: 37.5720, lng: 127.0050 }, '중구': { lat: 37.5642, lng: 126.9975 },
  '용산구': { lat: 37.5326, lng: 126.9900 }, '성동구': { lat: 37.5635, lng: 127.0368 },
  '광진구': { lat: 37.5385, lng: 127.0823 }, '동대문구': { lat: 37.5744, lng: 127.0398 },
  '중랑구': { lat: 37.6065, lng: 127.0927 }, '성북구': { lat: 37.5891, lng: 127.0182 },
  '강북구': { lat: 37.6382, lng: 127.0255 }, '도봉구': { lat: 37.6542, lng: 127.0450 },
  '노원구': { lat: 37.6552, lng: 127.0568 }, '은평구': { lat: 37.6027, lng: 126.9291 },
  '서대문구': { lat: 37.5791, lng: 126.9368 }, '마포구': { lat: 37.5508, lng: 126.9082 },
  '양천구': { lat: 37.5169, lng: 126.8665 }, '강서구': { lat: 37.5509, lng: 126.8495 },
  '구로구': { lat: 37.4954, lng: 126.8874 }, '금천구': { lat: 37.4568, lng: 126.8956 },
  '영등포구': { lat: 37.5260, lng: 126.8963 }, '동작구': { lat: 37.5124, lng: 126.9393 },
  '관악구': { lat: 37.4784, lng: 126.9516 }, '서초구': { lat: 37.5048, lng: 127.0050 },
  '강남구': { lat: 37.5172, lng: 127.0473 }, '송파구': { lat: 37.5145, lng: 127.1058 },
  '강동구': { lat: 37.5301, lng: 127.1238 }, '정릉로': { lat: 37.6035, lng: 127.0118 },
  '청계천로': { lat: 37.5701, lng: 127.0041 }, '도산대로': { lat: 37.5218, lng: 127.0371 },
  '강변북로': { lat: 37.5342, lng: 126.9750 },

  // 부산광역시
  '광복동': { lat: 35.0998, lng: 129.0305 }, '초량동': { lat: 35.1189, lng: 129.0422 },
  '태종대': { lat: 35.0531, lng: 129.0825 }, '전포동': { lat: 35.1552, lng: 129.0632 },
  '온천동': { lat: 35.2114, lng: 129.0784 }, '명장동': { lat: 35.2052, lng: 129.1021 },
  '대연동': { lat: 35.1365, lng: 129.0905 }, '학장동': { lat: 35.1384, lng: 128.9885 },
  '덕천동': { lat: 35.2104, lng: 129.0064 }, '기장읍': { lat: 35.2445, lng: 129.2148 },
  '녹산동': { lat: 35.1485, lng: 128.8574 }, '장림동': { lat: 35.0824, lng: 128.9685 },
  '좌동': { lat: 35.1702, lng: 129.1754 },

  // 대구광역시
  '수창동': { lat: 35.8752, lng: 128.5874 }, '지산동': { lat: 35.8285, lng: 128.6385 },
  '서호동': { lat: 35.8698, lng: 128.7052 }, '이현동': { lat: 35.8745, lng: 128.5385 },
  '대명동': { lat: 35.8425, lng: 128.5752 }, '노원동': { lat: 35.8924, lng: 128.5714 },
  '신암동': { lat: 35.8814, lng: 128.6185 }, '진천동': { lat: 35.8152, lng: 128.5245 },

  // 인천광역시
  '신흥': { lat: 37.4642, lng: 126.6345 }, '숭의': { lat: 37.4614, lng: 126.6585 },
  '구월동': { lat: 37.4502, lng: 126.7085 }, '옥련동': { lat: 37.4245, lng: 126.6542 },
  '부평동': { lat: 37.4985, lng: 126.7245 }, '석남동': { lat: 37.5024, lng: 126.6745 },
  '계산': { lat: 37.5385, lng: 126.7285 }, '송도': { lat: 37.3852, lng: 126.6542 },
  '청라': { lat: 37.5342, lng: 126.6485 }, '영종': { lat: 37.4912, lng: 126.4985 },

  // 광주광역시
  '농성동': { lat: 35.1524, lng: 126.8852 }, '광산동': { lat: 35.1452, lng: 126.9214 },
  '두암동': { lat: 35.1685, lng: 126.9324 }, '치평동': { lat: 35.1554, lng: 126.8521 },
  '송정1동': { lat: 35.1385, lng: 126.7924 }, '오선동': { lat: 35.2045, lng: 126.8124 },

  // 대전광역시
  '문창동': { lat: 36.3185, lng: 127.4324 }, '읍내동': { lat: 36.3752, lng: 127.4214 },
  '정림동': { lat: 36.3085, lng: 127.3685 }, '구성동': { lat: 36.3702, lng: 127.3614 },
  '노은동': { lat: 36.3724, lng: 127.3214 },

  // 울산광역시
  '신정동': { lat: 35.5352, lng: 129.3124 }, '무거동': { lat: 35.5512, lng: 129.2585 },
  '야음동': { lat: 35.5185, lng: 129.3324 }, '효문동': { lat: 35.5785, lng: 129.3614 },

  // 세종특별자치시
  '신흥동': { lat: 36.5985, lng: 127.2914 }, '아름동': { lat: 36.5124, lng: 127.2485 },
  '보람동': { lat: 36.4852, lng: 127.2945 },

  // 경기도 주요 측정소
  '신원동': { lat: 37.4985, lng: 127.4952 }, '고산동': { lat: 37.7124, lng: 127.0985 },
  '단원구': { lat: 37.3214, lng: 126.8324 }, '상록구': { lat: 37.3085, lng: 126.8514 },
  '호계동': { lat: 37.3824, lng: 126.9585 }, '안양동': { lat: 37.4012, lng: 126.9245 },
  '백마로': { lat: 37.6612, lng: 126.7845 }, '주엽동': { lat: 37.6714, lng: 126.7612 },
  '정자동': { lat: 37.3652, lng: 127.1124 }, '수내동': { lat: 37.3785, lng: 127.1245 },
  '복정동': { lat: 37.4612, lng: 127.1324 }, '기흥': { lat: 37.2812, lng: 127.1124 },
  '처인구': { lat: 37.2345, lng: 127.2012 }, '수지': { lat: 37.3214, lng: 127.0985 },
  '인계동': { lat: 37.2652, lng: 127.0324 }, '영통동': { lat: 37.2512, lng: 127.0712 },
  '천천동': { lat: 37.2985, lng: 126.9852 }, '광교동': { lat: 37.2985, lng: 127.0452 },

  // 강원특별자치도
  '중앙로': { lat: 37.8812, lng: 127.7285 }, '석사동': { lat: 37.8542, lng: 127.7452 },
  '명륜동': { lat: 37.3412, lng: 127.9485 }, '옥천동': { lat: 37.7542, lng: 128.8985 },

  // 충북, 충남
  '용암동': { lat: 36.6124, lng: 127.5012 }, '사직동': { lat: 36.6345, lng: 127.4785 },
  '성성동': { lat: 36.8485, lng: 127.1385 }, '신방동': { lat: 36.7845, lng: 127.1214 },

  // 전북, 전남
  '삼천동': { lat: 35.8012, lng: 127.1185 }, '팔복동': { lat: 35.8542, lng: 127.0985 },
  '용당동': { lat: 34.8012, lng: 126.3985 }, '순천만': { lat: 34.9214, lng: 127.5085 },
  '여서동': { lat: 34.7585, lng: 127.6985 },

  // 경북, 경남
  '장량동': { lat: 36.0712, lng: 129.3785 }, '대송면': { lat: 35.9812, lng: 129.3685 },
  '성건동': { lat: 35.8485, lng: 129.2124 }, '상남동': { lat: 35.2214, lng: 128.6812 },
  '봉암동': { lat: 35.2012, lng: 128.6124 }, '삼천포': { lat: 34.9312, lng: 128.0712 },

  // 제주특별자치도
  '이도동': { lat: 33.4985, lng: 126.5312 }, '연동': { lat: 33.4885, lng: 126.4985 },
  '동홍동': { lat: 33.2542, lng: 126.5685 }, '성산읍': { lat: 33.3852, lng: 126.8812 },
  '대정읍': { lat: 33.2245, lng: 126.2512 }
};

// [5] HTML 문서 내 주요 DOM 요소들을 탐색하여 변수에 저장합니다.
const sidoSelect = document.getElementById('sidoSelect'); // 시·도 선택 드롭다운
const selectedRegionName = document.getElementById('selectedRegionName'); // 공기신호등 지역명
const mapRegionName = document.getElementById('mapRegionName'); // 공기지도 지역명
const chartRegionName = document.getElementById('chartRegionName'); // 차트 제목 지역명
const trafficDashboard = document.getElementById('trafficDashboard'); // 공기신호등 섹션
const trafficEmoji = document.getElementById('trafficEmoji'); // 신호등 대형 이모지 요소
const trafficGradeText = document.getElementById('trafficGradeText'); // 신호등 상태 텍스트
const trafficAverageValue = document.getElementById('trafficAverageValue'); // 신호등 평균 미세먼지 수치
const actionAdvice = document.getElementById('actionAdvice'); // 한 줄 안내 문구
const latestTimeInfo = document.getElementById('latestTimeInfo'); // 최신 측정 기준시각 문구
const chartSection = document.getElementById('chartSection'); // 막대그래프 섹션
const cardContainer = document.getElementById('cardContainer'); // 측정소 카드 그리드 컨테이너
const loadingMessage = document.getElementById('loadingMessage'); // 로딩 안내 메시지 요소
const errorMessage = document.getElementById('errorMessage'); // 에러 안내 메시지 요소
const errorText = document.getElementById('errorText'); // 에러 상세 텍스트 요소

// [6] 공기신호등 상태 설정
const TRAFFIC_CONFIG = {
  good: { emoji: '🔵', text: '좋음', advice: '공기가 맑고 쾌적해요! 환기하기 좋은 날입니다.', themeClass: 'signal-good' },
  normal: { emoji: '🟢', text: '보통', advice: '무난한 공기질이에요. 일상적인 야외활동이 가능해요.', themeClass: 'signal-normal' },
  bad: { emoji: '🟠', text: '나쁨', advice: '외출 시 마스크를 챙기세요! 😷', themeClass: 'signal-bad' },
  veryBad: { emoji: '🔴', text: '매우나쁨', advice: '외출 시 마스크를 챙기세요! 실외활동은 자제하세요. 🚨', themeClass: 'signal-very-bad' },
  unknown: { emoji: '⚪', text: '측정안됨', advice: '측정된 공기질 정보가 없습니다.', themeClass: 'signal-unknown' }
};

// [7] 등급별 스타일 및 얼굴/마스크/방독면 매핑 정보
const GRADE_STYLE_MAP = {
  '1': { cardClass: 'card-good', text: '좋음', chartBg: 'rgba(37, 99, 235, 0.85)', chartBorder: '#1d4ed8', face: '😊', pinClass: 'pin-good' },       // 좋음: 기본 얼굴 😊
  '2': { cardClass: 'card-normal', text: '보통', chartBg: 'rgba(16, 185, 129, 0.85)', chartBorder: '#047857', face: '🙂', pinClass: 'pin-normal' },    // 보통: 기본 얼굴 🙂
  '3': { cardClass: 'card-bad', text: '나쁨', chartBg: 'rgba(245, 158, 11, 0.85)', chartBorder: '#b45309', face: '😷', pinClass: 'pin-bad' },          // 나쁨: 마스크 😷
  '4': { cardClass: 'card-very-bad', text: '매우나쁨', chartBg: 'rgba(239, 68, 68, 0.85)', chartBorder: '#b91c1c', face: '🤿', pinClass: 'pin-very-bad' }, // 매우나쁨: 방독면 🤿
  unknown: { cardClass: 'card-unknown', text: '측정안됨', chartBg: 'rgba(148, 163, 184, 0.85)', chartBorder: '#64748b', face: '⚪', pinClass: 'pin-unknown' }
};

// [8] 페이지 초기화 시 지도 생성 및 데이터 조회 시작
document.addEventListener('DOMContentLoaded', () => {
  // Leaflet 지도 초기화
  initLeafletMap();
  // 초기 지역(서울) 대기오염 데이터 조회
  fetchAirQualityData(sidoSelect.value);
});

// [9] 시·도 드롭다운 변경 시 지도 이동 및 새 데이터 조회
sidoSelect.addEventListener('change', (e) => {
  const selectedSido = e.target.value;
  updateMapCenter(selectedSido);
  fetchAirQualityData(selectedSido);
});

/**
 * [10] Leaflet 오픈스트리트맵 지도를 초기화하는 함수입니다.
 */
function initLeafletMap() {
  const [lat, lng, zoom] = REGION_CENTERS['서울'];
  airMapInstance = L.map('airMap', {
    center: [lat, lng],
    zoom: zoom,
    scrollWheelZoom: false
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(airMapInstance);

  markersLayerGroup = L.layerGroup().addTo(airMapInstance);
}

/**
 * [11] 선택된 시도에 맞추어 지도의 중심 위치를 이동합니다.
 * @param {string} sido - 시·도 이름
 */
function updateMapCenter(sido) {
  if (!airMapInstance) return;
  const target = REGION_CENTERS[sido] || REGION_CENTERS['전국'];
  airMapInstance.setView([target[0], target[1]], target[2], { animate: true, duration: 0.8 });
}

/**
 * [12] Vercel 서버리스 함수(/api/dust?sido=지역명)를 호출하여 대기오염 데이터를 받아옵니다.
 * @param {string} sido - 조회할 시·도 이름
 */
async function fetchAirQualityData(sido = '서울') {
  selectedRegionName.textContent = sido;
  mapRegionName.textContent = sido;
  chartRegionName.textContent = sido;

  errorMessage.classList.add('hidden');
  loadingMessage.classList.remove('hidden');
  cardContainer.innerHTML = '';

  setLoadingState();

  try {
    const requestUrl = `${API_BASE_URL}?sido=${encodeURIComponent(sido)}`;
    const response = await fetch(requestUrl);
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || `서버 응답 오류 (상태 코드: ${response.status})`);
    }

    const items = data?.response?.body?.items || [];

    if (items.length === 0) {
      showError('해당 지역의 측정소 데이터가 없습니다.');
      setTrafficDisplay('unknown', '-', null);
      chartSection.classList.add('hidden');
      if (markersLayerGroup) markersLayerGroup.clearLayers();
      return;
    }

    // 1. 공기신호등 및 카드 렌더링
    renderTrafficAndCards(items);

    // 2. 가로 막대 그래프 렌더링
    renderTopStationsChart(items);

    // 3. 지도 위에 방독면, 마스크, 기본 얼굴 마커 표시
    renderAirMapMarkers(items);

  } catch (error) {
    console.error('공기질 데이터 조회 실패:', error);
    showError(error.message);
    setTrafficDisplay('unknown', '-', null);
    chartSection.classList.add('hidden');
    if (markersLayerGroup) markersLayerGroup.clearLayers();
  } finally {
    loadingMessage.classList.add('hidden');
  }
}

/**
 * [13] 로딩 중 UI 상태 초기화
 */
function setLoadingState() {
  trafficDashboard.className = 'traffic-dashboard signal-loading';
  trafficEmoji.textContent = '⏳';
  trafficGradeText.textContent = '불러오는 중...';
  trafficAverageValue.textContent = '-';
  actionAdvice.textContent = '불러오는 중...';
  latestTimeInfo.textContent = '';
  chartSection.classList.add('hidden');
}

/**
 * [14] 측정소 목록 데이터를 분석하여 공기신호등과 카드를 렌더링합니다.
 * @param {Array} items - 측정소 데이터 배열
 */
function renderTrafficAndCards(items) {
  let validPm10Sum = 0;
  let validPm10Count = 0;
  let latestTimeStr = '';

  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const stationName = item.stationName || '알 수 없는 측정소';
    const rawDataTime = item.dataTime || '';
    if (!latestTimeStr && rawDataTime) {
      latestTimeStr = rawDataTime;
    }

    const rawPm10 = item.pm10Value;
    const rawPm25 = item.pm25Value;
    const rawGrade = item.pm10Grade;

    const isPm10Valid = rawPm10 !== null && rawPm10 !== undefined && rawPm10 !== '-' && rawPm10.trim() !== '' && !isNaN(Number(rawPm10));
    const isPm25Valid = rawPm25 !== null && rawPm25 !== undefined && rawPm25 !== '-' && rawPm25.trim() !== '' && !isNaN(Number(rawPm25));

    const pm10Display = isPm10Valid ? `${rawPm10} ㎍/㎥` : '측정안됨';
    const pm25Display = isPm25Valid ? `${rawPm25} ㎍/㎥` : '측정안됨';

    if (isPm10Valid) {
      validPm10Sum += Number(rawPm10);
      validPm10Count += 1;
    }

    const styleInfo = GRADE_STYLE_MAP[rawGrade] || GRADE_STYLE_MAP.unknown;
    const formattedTime = formatKoreanDateTime(rawDataTime);

    const card = document.createElement('article');
    card.className = `station-card ${styleInfo.cardClass}`;
    card.innerHTML = `
      <div class="card-header">
        <h3 class="station-name">${escapeHtml(stationName)}</h3>
        <span class="grade-badge">${styleInfo.text}</span>
      </div>
      <div class="card-body">
        <div class="data-row">
          <span class="data-label">미세먼지(PM10)</span>
          <span class="data-value ${!isPm10Valid ? 'none' : ''}">${pm10Display}</span>
        </div>
        <div class="data-row">
          <span class="data-label">초미세먼지(PM2.5)</span>
          <span class="data-value ${!isPm25Valid ? 'none' : ''}">${pm25Display}</span>
        </div>
      </div>
      <div class="card-footer">
        <span class="data-time">${formattedTime}</span>
      </div>
    `;

    fragment.appendChild(card);
  });

  cardContainer.appendChild(fragment);

  if (validPm10Count > 0) {
    const avg = Math.round((validPm10Sum / validPm10Count) * 10) / 10;
    const gradeKey = getGradeKeyByValue(avg);
    setTrafficDisplay(gradeKey, avg.toLocaleString(), latestTimeStr);
  } else {
    setTrafficDisplay('unknown', '-', latestTimeStr);
  }
}

/**
 * [15] 지도 위에 미세먼지 등급별로 방독면, 마스크, 기본 얼굴 마커를 표시합니다.
 * @param {Array} items - 측정소별 측정 정보 배열
 */
function renderAirMapMarkers(items) {
  if (!airMapInstance || !markersLayerGroup) return;

  markersLayerGroup.clearLayers();
  const bounds = [];

  items.forEach((item) => {
    const stationName = item.stationName;
    if (!stationName) return;

    const coord = findCoordinates(stationName);
    if (!coord) return;

    const rawPm10 = item.pm10Value;
    const rawPm25 = item.pm25Value;
    const rawGrade = item.pm10Grade;

    const isPm10Valid = rawPm10 !== null && rawPm10 !== undefined && rawPm10 !== '-' && rawPm10.trim() !== '' && !isNaN(Number(rawPm10));
    const isPm25Valid = rawPm25 !== null && rawPm25 !== undefined && rawPm25 !== '-' && rawPm25.trim() !== '' && !isNaN(Number(rawPm25));

    let gradeKey = rawGrade;
    if (!gradeKey || !GRADE_STYLE_MAP[gradeKey]) {
      if (isPm10Valid) {
        const autoKey = getGradeKeyByValue(Number(rawPm10));
        const keyMap = { good: '1', normal: '2', bad: '3', veryBad: '4' };
        gradeKey = keyMap[autoKey] || 'unknown';
      } else {
        gradeKey = 'unknown';
      }
    }

    const style = GRADE_STYLE_MAP[gradeKey] || GRADE_STYLE_MAP.unknown;
    const pm10Display = isPm10Valid ? `${rawPm10} ㎍/㎥` : '측정안됨';
    const pm25Display = isPm25Valid ? `${rawPm25} ㎍/㎥` : '측정안됨';

    const markerHtml = `
      <div class="map-marker-pin ${style.pinClass}">
        <div class="marker-face-circle">${style.face}</div>
        <span class="marker-label">${escapeHtml(stationName)}: ${isPm10Valid ? rawPm10 : '미측정'}</span>
      </div>
    `;

    const customIcon = L.divIcon({
      html: markerHtml,
      className: '',
      iconSize: [44, 52],
      iconAnchor: [22, 50],
      popupAnchor: [0, -48]
    });

    const popupContent = `
      <div class="popup-box">
        <h3 class="popup-title">📍 ${escapeHtml(stationName)} 측정소</h3>
        <p class="popup-item">상태: <strong>${style.face} ${style.text}</strong></p>
        <p class="popup-item">미세먼지(PM10): <strong>${pm10Display}</strong></p>
        <p class="popup-item">초미세먼지(PM2.5): <strong>${pm25Display}</strong></p>
        <p class="popup-item" style="font-size: 0.78rem; color: #64748b; margin-top: 6px;">
          ${formatKoreanDateTime(item.dataTime)}
        </p>
      </div>
    `;

    const marker = L.marker([coord.lat, coord.lng], { icon: customIcon }).bindPopup(popupContent);
    markersLayerGroup.addLayer(marker);
    bounds.push([coord.lat, coord.lng]);
  });

  if (bounds.length >= 2) {
    airMapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }
}

/**
 * [16] 측정소 이름을 기반으로 내장 위경도 좌표를 탐색합니다.
 * @param {string} name - 측정소 이름
 * @returns {{lat: number, lng: number}|null}
 */
function findCoordinates(name) {
  if (STATION_COORDINATES[name]) {
    return STATION_COORDINATES[name];
  }
  for (const key in STATION_COORDINATES) {
    if (name.includes(key) || key.includes(name)) {
      return STATION_COORDINATES[key];
    }
  }
  return null;
}

/**
 * [17] 상위 10개 측정소 가로 막대 그래프 렌더링 (Chart.js)
 */
function renderTopStationsChart(items) {
  const validList = [];
  items.forEach((item) => {
    const val = item.pm10Value;
    const isValid = val !== null && val !== undefined && val !== '-' && val.trim() !== '' && !isNaN(Number(val));
    if (isValid) {
      validList.push({
        stationName: item.stationName || '알 수 없음',
        pm10Value: Number(val),
        grade: item.pm10Grade
      });
    }
  });

  if (validList.length === 0) {
    chartSection.classList.add('hidden');
    return;
  }

  validList.sort((a, b) => b.pm10Value - a.pm10Value);
  const top10 = validList.slice(0, 10);

  const labels = top10.map((i) => i.stationName);
  const dataValues = top10.map((i) => i.pm10Value);

  const bgColors = [];
  const borderColors = [];

  top10.forEach((item) => {
    let gradeKey = item.grade;
    if (!gradeKey || !GRADE_STYLE_MAP[gradeKey]) {
      const autoKey = getGradeKeyByValue(item.pm10Value);
      const keyMap = { good: '1', normal: '2', bad: '3', veryBad: '4' };
      gradeKey = keyMap[autoKey] || 'unknown';
    }
    const style = GRADE_STYLE_MAP[gradeKey] || GRADE_STYLE_MAP.unknown;
    bgColors.push(style.chartBg);
    borderColors.push(style.chartBorder);
  });

  chartSection.classList.remove('hidden');

  if (dustChartInstance) {
    dustChartInstance.destroy();
  }

  const canvas = document.getElementById('dustChart');
  const ctx = canvas.getContext('2d');

  dustChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '미세먼지(PM10)',
        data: dataValues,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        borderRadius: 6,
        barPercentage: 0.72
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 10,
          titleFont: { family: 'Pretendard', size: 13, weight: 'bold' },
          bodyFont: { family: 'Pretendard', size: 12 },
          callbacks: {
            label: (context) => ` 미세먼지 농도: ${context.parsed.x} ㎍/㎥`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'Pretendard', size: 11 }, color: '#64748b' }
        },
        y: {
          grid: { display: false },
          ticks: { font: { family: 'Pretendard', size: 12, weight: '600' }, color: '#1e293b' }
        }
      }
    }
  });
}

/**
 * [18] 미세먼지 수치 기준 등급키 계산
 */
function getGradeKeyByValue(val) {
  if (val <= 30) return 'good';
  if (val <= 80) return 'normal';
  if (val <= 150) return 'bad';
  return 'veryBad';
}

/**
 * [19] 공기신호등 대시보드 UI 반영
 */
function setTrafficDisplay(gradeKey, avgValue, rawTime) {
  const config = TRAFFIC_CONFIG[gradeKey] || TRAFFIC_CONFIG.unknown;
  trafficDashboard.className = `traffic-dashboard ${config.themeClass}`;
  trafficEmoji.textContent = config.emoji;
  trafficGradeText.textContent = config.text;
  trafficAverageValue.textContent = avgValue;
  actionAdvice.textContent = config.advice;

  if (rawTime) {
    latestTimeInfo.textContent = `${formatKoreanDateTime(rawTime)} (에어코리아 제공)`;
  } else {
    latestTimeInfo.textContent = '';
  }
}

/**
 * [20] 날짜 문자열 포맷팅 ('YYYY년 M월 D일 H시 기준')
 */
function formatKoreanDateTime(raw) {
  if (!raw || typeof raw !== 'string') return '측정시각 정보 없음';
  const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):/);
  if (match) {
    const year = match[1];
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    return `${year}년 ${month}월 ${day}일 ${hour}시 기준`;
  }
  return `${raw} 기준`;
}

/**
 * [21] 에러 메시지 표시
 */
function showError(message) {
  errorText.textContent = message;
  errorMessage.classList.remove('hidden');
}

/**
 * [22] XSS 방어 이스케이프 함수
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
