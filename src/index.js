import rbush from "rbush";
import { _getGridDiscretiser } from "./modules/griddiscretizer.js";
import { _getHexDiscretiser } from "./modules/hexdiscretizer.js";
import { createCoordinateTransformer } from "./modules/coordinate-transformer.js";
import { createDataProcessor, DATA_TYPES, AGGREGATION_TYPES } from "./modules/data-processor.js";
import { createVisualizationRenderer, CHART_TYPES } from "./modules/visualization-renderer.js";

L.GriddedGlyph = L.CanvasLayer.extend({
  initialize: function (options) {
    // Call the parent class's initialize method
    L.CanvasLayer.prototype.initialize.call(this, options);

    // initialize tree for spatial indexing (for static mode)
    this._tree = new rbush();

    // Set options (using defaults for undefined options)
    this.options = options || {}; // Ensure options object exists
    this.gridSize = options.gridSize || 20; // Default grid size
    this.padding = options.padding || 5; // Default padding
    this.geojsonLayer = options.geojsonLayer;
    this.customDrawFunction = options.customDrawFunction;
    this.gridType = options.gridType || "square"; // Default to square grids, add 'hexagon', 'h3', 's2' later
    this.debug = options.debug || false; // Enable debug logging
    
    // NEW: Dynamic mode options
    this.dynamicMode = options.dynamicMode || false; // Enable dynamic reaggregation
    this.dynamicThrottle = options.dynamicThrottle || 16; // Throttle dynamic updates (ms)
    this.dynamicAggregationFn = options.dynamicAggregationFn; // Custom aggregation function
    
    // NEW: Data processing options
    this.dataProcessor = options.dataProcessor || createDataProcessor(options.dataProcessorOptions);
    this.visualizationRenderer = options.visualizationRenderer || createVisualizationRenderer(options.visualizationOptions);
    this.aggregationConfig = options.aggregationConfig || {};
    this.visualizationConfig = options.visualizationConfig || {};
    this.selectedFields = options.selectedFields || [];
    
    // Initialize discretizers for dynamic mode
    this._discretizers = {
      square: _getGridDiscretiser(this.gridSize),
      hexagon: _getHexDiscretiser(this.gridSize)
    };

    // Initialize coordinate transformer
    this._coordTransformer = null;

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
    
    // NEW: Dynamic mode cache
    this._cachedScreenData = null; // Cached screen coordinates
    this._cachedMousePos = null; // Cached mouse position
    this._dynamicUpdateTimer = null; // Timer for throttled updates
    
    // NEW: Data processing cache
    this._processedData = null;
    this._dataSchema = null;
    this._globalStats = null;
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
    
    // Also invalidate dynamic cache
    this._cachedScreenData = null;
    this._cachedMousePos = null;
  },

  /**
   * NEW: Invalidate dynamic cache specifically
   */
  invalidateDynamicCache: function() {
    this._cachedScreenData = null;
    this._cachedMousePos = null;
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
      gridDataLength: this.gridData.length,
      dynamicMode: this.dynamicMode,
      cachedScreenData: !!this._cachedScreenData
    };
  },

  /**
   * NEW: Coordinate transformation functions for dynamic mode
   * @private
   */
  _coordToScreenFn: function(latLng) {
    if (!this._coordTransformer) return [0, 0];
    return this._coordTransformer.latLngToScreen(latLng);
  },

  _screenToCoordFn: function(screenPoint) {
    if (!this._coordTransformer) return [0, 0];
    return this._coordTransformer.screenToLatLng(screenPoint);
  },

  /**
   * NEW: Process data for screen coordinates (for dynamic mode)
   * @private
   */
  _processScreenData: function() {
    if (!this.geojsonLayer || !this._coordTransformer) return [];
    
    const screenData = [];
    const viewport = this._coordTransformer.getViewport();
    
    this.geojsonLayer.eachLayer((layer) => {
      const latLng = layer.getLatLng();
      const screenPoint = this._coordToScreenFn(latLng);
      
      // Only include points within the viewport
      if (this._coordTransformer.isPointVisible(screenPoint)) {
        screenData.push({
          screenPoint: screenPoint,
          latLng: latLng,
          data: layer,
          properties: layer.feature ? layer.feature.properties : {}
        });
      }
    });
    
    return screenData;
  },

  /**
   * NEW: Calculate dynamic grid data using screen coordinates
   * @private
   */
  _calculateDynamicGridData: function(mousePos) {
    if (!this._map) return;
    
    const discretiser = this._discretizers[this.gridType];
    if (!discretiser) {
      console.warn(`Discretiser not found for grid type: ${this.gridType}`);
      return;
    }
    
    // Get screen data (cached if possible)
    let screenData = this._cachedScreenData;
    if (!screenData) {
      screenData = this._processScreenData();
      this._cachedScreenData = screenData;
    }
    
    // Clear existing grid data
    this.gridData = [];
    
    // Create spatial units lookup
    const spatialUnitsLookup = {};
    
    // Process each data point
    for (let datum of screenData) {
      const screenPoint = datum.screenPoint;
      
      // Get grid cell coordinates
      const [col, row] = discretiser.getColRow(screenPoint[0], screenPoint[1]);
      const key = `${col},${row}`;
      
      // Get or create spatial unit
      let spatialUnit = spatialUnitsLookup[key];
      if (!spatialUnit) {
        const center = discretiser.getXYCentre(col, row);
        spatialUnit = {
          col: col,
          row: row,
          x: center[0],
          y: center[1],
          count: 0,
          attributes: [],
          getBoundary: (padding) => discretiser.getBoundary(col, row, padding),
          getXCentre: () => center[0],
          getYCentre: () => center[1],
          getCellSize: () => this.gridSize
        };
        spatialUnitsLookup[key] = spatialUnit;
      }
      
      // Aggregate data
      spatialUnit.count++;
      spatialUnit.attributes.push(datum.properties);
      
      // Apply custom aggregation function if provided
      if (this.dynamicAggregationFn) {
        this.dynamicAggregationFn(spatialUnit, datum, 1, {}, {});
      }
    }
    
    // NEW: Apply enhanced aggregation if data processor is available
    Object.values(spatialUnitsLookup).forEach(spatialUnit => {
      if (this.dataProcessor && this.aggregationConfig.fields.length > 0) {
        const aggregatedData = this._aggregateCellData(spatialUnit.attributes);
        Object.assign(spatialUnit, aggregatedData);
      }
    });
    
    // Convert to grid data format
    this.gridData = Object.values(spatialUnitsLookup);
    
    if (this.debug) {
      console.log(`Dynamic grid calculated: ${this.gridData.length} cells, ${screenData.length} data points`);
    }
  },

  onAdd: function (map) {
    // Call the parent class's onAdd method
    L.CanvasLayer.prototype.onAdd.call(this, map);

    // Initialize coordinate transformer
    this._coordTransformer = createCoordinateTransformer(map);

    // Add event listeners to the map
    if (this.dynamicMode) {
      // Dynamic mode: respond to all movement events
      map.on("zoom move mousemove", this._onDynamicEvent, this);
      map.on("zoomend moveend", this._onMapChangeEnd, this);
    } else {
      // Static mode: only respond to end events
      map.on("zoomend moveend", this._redraw, this);
    }

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
    this._cachedScreenData = null;

    // Clear dynamic update timer
    if (this._dynamicUpdateTimer) {
      clearTimeout(this._dynamicUpdateTimer);
      this._dynamicUpdateTimer = null;
    }

    // Remove event listeners from the map
    if (this.dynamicMode) {
      map.off("zoom move mousemove", this._onDynamicEvent, this);
      map.off("zoomend moveend", this._onMapChangeEnd, this);
    } else {
      map.off("zoomend moveend", this._redraw, this);
    }
    map.off("mousemove", this._onMouseMove, this);
  },

  /**
   * NEW: Handle dynamic events with throttling
   * @private
   */
  _onDynamicEvent: function(e) {
    // Throttle updates for performance
    if (this._dynamicUpdateTimer) {
      clearTimeout(this._dynamicUpdateTimer);
    }
    
    this._dynamicUpdateTimer = setTimeout(() => {
      this._updateDynamicGrid(e);
    }, this.dynamicThrottle);
  },

  /**
   * NEW: Handle map change end events (for dynamic mode)
   * @private
   */
  _onMapChangeEnd: function(e) {
    // Clear screen data cache when map changes significantly
    this._cachedScreenData = null;
    this._updateDynamicGrid(e);
  },

  /**
   * NEW: Update dynamic grid
   * @private
   */
  _updateDynamicGrid: function(e) {
    if (!this.dynamicMode || !this._map) return;
    
    // Get current mouse position or use center of map
    let mousePos = null;
    if (e && e.containerPoint) {
      mousePos = e.containerPoint;
      this._cachedMousePos = mousePos;
    } else if (this._cachedMousePos) {
      mousePos = this._cachedMousePos;
    } else {
      const mapSize = this._map.getSize();
      mousePos = { x: mapSize.x / 2, y: mapSize.y / 2 };
    }
    
    // Calculate dynamic grid
    this._calculateDynamicGridData(mousePos);
    
    // Redraw
    this._redraw();
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
    for (let cell of this.gridData) {
      if (this.dynamicMode) {
        // Dynamic mode: use boundary check
        const boundary = cell.getBoundary();
        if (boundary && this._pointInPolygon(coords, boundary)) {
          return cell;
        }
      } else {
        // Static mode: use rectangular bounds
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

  /**
   * NEW: Check if point is inside polygon (for hexagon cells)
   * @private
   */
  _pointInPolygon: function(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i][1] > point.y) !== (polygon[j][1] > point.y)) &&
          (point.x < (polygon[j][0] - polygon[i][0]) * (point.y - polygon[i][1]) / (polygon[j][1] - polygon[i][1]) + polygon[i][0])) {
        inside = !inside;
      }
    }
    return inside;
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
    // Check if we're in dynamic mode
    if (this.dynamicMode) {
      // Dynamic mode: grid is calculated in _updateDynamicGrid
      return;
    }
    
    // Static mode: use existing logic
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
      this._calculateHexagonGridData(bounds);
    } else if (this.gridType === "h3") {
      // this._calculateH3GridData(bounds); // Implement later
    } else if (this.gridType === "s2") {
      // this._calculateS2GridData(bounds); // Implement later
    }
    
    // Update cache after recalculation
    this._updateCache(bounds);
  },

  _calculateSquareGridData: function (bounds) {
    if (!this._coordTransformer) return;
    
    const screenBounds = this._coordTransformer.boundsToScreen(bounds);
    if (!screenBounds) return;
    
    const { northWest, southEast } = screenBounds;
    
    // Calculate size of rectangles in pixels
    var rectSize = this.gridSize;

    // Calculate number of rows and columns
    var cols = Math.ceil((southEast[0] - northWest[0]) / rectSize);
    var rows = Math.ceil((southEast[1] - northWest[1]) / rectSize);

    // Initialize grid data array
    this.gridData = [];
    
    // Ensure tree is properly initialized
    if (!this._tree) {
      this._tree = new rbush();
    }
    
    // Create a new RBush index (if not already created or if data changed)
    if (!this._tree.all || this._tree.all().length === 0 || this._dataHash !== this._generateDataHash()) {
      this._recalculateTree();
    }

    // Count number of features in each cell using the RBush index
    for (var i = 0; i < rows; i++) {
      for (var j = 0; j < cols; j++) {
        var cellX = northWest[0] + j * (rectSize + this.padding);
        var cellY = northWest[1] + i * (rectSize + this.padding);

        // Convert cell corners to lat/lng for bounds
        const topLeft = this._coordTransformer.screenToLatLng([cellX, cellY]);
        const bottomRight = this._coordTransformer.screenToLatLng([
          cellX + rectSize + this.padding,
          cellY + rectSize + this.padding,
        ]);
        
        const cellBounds = L.latLngBounds(topLeft, bottomRight);
        
        // Query features in this cell with safety checks
        var results = [];
        try {
          if (this._tree && this._tree.search && typeof this._tree.search === 'function') {
            results = this._tree.search({
              minX: cellBounds.getWest(),
              minY: cellBounds.getSouth(),
              maxX: cellBounds.getEast(),
              maxY: cellBounds.getNorth(),
            });
          }
        } catch (error) {
          console.warn('Error searching tree:', error);
          results = [];
        }
        
        // Safety check for results
        if (!results || !Array.isArray(results)) {
          results = [];
        }
        
        // Create cell data
        const cellData = {
          count: results.length,
          x: cellX,
          y: cellY,
          bounds: cellBounds,
          attributes: [],
          getBoundary: (padding) => {
            const adjCellSize = padding ? rectSize - padding * 2 : rectSize;
            return [
              [cellX + adjCellSize/2, cellY + adjCellSize/2],
              [cellX + adjCellSize/2, cellY - adjCellSize/2],
              [cellX - adjCellSize/2, cellY - adjCellSize/2],
              [cellX - adjCellSize/2, cellY + adjCellSize/2],
            ];
          },
          getXCentre: () => cellX + rectSize/2,
          getYCentre: () => cellY + rectSize/2,
          getCellSize: () => this.gridSize
        };

        // Store selected attributes with safety checks
        for (const feature of results) {
          if (feature && feature.data && feature.data.feature && feature.data.feature.properties) {
            cellData.attributes.push(feature.data.feature.properties);
          }
        }
        
        // NEW: Apply enhanced aggregation if data processor is available
        if (this.dataProcessor && this.aggregationConfig && this.aggregationConfig.fields && this.aggregationConfig.fields.length > 0) {
          const aggregatedData = this._aggregateCellData(cellData.attributes);
          Object.assign(cellData, aggregatedData);
        }
        
        // Only add cells with data
        if (cellData.count > 0) {
          this.gridData.push(cellData);
        }
      }
    }
  },

  /**
   * NEW: Calculate hexagon grid data for static mode
   * @private
   */
  _calculateHexagonGridData: function (bounds) {
    if (!this._coordTransformer) return;
    
    const screenBounds = this._coordTransformer.boundsToScreen(bounds);
    if (!screenBounds) return;
    
    const discretiser = this._discretizers.hexagon;
    if (!discretiser) {
      console.warn('Hexagon discretiser not available');
      return;
    }
    
    const { northWest, southEast } = screenBounds;
    
    // Calculate grid coverage
    const [startCol, startRow] = discretiser.getColRow(northWest[0], northWest[1]);
    const [endCol, endRow] = discretiser.getColRow(southEast[0], southEast[1]);
    
    // Initialize grid data array
    this.gridData = [];
    
    // Ensure tree is properly initialized
    if (!this._tree) {
      this._tree = new rbush();
    }
    
    // Create a new RBush index (if not already created or if data changed)
    if (!this._tree.all || this._tree.all().length === 0 || this._dataHash !== this._generateDataHash()) {
      this._recalculateTree();
    }
    
    // Process each cell in the grid
    for (let col = startCol - 1; col <= endCol + 1; col++) {
      for (let row = startRow - 1; row <= endRow + 1; row++) {
        const center = discretiser.getXYCentre(col, row);
        const boundary = discretiser.getBoundary(col, row, this.padding);
        
        if (!center || !boundary) {
          continue;
        }
        
        // Convert boundary to lat/lng for spatial query
        const boundaryLatLng = boundary.map(point => 
          this._coordTransformer.screenToLatLng(point)
        );
        
        // Create bounds from boundary points
        const cellBounds = L.latLngBounds(boundaryLatLng);
        
        // Query features in this cell with safety checks
        var results = [];
        try {
          if (this._tree && this._tree.search && typeof this._tree.search === 'function') {
            results = this._tree.search({
              minX: cellBounds.getWest(),
              minY: cellBounds.getSouth(),
              maxX: cellBounds.getEast(),
              maxY: cellBounds.getNorth(),
            });
          }
        } catch (error) {
          console.warn('Error searching tree:', error);
          results = [];
        }
        
        // Safety check for results
        if (!results || !Array.isArray(results)) {
          results = [];
        }
        
        // Create cell data
        const cellData = {
          count: results.length,
          col: col,
          row: row,
          x: center[0],
          y: center[1],
          bounds: cellBounds,
          attributes: [],
          getBoundary: () => boundary,
          getXCentre: () => center[0],
          getYCentre: () => center[1],
          getCellSize: () => this.gridSize
        };
        
        // Store attributes with safety checks
        for (const feature of results) {
          if (feature && feature.data && feature.data.feature && feature.data.feature.properties) {
            cellData.attributes.push(feature.data.feature.properties);
          }
        }
        
        // NEW: Apply enhanced aggregation if data processor is available
        if (this.dataProcessor && this.aggregationConfig && this.aggregationConfig.fields && this.aggregationConfig.fields.length > 0) {
          const aggregatedData = this._aggregateCellData(cellData.attributes);
          Object.assign(cellData, aggregatedData);
        }
        
        // Only add cells with data
        if (cellData.count > 0) {
          this.gridData.push(cellData);
        }
      }
    }
  },

  drawGrid: function (ctx, bounds) {
    if (this.dynamicMode) {
      this._drawDynamicGrid(ctx, bounds);
    } else {
      if (this.gridType === "square") {
        this._drawSquareGrid(ctx, bounds);
      } else if (this.gridType === "hexagon") {
        this._drawHexagonGrid(ctx, bounds);
      } // ... (other grid types)
    }
  },

  _drawSquareGrid: function (ctx, bounds) {
    // Set the fill style with transparency
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";

    // Draw grid of rectangles with padding
    for (let cell of this.gridData) {
      if (cell.count > 0) {
        ctx.fillRect(
          cell.x,
          cell.y,
          this.gridSize - this.padding,
          this.gridSize - this.padding
        );
      }
    }
  },

  /**
   * NEW: Draw hexagon grid for static mode
   * @private
   */
  _drawHexagonGrid: function (ctx, bounds) {
    // Set the fill style with transparency
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";

    // Draw each hexagon cell
    for (let cell of this.gridData) {
      if (cell.count > 0) {
        const boundary = cell.getBoundary(this.padding);
        if (boundary && boundary.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(boundary[0][0], boundary[0][1]);
          for (let i = 1; i < boundary.length; i++) {
            ctx.lineTo(boundary[i][0], boundary[i][1]);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  },

  /**
   * NEW: Draw dynamic grid
   * @private
   */
  _drawDynamicGrid: function (ctx, bounds) {
    // Set the fill style with transparency
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";

    // Draw each cell in the dynamic grid
    for (let cell of this.gridData) {
      if (cell.count > 0) {
        const boundary = cell.getBoundary(this.padding);
        if (boundary && boundary.length >= 3) {
          // Draw polygon for hexagons or complex shapes
          ctx.beginPath();
          ctx.moveTo(boundary[0][0], boundary[0][1]);
          for (let i = 1; i < boundary.length; i++) {
            ctx.lineTo(boundary[i][0], boundary[i][1]);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          // Draw rectangle for square grids
          const size = this.gridSize - this.padding;
          ctx.fillRect(cell.x - size/2, cell.y - size/2, size, size);
        }
      }
    }
  },

  drawGlyphs: function (ctx, bounds) {
    for (let cellData of this.gridData) {
      let centerX, centerY;
      
      if (this.dynamicMode) {
        // Dynamic mode: use stored center coordinates
        centerX = cellData.getXCentre();
        centerY = cellData.getYCentre();
      } else {
        // Static mode: calculate center from bounds
        if (cellData.bounds && cellData.bounds.getNorthWest) {
          var northWest = this._coordTransformer.latLngToScreen(
            cellData.bounds.getNorthWest()
          );
          var southEast = this._coordTransformer.latLngToScreen(
            cellData.bounds.getSouthEast()
          );
          centerX = (northWest[0] + southEast[0]) / 2;
          centerY = (northWest[1] + southEast[1]) / 2;
        } else {
          // Fallback to stored coordinates
          centerX = cellData.getXCentre();
          centerY = cellData.getYCentre();
        }
      }

      // NEW: Use visualization renderer if available and configured
      if (this.visualizationRenderer && this.visualizationConfig.type) {
        const size = this.gridSize - this.padding;
        this.visualizationRenderer.drawChart(ctx, cellData, this.visualizationConfig, centerX, centerY, size);
      } else if (this.customDrawFunction) {
        // Call custom draw function
        this.customDrawFunction(ctx, cellData, centerX, centerY);
      } else {
        // Default: draw a circle
        this._drawCircleGlyph(ctx, cellData, centerX, centerY);
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

    // Initialize dynamic mode if needed
    if (this.dynamicMode && !this._cachedScreenData) {
      this._cachedScreenData = this._processScreenData();
      this._calculateDynamicGridData(null);
    } else if (!this.dynamicMode) {
      // Recalculate grid data (static mode)
      this.calculateGridData(bounds);
    }

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

  /**
   * NEW: Load and process data from various sources
   * @param {Object|Array|string} data - Data source
   * @param {Object} options - Loading options
   * @returns {Promise<Array>} Processed data
   */
  loadData: async function(data, options = {}) {
    try {
      this._processedData = await this.dataProcessor.loadData(data, options);
      this._dataSchema = this.dataProcessor.getSchema();
      this._globalStats = this._calculateGlobalStats();
      
      if (this.debug) {
        console.log('Data loaded:', this._processedData.length, 'records');
        console.log('Data schema:', this._dataSchema);
      }
      
      // Invalidate cache to force recalculation
      this.invalidateCache();
      
      return this._processedData;
    } catch (error) {
      console.error('Error loading data:', error);
      throw error;
    }
  },

  /**
   * NEW: Get data schema information
   * @returns {Object} Data schema
   */
  getDataSchema: function() {
    return this._dataSchema;
  },

  /**
   * NEW: Get fields by data type
   * @param {string} type - Data type
   * @returns {Array} Field names
   */
  getFieldsByType: function(type) {
    return this.dataProcessor.getFieldsByType(type);
  },

  /**
   * NEW: Set selected fields for visualization
   * @param {Array} fields - Array of field names
   */
  setSelectedFields: function(fields) {
    this.selectedFields = fields;
    this.aggregationConfig = this.dataProcessor.createAggregationConfig(fields);
    this.invalidateCache();
  },

  /**
   * NEW: Set visualization configuration
   * @param {Object} config - Visualization configuration
   */
  setVisualizationConfig: function(config) {
    this.visualizationConfig = config;
    this.invalidateCache();
  },

  /**
   * NEW: Calculate global statistics for normalization
   * @private
   */
  _calculateGlobalStats: function() {
    if (!this._processedData || !this._dataSchema) return null;

    const stats = {};
    
    Object.keys(this._dataSchema).forEach(field => {
      const fieldType = this._dataSchema[field].type;
      const values = this._processedData.map(row => row[field]).filter(v => v !== null && v !== undefined);
      
      if (fieldType === DATA_TYPES.NUMERIC && values.length > 0) {
        stats[field] = {
          min: Math.min(...values),
          max: Math.max(...values),
          mean: values.reduce((sum, val) => sum + val, 0) / values.length,
          count: values.length
        };
      }
    });
    
    return stats;
  },

  /**
   * NEW: Get global statistics
   * @returns {Object} Global statistics
   */
  getGlobalStats: function() {
    return this._globalStats;
  },

  /**
   * NEW: Get visualization suggestions for fields
   * @param {Array} fields - Field names
   * @returns {Object} Visualization suggestions
   */
  getVisualizationSuggestions: function(fields) {
    return this.dataProcessor.getVisualizationSuggestions(fields);
  },

  /**
   * NEW: Enhanced aggregation with data processing
   * @private
   */
  _aggregateCellData: function(cellData) {
    if (!this.dataProcessor || !this.aggregationConfig || !this.aggregationConfig.fields || !this.aggregationConfig.fields.length) {
      // Fallback to basic aggregation
      return {
        count: cellData ? cellData.length : 0,
        attributes: cellData || []
      };
    }

    // Use data processor for advanced aggregation
    try {
      return this.dataProcessor.aggregateCellData(cellData, this.aggregationConfig);
    } catch (error) {
      console.warn('Error in data aggregation:', error);
      // Fallback to basic aggregation
      return {
        count: cellData ? cellData.length : 0,
        attributes: cellData || []
      };
    }
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
