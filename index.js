const { upload, download } = require('./s3.js');
const { sendEmail } = require('./email.js');
const { isPointInPolygon } = require('./geo.js');
const axios = require('axios');

const NOTIFICATION_EMAIL = process.env.UR_PROPERTY_MONITOR_NOTIFICATIONS_EMAIL_LIST;
const NOTIFICATION_SENDER = process.env.UR_PROPERTY_MONITOR_NOTIFICATIONS_SENDER_EMAIL;
const CACHE_BUCKET = process.env.CACHE_BUCKET;
const CACHE_KEY = 'cache.json';

// https://www.daftlogic.com/projects-google-maps-area-calculator-tool.htm
const SEARCH_AREA = `
  35.6153070338361,139.80924926220052
  35.6153070338361,139.75122771679037
  35.62005163712189,139.70762572704427
  35.627865664220096,139.6811898749935
  35.64377043107985,139.65750060497396
  35.65537538785369,139.65003266452425
  35.66932230505118,139.6447111618387
  35.679502016200914,139.64196457980745
  35.700833362307215,139.64024796603792
  35.7149117129844,139.64282288669222
  35.72926628188838,139.65537588820064
  35.733168047672926,139.68061011061275
  35.73344673791457,139.7573427461108
  35.738881002690384,139.78858511671626
  35.73720896072076,139.8067812226733
  35.73372542718092,139.84162848219478
  35.71638438976669,139.8676982787228
  35.68515833631982,139.88297614127163
  35.6664117180705,139.90014227896694
  35.64674514383532,139.91768727478453
  35.621213220421126,139.90635762390562
  35.61702908580878,139.85866927979654
  35.61395896450415,139.8411598193473
`;

module.exports.run = async (_event, _context) => {
  const searchArea = parseGpsCoordinates(SEARCH_AREA);
  const notificationList = JSON.parse(NOTIFICATION_EMAIL);
  const currentProperties = await fetchCurrentProperties();
  const previousProperties = await fetchPreviousProperties();
  const newRooms = getNewPropertyCount(previousProperties, currentProperties, searchArea);

  if (newRooms === 0) {
    console.info('There are no new rooms on UR.');
    return;
  }

  console.info(`Found ${newRooms} new rooms.`);

  const notificationMessage = `There are ${newRooms} new rooms on UR. Please check them out.`;
  await sendEmail(
    NOTIFICATION_SENDER,
    notificationList,
    `UR Property Monitor: ${newRooms} new rooms found!`,
    notificationMessage
  );

  // only update the cache after email has been successfuly sent
  await upload(CACHE_BUCKET, CACHE_KEY, JSON.stringify(currentProperties));
};

function debug(...args) {
  if (process.env.UR_PROPERTY_MONITOR_DEBUG !== 'true') {
    return;
  }

  console.info(...args);
}

async function fetchPreviousProperties() {
  const previousProperties = await download(CACHE_BUCKET, CACHE_KEY);

  let response = [];

  try {
    response = JSON.parse(previousProperties);
  } catch (e) {
    console.error(`Couldn't parse previous data, assuming there is no data from previous time.`);
  }

  return response;
}

// gets JSON data from UR website
async function fetchCurrentProperties() {
  const url = "https://chintai.sumai.ur-net.go.jp/chintai/api/bukken/search/map_marker/";
  const reqBody = `rent_low=&rent_high=&floorspace_low=60&floorspace_high=&ne_lat=35.79313801503034&ne_lng=139.96174996739074&sw_lat=35.62699028495847&sw_lng=139.61980050450012&small=false`;
  const reqParams = {
    method: 'POST',
    url: url,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4854.0 Safari/537.36',
      'Origin': 'https://www.ur-net.go.jp',
      'Referer': 'https://www.ur-net.go.jp/',
      'Host': 'chintai.sumai.ur-net.go.jp',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
    },
    data: reqBody,
    validateStatus: function (status) {
      return status === 200;
    }
  };
  const response = (await axios(reqParams)).data;

  if (!Array.isArray(response)) {
    throw new Error(`UR return a non-array response. Can't swallow this error, please check.`);
  }

  if (response.length === 0) {
    throw new Error(`UR returned an empty array. This shouldn't happen. Bad query params?`);
  }

  return response;
}

// returns total number of new properties of interest compared to last time
function getNewPropertyCount(previousResponse, currentResponse, areaOfInterest) {
  let totalCountOfNewRooms = 0;

  currentResponse.forEach((property) => {
    debug(`property id: ${property.id}`);

    const areWeInterested = isPropertyWithinArea(property, areaOfInterest);
    if (!areWeInterested) {
      debug('not interested');
      return;
    }

    debug('interested');

    const currentNumberOfAvailableRooms = property.roomCount;
    const previousNumberOfAvailableRooms = getNumOfAvailableRooms(property.id, previousResponse);
    const difference = currentNumberOfAvailableRooms - previousNumberOfAvailableRooms;
    if (difference > 0) {
      totalCountOfNewRooms += difference;
    }

    debug(`currentNumberOfAvailableRooms: ${currentNumberOfAvailableRooms}`);
    debug(`previousNumberOfAvailableRooms: ${previousNumberOfAvailableRooms}`);
    debug(`total number of new rooms is ${totalCountOfNewRooms}`);
  });

  return totalCountOfNewRooms;
};

// if property not found in response, returns 0
function getNumOfAvailableRooms(propertyId, response) {
  let numOfRooms = 0;

  let property = response.find(property => propertyId === property.id);

  if (property !== undefined) {
    if (property.roomCount === undefined) {
      throw new Error(`UR returned a response without roomCount property for property id=${property.id}`);
    }

    numOfRooms = property.roomCount;
  }

  return numOfRooms;
};

// checks if property is within area of interest
function isPropertyWithinArea(property, searchArea) {
  return isPointInPolygon(
    [property.lat, property.lng],
    searchArea
  );
};

function parseGpsCoordinates(gpsCoordString) {
  const nlSeparated = gpsCoordString.replace(/[^0-9\n,.]/g, '').trim();
  const coords = nlSeparated.split("\n");
  return coords.map(point => point.split(","));
}
