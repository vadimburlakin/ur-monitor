const classifyPoint = require("robust-point-in-polygon");

function isPointInPolygonV2(coordinates, polygon) {
  return classifyPoint(polygon, coordinates) <= 0;
}

module.exports.isPointInPolygon = isPointInPolygonV2;
