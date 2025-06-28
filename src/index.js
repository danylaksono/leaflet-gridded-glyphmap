import rbush from "rbush";

L.GriddedGlyph = L.CanvasLayer.extend({
  initialize: function (options) {
    // Call the parent class's initialize method
    L.CanvasLayer.prototype.initialize.call(this, options);

    // initialize tree for spatial indexing
    this._tree = new rbush();

    // Set options (using defaults for undefined options)
    this.options = options || {}; // Ensure options object exists
    this.gridSize = options.gridSize || 20; // Default grid size
    this.padding = options.padding || 5; // Default padding
    this.geojsonLayer = options.geojsonLayer;
    this.customDrawFunction = options.customDrawFunction;
    this.gridType = options.gridType || "square"; // Default to square grids, add 'hexagon', 'h3', 's2' later
    this.debug = options.debug || false; // Enable debug logging

    // Initialize grid data array
    this.gridData = [];
    
    // Cache properties for performance optimization
    this._cachedBounds = null;
    this._cachedZoom = null;
    this._cachedGridSize = null;
    this._cachedPadding = null;
    this._cachedGridType = null;
    this._dataHash = null; // Hash to detect if GeoJSON data changed
    this._cachedGridOriginX = null;
    this._cachedGridOriginY = null;
  },

  /**
   * Generate a simple hash of GeoJSON data to detect changes
   * @private
   */
  _generateDataHash: function() {
    if (!this.geojsonLayer) return null;
    
    let hash = 0;
    let count = 0;
    
    this.geojsonLayer.eachLayer((layer) => {
      const latLng = layer.getLatLng();
      hash = ((hash << 5) - hash + latLng.lat + latLng.lng) & 0xffffffff;
      count++;
    });
    
    return hash + '_' + count;
  },

  /**
   * Check if grid data needs to be recalculated
   * @private
   */
  _needsRecalculation: function(bounds) {
    const currentZoom = this._map.getZoom();
    const currentDataHash = this._generateDataHash();
    
    // Calculate grid origin in container points
    const northWest = this._map.latLngToContainerPoint(bounds.getNorthWest());
    const gridOriginX = Math.floor(northWest.x / this.gridSize) * this.gridSize;
    const gridOriginY = Math.floor(northWest.y / this.gridSize) * this.gridSize;
    const gridOriginChanged = (
      this._cachedGridOriginX !== gridOriginX ||
      this._cachedGridOriginY !== gridOriginY
    );
    
    // Check if any relevant properties have changed
    const zoomChanged = this._cachedZoom !== currentZoom;
    const gridSizeChanged = this._cachedGridSize !== this.gridSize;
    const paddingChanged = this._cachedPadding !== this.padding;
    const gridTypeChanged = this._cachedGridType !== this.gridType;
    const dataChanged = this._dataHash !== currentDataHash;
    
    return gridOriginChanged || zoomChanged || gridSizeChanged || paddingChanged || gridTypeChanged || dataChanged;
  },

  /**
   * Update cache properties after recalculation
   * @private
   */
  _updateCache: function(bounds) {
    const northWest = this._map.latLngToContainerPoint(bounds.getNorthWest());
    this._cachedGridOriginX = Math.floor(northWest.x / this.gridSize) * this.gridSize;
    this._cachedGridOriginY = Math.floor(northWest.y / this.gridSize) * this.gridSize;
    this._cachedBounds = bounds;
    this._cachedZoom = this._map.getZoom();
    this._cachedGridSize = this.gridSize;
    this._cachedPadding = this.padding;
    this._cachedGridType = this.gridType;
    this._dataHash = this._generateDataHash();
  },

  /**
   * Manually invalidate the cache to force recalculation
   * Useful when data is updated externally
   */
  invalidateCache: function() {
    this._cachedBounds = null;
    this._cachedZoom = null;
    this._cachedGridSize = null;
    this._cachedPadding = null;
    this._cachedGridType = null;
    this._dataHash = null;
    this._cachedGridOriginX = null;
    this._cachedGridOriginY = null;
  },

  /**
   * Get cache statistics for monitoring
   * @returns {Object} Cache statistics
   */
  getCacheStats: function() {
    return {
      hasCachedBounds: !!this._cachedBounds,
      cachedZoom: this._cachedZoom,
      cachedGridSize: this._cachedGridSize,
      cachedPadding: this._cachedPadding,
      cachedGridType: this._cachedGridType,
      dataHash: this._dataHash,
      currentDataHash: this._generateDataHash(),
      gridDataLength: this.gridData.length
    };
  },

  onAdd: function (map) {
    // Call the parent class's onAdd method
    L.CanvasLayer.prototype.onAdd.call(this, map);

    // Add event listeners to the map
    map.on("zoomend moveend", this._redraw, this);

    // Add an event listener for the mousemove event to the map
    map.on("mousemove", this._onMouseMove, this);
  },

  onRemove: function (map) {
    // Call the parent class's onRemove method
    L.CanvasLayer.prototype.onRemove.call(this, map);

    // Clean up resources
    this._tree.clear();
    this.gridData = [];
    this._cachedBounds = null;

    // Remove event listeners from the map
    map.off("zoomend moveend", this._redraw, this);
    map.off("mousemove", this._onMouseMove, this);
  },

  _onMouseMove: function (e) {
    // Get current mouse position in container points
    var mousePos = e.containerPoint;

    // Find the cell that the mouse is over
    var highlightedCell = this._findCellByCoords(mousePos);

    if (highlightedCell) {
        // Get cell attributes
        // console.log("Cell attributes:", highlightedCell.attributes);

        // You can do other things with the highlighted cell here,
        // such as displaying a tooltip or changing the cell's style
    }
  },

  _findCellByCoords: function (coords) {
    for (var i = 0; i < this.gridData.length; i++) {
      for (var j = 0; j < this.gridData[i].length; j++) {
        var cell = this.gridData[i][j];
        if (
          coords.x >= cell.x &&
          coords.x <= cell.x + this.gridSize &&
          coords.y >= cell.y &&
          coords.y <= cell.y + this.gridSize
        ) {
          return cell;
        }
      }
    }
    return null; // No cell found at these coordinates
  },

  _recalculateTree: function () {
    this._tree.clear();

    this.geojsonLayer.eachLayer((layer) => {
      const latLng = layer.getLatLng();

      this._tree.insert({
        minX: latLng.lng,
        minY: latLng.lat,
        maxX: latLng.lng,
        maxY: latLng.lat,
        data: layer,
      });
    });
  },

  calculateGridData: function (bounds) {
    // Check if recalculation is needed
    if (!this._needsRecalculation(bounds)) {
      if (this.options.debug) {
        console.log('Grid data cache hit - using cached data');
      }
      return; // Use cached data
    }
    
    if (this.options.debug) {
      console.log('Grid data cache miss - recalculating');
    }
    
    if (this.gridType === "square") {
      this._calculateSquareGridData(bounds);
    } else if (this.gridType === "hexagon") {
      // this._calculateHexagonGridData(bounds); // Implement later
    } else if (this.gridType === "h3") {
      // this._calculateH3GridData(bounds); // Implement later
    } else if (this.gridType === "s2") {
      // this._calculateS2GridData(bounds); // Implement later
    }
    
    // Update cache after recalculation
    this._updateCache(bounds);
  },

  _calculateSquareGridData: function (bounds) {
    // Convert bounds to container points
    var northWest = this._map.latLngToContainerPoint(bounds.getNorthWest());
    var southEast = this._map.latLngToContainerPoint(bounds.getSouthEast());

    // Calculate size of rectangles in pixels
    var rectSize = this.gridSize;

    // Calculate number of rows and columns
    var cols = Math.ceil((southEast.x - northWest.x) / rectSize);
    var rows = Math.ceil((southEast.y - northWest.y) / rectSize);

    // Initialize grid data array
    this.gridData = [];
    for (var i = 0; i < rows; i++) {
      this.gridData[i] = [];
      for (var j = 0; j < cols; j++) {
        var cellX = northWest.x + j * (rectSize + this.padding);
        var cellY = northWest.y + i * (rectSize + this.padding);

        this.gridData[i][j] = {
          count: 0,
          x: cellX, // Store cell's pixel coordinates for mouse interaction
          y: cellY,
          bounds: L.latLngBounds(
            this._map.containerPointToLatLng([cellX, cellY]),
            this._map.containerPointToLatLng([
              cellX + rectSize + this.padding,
              cellY + rectSize + this.padding,
            ])
          ),
          attributes: [],
        };
      }
    }

    // Create a new RBush index (if not already created or if data changed)
    if (!this._tree || this._tree.all().length === 0 || this._dataHash !== this._generateDataHash()) {
      this._recalculateTree();
    }

    // Count number of features in each cell using the RBush index
    for (var i = 0; i < rows; i++) {
      for (var j = 0; j < cols; j++) {
        var cellBounds = this.gridData[i][j].bounds;
        var results = this._tree.search({
          minX: cellBounds.getWest(),
          minY: cellBounds.getSouth(),
          maxX: cellBounds.getEast(),
          maxY: cellBounds.getNorth(),
        });
        // count number of features in each tree cells
        this.gridData[i][j].count = results.length;

        // Store selected attributes
        var cellData = this.gridData[i][j];
        for (const feature of results) {
          cellData.attributes.push(feature.data.feature.properties); // Adjust based on your attribute structure
        }
      }
    }
  },

  drawGrid: function (ctx, bounds) {
    if (this.gridType === "square") {
      this._drawSquareGrid(ctx, bounds);
    } else if (this.gridType === "hexagon") {
      // this._drawHexagonGrid(ctx, bounds); // Implement later
    } // ... (other grid types)
  },

  _drawSquareGrid: function (ctx, bounds) {
    // Set the fill style with transparency
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";

    // Draw grid of rectangles with padding
    for (var i = 0; i < this.gridData.length; i++) {
      for (var j = 0; j < this.gridData[i].length; j++) {
        // Only draw the rectangle if the cell contains data
        if (this.gridData[i][j].count > 0) {
          ctx.fillRect(
            this.gridData[i][j].x,
            this.gridData[i][j].y,
            this.gridSize - this.padding,
            this.gridSize - this.padding
          );
        }
      }
    }
  },

  drawGlyphs: function (ctx, bounds) {
    for (var i = 0; i < this.gridData.length; i++) {
      for (var j = 0; j < this.gridData[i].length; j++) {
        var cellData = this.gridData[i][j];

        // Convert cell bounds to container points (for square grids)
        var northWest = this._map.latLngToContainerPoint(
          cellData.bounds.getNorthWest()
        );
        var southEast = this._map.latLngToContainerPoint(
          cellData.bounds.getSouthEast()
        );
        var centerX = (northWest.x + southEast.x) / 2;
        var centerY = (northWest.y + southEast.y) / 2;

        // Default: draw a circle (if no custom draw function)
        if (!this.customDrawFunction) {
          this._drawCircleGlyph(ctx, cellData, centerX, centerY);
        } else {
          // Call custom draw function
          this.customDrawFunction(ctx, cellData, centerX, centerY);
        }
      }
    }
  },

  _drawCircleGlyph: function (ctx, cellData, centerX, centerY) {
    // Set the stroke style
    ctx.strokeStyle = "black";

    // Calculate the maximum radius based on the size of the cell and the padding between cells
    var maxRadius = this.gridSize / 2 - this.padding;

    // Calculate the radius based on the count of data in the cell
    var radius = Math.min(cellData.count * 5, maxRadius);

    // Draw circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();
  },

  onDrawLayer: function (info) {
    var canvas = info.canvas;
    var ctx = canvas.getContext("2d");
    // Get the bounds of the GeoJSON layer
    var bounds = this.geojsonLayer.getBounds();

    // Recalculate grid data
    this.calculateGridData(bounds);

    // Draw the grid of rectangles
    this.drawGrid(ctx, bounds);

    // Draw the glyphs
    this.drawGlyphs(ctx, bounds);
  },

  _redraw: function() {
    // Clear existing canvas
    const canvas = this._canvas;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Recalculate grid data
    const bounds = this.geojsonLayer.getBounds();
    this.calculateGridData(bounds);

    // Redraw grid
    ctx.save();
    this.drawGrid(ctx, bounds);
    ctx.restore();

    // Redraw glyphs
    ctx.save();
    this.drawGlyphs(ctx, bounds);
    ctx.restore();
  },
});

L.griddedGlyph = function (options) {
  return new L.GriddedGlyph(options);
};

// Export for browser environment
if (typeof window !== 'undefined') {
  window.L = window.L || {};
  window.L.GriddedGlyph = L.GriddedGlyph;
  window.L.griddedGlyph = L.griddedGlyph;
}
