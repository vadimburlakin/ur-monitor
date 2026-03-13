const axios = require('axios');

async function fetchCurrentProperties() {
  const url = 'https://chintai.sumai.ur-net.go.jp/chintai/api/bukken/search/map_marker/';
  const reqBody = 'rent_low=&rent_high=&floorspace_low=60&floorspace_high=&ne_lat=35.79313801503034&ne_lng=139.96174996739074&sw_lat=35.62699028495847&sw_lng=139.61980050450012&small=false';

  const response = (await axios({
    method: 'POST',
    url,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4854.0 Safari/537.36',
      'Origin': 'https://www.ur-net.go.jp',
      'Referer': 'https://www.ur-net.go.jp/',
      'Host': 'chintai.sumai.ur-net.go.jp',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
    },
    data: reqBody,
    validateStatus: (status) => status === 200,
  })).data;

  if (!Array.isArray(response)) {
    throw new Error('UR returned a non-array response');
  }
  if (response.length === 0) {
    throw new Error('UR returned an empty array');
  }

  return response;
}

module.exports = { fetchCurrentProperties };
