import RBush from "rbush";

// console.log(L); // check leaflet global object

L.GriddedGlyph = L.CanvasLayer.extend({
  initialize: function (options) {
    // Call the parent class's initialize method
    L.CanvasLayer.prototype.initialize.call(this, options);
    // Set options
    this.gridSize = options.gridSize;
    this.padding = options.padding;
    this.geojsonLayer = options.geojsonLayer;
    this.customDrawFunction = options.customDrawFunction;
    this.barColor = options.barColor || "blue";
    // Initialize grid data array
    this.gridData = [];
  },
  onAdd: function (map) {
    // Call the parent class's onAdd method
    L.CanvasLayer.prototype.onAdd.call(this, map);
    // Add event listeners for the zoomend and moveend events to the map
    map.on("zoomend moveend", this.onMapChange, this);
    // Add an event listener for the mousemove event to the map
    map.on("mousemove", this.onMouseMove, this);
  },
  onRemove: function (map) {
    // Call the parent class's onRemove method
    L.CanvasLayer.prototype.onRemove.call(this, map);
    // Remove the event listeners for the zoomend and moveend events from the map
    map.off("zoomend moveend", this.onMapChange, this);
    // Remove the event listener for the mousemove event from the map
    map.off("mousemove", this.onMouseMove, this);
  },
  onMapChange: function () {
    // Clear the canvas
    var canvas = this._canvas;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Recalculate grid data
    var bounds = this.geojsonLayer.getBounds();
    this.calculateGridData(bounds);

    // Redraw grid and circles
    this.drawGrid(ctx, bounds);
    this.drawCircles(ctx, bounds);

    // Call the custom draw function if it is defined
    if (this.customDrawFunction) {
      // this.customDrawFunction.call(this, ctx, bounds);
    }
  },
  onMouseMove: function (e) {
    // Get current mouse position in container points
    var mousePos = e.containerPoint;

    // Get bounds of GeoJSON layer
    var bounds = this.geojsonLayer.getBounds();

    // Convert bounds to container points
    var northWest = this._map.latLngToContainerPoint(bounds.getNorthWest());
    var southEast = this._map.latLngToContainerPoint(bounds.getSouthEast());

    // Calculate size of rectangles in pixels
    var rectSize = this.gridSize;

    // Calculate number of rows and columns
    var cols = Math.ceil((southEast.x - northWest.x) / rectSize);
    var rows = Math.ceil((southEast.y - northWest.y) / rectSize);

    // Calculate grid cell size with padding
    var cellSize = rectSize + this.padding;

    // Calculate grid cell row and column
    var col = Math.floor((mousePos.x - northWest.x) / cellSize);
    var row = Math.floor((mousePos.y - northWest.y) / cellSize);

    // Check if mouse is within grid bounds
    if (row >= 0 && row < rows && col >= 0 && col < cols) {
      // console.log("Grid cell:", row, col);
      // console.log(
      //   "Cell boundaries:",
      //   this.gridData[row][col].bounds.toBBoxString()
      // );
    }
  },
  // calculateGridData: function (bounds) {
  //   // Convert bounds to container points
  //   var northWest = this._map.latLngToContainerPoint(bounds.getNorthWest());
  //   var southEast = this._map.latLngToContainerPoint(bounds.getSouthEast());

  //   // Calculate size of rectangles in pixels
  //   var rectSize = this.gridSize;

  //   // Calculate number of rows and columns
  //   var cols = Math.ceil((southEast.x - northWest.x) / rectSize);
  //   var rows = Math.ceil((southEast.y - northWest.y) / rectSize);

  //   // Initialize grid data array
  //   this.gridData = [];
  //   for (var i = 0; i < rows; i++) {
  //     this.gridData[i] = [];
  //     for (var j = 0; j < cols; j++) {
  //       this.gridData[i][j] = {
  //         count: 0,
  //         bounds: L.latLngBounds(
  //           this._map.containerPointToLatLng([
  //             northWest.x + j * (rectSize + this.padding),
  //             northWest.y + i * (rectSize + this.padding),
  //           ]),
  //           this._map.containerPointToLatLng([
  //             northWest.x + (j + 1) * (rectSize + this.padding),
  //             northWest.y + (i + 1) * (rectSize + this.padding),
  //           ])
  //         ),
  //       };
  //     }
  //   }

  //   // Count number of features in each cell
  //   var gridData = this.gridData;
  //   this.geojsonLayer.eachLayer(function (layer) {
  //     for (var i = 0; i < rows; i++) {
  //       for (var j = 0; j < cols; j++) {
  //         if (gridData[i][j].bounds.contains(layer.getLatLng())) {
  //           gridData[i][j].count++;
  //         }
  //       }
  //     }
  //   });
  // },
  calculateGridData: function (bounds) {
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
        this.gridData[i][j] = {
          count: 0,
          bounds: L.latLngBounds(
            this._map.containerPointToLatLng([
              northWest.x + j * (rectSize + this.padding),
              northWest.y + i * (rectSize + this.padding),
            ]),
            this._map.containerPointToLatLng([
              northWest.x + (j + 1) * (rectSize + this.padding),
              northWest.y + (i + 1) * (rectSize + this.padding),
            ])
          ),
        };
      }
    }

    // Create a new RBush index
    var tree = new rbush();

    // Insert features into the index
    var features = [];
    this.geojsonLayer.eachLayer(function (layer) {
      var latLng = layer.getLatLng();
      features.push({
        minX: latLng.lng,
        minY: latLng.lat,
        maxX: latLng.lng,
        maxY: latLng.lat,
        layer: layer,
      });
    });
    tree.load(features);

    // Count number of features in each cell using the RBush index
    for (var i = 0; i < rows; i++) {
      for (var j = 0; j < cols; j++) {
        var cellBounds = this.gridData[i][j].bounds;
        var results = tree.search({
          minX: cellBounds.getWest(),
          minY: cellBounds.getSouth(),
          maxX: cellBounds.getEast(),
          maxY: cellBounds.getNorth(),
        });
        this.gridData[i][j].count = results.length;
      }
    }
  },

  drawGrid: function (ctx, bounds) {
    // Set the fill style with transparency
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";

    // Convert the bounds to container points
    var northWest = this._map.latLngToContainerPoint(bounds.getNorthWest());
    var southEast = this._map.latLngToContainerPoint(bounds.getSouthEast());

    // Calculate the size of the rectangles in pixels
    var rectSize = this.gridSize;

    // Calculate number of rows and columns
    var cols = Math.ceil((southEast.x - northWest.x) / rectSize);
    var rows = Math.ceil((southEast.y - northWest.y) / rectSize);

    // Draw grid of rectangles with padding
    for (var i = 0; i < rows; i++) {
      for (var j = 0; j < cols; j++) {
        // Only draw the rectangle if the cell contains data
        if (this.gridData[i][j].count > 0) {
          ctx.fillRect(
            northWest.x + j * (rectSize + this.padding),
            northWest.y + i * (rectSize + this.padding),
            rectSize - this.padding,
            rectSize - this.padding
          );
        }
      }
    }
  },
  drawCircles: function (ctx, bounds) {
    // Set the stroke style
    ctx.strokeStyle = "black";

    // Draw circles
    for (var i = 0; i < this.gridData.length; i++) {
      for (var j = 0; j < this.gridData[i].length; j++) {
        // Get cell data
        var cellData = this.gridData[i][j];

        // Convert cell bounds to container points
        var northWest = this._map.latLngToContainerPoint(
          cellData.bounds.getNorthWest()
        );
        var southEast = this._map.latLngToContainerPoint(
          cellData.bounds.getSouthEast()
        );

        // Calculate circle center and radius
        var centerX = (northWest.x + southEast.x) / 2;
        var centerY = (northWest.y + southEast.y) / 2;

        // Calculate the maximum radius based on the size of the cell and the padding between cells
        var maxRadius = Math.min(
          (southEast.x - northWest.x - this.padding) / 2,
          (southEast.y - northWest.y - this.padding) / 2
        );

        // Calculate the radius based on the count of data in the cell
        var radius = Math.min(cellData.count * 5, maxRadius);

        // Draw circle with size that represents number of features in cell
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
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

    // Draw the circles
    this.drawCircles(ctx, bounds);

    // Call the custom draw function if it is defined
    if (this.customDrawFunction) {
      // this.customDrawFunction.call(this, ctx, bounds);
    }
  },
});

L.griddedGlyph = function (geojsonLayer, options) {
  return new L.GriddedGlyph(geojsonLayer, options);
};
