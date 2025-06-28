/**
 * Coordinate Transformation Module
 * Handles conversion between ground coordinates (lat/lng) and screen coordinates (pixels)
 */
export class CoordinateTransformer {
  constructor(map) {
    this.map = map;
  }

  /**
   * Convert lat/lng to screen coordinates
   * @param {L.LatLng|Array} latLng - LatLng object or [lat, lng] array
   * @returns {Array} [x, y] screen coordinates
   */
  latLngToScreen(latLng) {
    if (!this.map) return [0, 0];
    
    let point;
    if (Array.isArray(latLng)) {
      point = this.map.latLngToContainerPoint([latLng[0], latLng[1]]);
    } else {
      point = this.map.latLngToContainerPoint(latLng);
    }
    return [point.x, point.y];
  }

  /**
   * Convert screen coordinates to lat/lng
   * @param {Array|Object} screenPoint - [x, y] array or {x, y} object
   * @returns {Array} [lat, lng] coordinates
   */
  screenToLatLng(screenPoint) {
    if (!this.map) return [0, 0];
    
    let point;
    if (Array.isArray(screenPoint)) {
      point = { x: screenPoint[0], y: screenPoint[1] };
    } else {
      point = screenPoint;
    }
    
    const latLng = this.map.containerPointToLatLng(point);
    return [latLng.lat, latLng.lng];
  }

  /**
   * Convert bounds to screen bounds
   * @param {L.LatLngBounds} bounds - Geographic bounds
   * @returns {Object} Screen bounds {northWest: [x, y], southEast: [x, y]}
   */
  boundsToScreen(bounds) {
    if (!this.map || !bounds) return null;
    
    const northWest = this.latLngToScreen(bounds.getNorthWest());
    const southEast = this.latLngToScreen(bounds.getSouthEast());
    
    return {
      northWest: northWest,
      southEast: southEast,
      width: southEast[0] - northWest[0],
      height: southEast[1] - northWest[1]
    };
  }

  /**
   * Convert screen bounds to geographic bounds
   * @param {Object} screenBounds - Screen bounds {northWest: [x, y], southEast: [x, y]}
   * @returns {L.LatLngBounds} Geographic bounds
   */
  screenToBounds(screenBounds) {
    if (!this.map || !screenBounds) return null;
    
    const northWest = this.screenToLatLng(screenBounds.northWest);
    const southEast = this.screenToLatLng(screenBounds.southEast);
    
    return L.latLngBounds(northWest, southEast);
  }

  /**
   * Calculate grid size in pixels at current zoom level
   * @param {number} gridSizeMeters - Grid size in meters
   * @returns {number} Grid size in pixels
   */
  metersToPixels(gridSizeMeters) {
    if (!this.map) return gridSizeMeters;
    
    const center = this.map.getCenter();
    const centerPoint = this.map.latLngToContainerPoint(center);
    
    // Calculate point 1 meter east of center
    const eastPoint = this.map.latLngToContainerPoint([
      center.lat,
      center.lng + (gridSizeMeters / 111320) // Approximate conversion
    ]);
    
    return Math.abs(eastPoint.x - centerPoint.x);
  }

  /**
   * Calculate grid size in meters at current zoom level
   * @param {number} gridSizePixels - Grid size in pixels
   * @returns {number} Grid size in meters
   */
  pixelsToMeters(gridSizePixels) {
    if (!this.map) return gridSizePixels;
    
    const center = this.map.getCenter();
    const centerPoint = this.map.latLngToContainerPoint(center);
    
    // Calculate point 1 pixel east of center
    const eastPoint = this.map.containerPointToLatLng({
      x: centerPoint.x + gridSizePixels,
      y: centerPoint.y
    });
    
    return center.distanceTo(eastPoint);
  }

  /**
   * Get current map viewport in screen coordinates
   * @returns {Object} Viewport bounds
   */
  getViewport() {
    if (!this.map) return null;
    
    const size = this.map.getSize();
    const bounds = this.map.getBounds();
    
    return {
      width: size.x,
      height: size.y,
      bounds: this.boundsToScreen(bounds)
    };
  }

  /**
   * Check if a point is within the current viewport
   * @param {Array} screenPoint - [x, y] screen coordinates
   * @returns {boolean} True if point is visible
   */
  isPointVisible(screenPoint) {
    if (!this.map) return false;
    
    const size = this.map.getSize();
    return screenPoint[0] >= 0 && screenPoint[0] <= size.x &&
           screenPoint[1] >= 0 && screenPoint[1] <= size.y;
  }

  /**
   * Get zoom level adjusted grid size
   * @param {number} baseGridSize - Base grid size in pixels
   * @param {number} baseZoom - Base zoom level
   * @returns {number} Adjusted grid size for current zoom
   */
  getZoomAdjustedGridSize(baseGridSize, baseZoom = 13) {
    if (!this.map) return baseGridSize;
    
    const currentZoom = this.map.getZoom();
    const zoomDiff = currentZoom - baseZoom;
    const scaleFactor = Math.pow(2, zoomDiff);
    
    return baseGridSize * scaleFactor;
  }
}

/**
 * Factory function to create coordinate transformer
 * @param {L.Map} map - Leaflet map instance
 * @returns {CoordinateTransformer} Coordinate transformer instance
 */
export function createCoordinateTransformer(map) {
  return new CoordinateTransformer(map);
} 