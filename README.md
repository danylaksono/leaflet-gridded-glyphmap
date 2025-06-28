# Leaflet Gridded Glyph Map

A Leaflet plugin for creating gridded glyph visualizations on maps. This plugin aggregates point data into grid cells and displays glyphs representing the aggregated data.

## Features

- **Static Mode**: Traditional grid aggregation fixed in geographic space
- **Dynamic Mode**: Real-time grid reaggregation responding to mouse movement, pan, and zoom
- **Multiple Grid Types**: Square and hexagonal grids (with support for H3 and S2 planned)
- **Customizable Glyphs**: Custom drawing functions for unique visualizations
- **Performance Optimized**: Efficient spatial indexing and caching
- **Interactive**: Mouse interaction and tooltip support

## Installation

```bash
npm install leaflet-gridded-glyph
```

## Basic Usage

```javascript
// Create a GeoJSON layer with your point data
const geojsonLayer = L.geoJSON(data);

// Create the gridded glyph layer
const griddedGlyph = L.griddedGlyph({
    geojsonLayer: geojsonLayer,
    gridSize: 20,
    padding: 5,
    gridType: 'square'
});

// Add to map
griddedGlyph.addTo(map);
```

## Dynamic Mode

The dynamic mode provides real-time reaggregation of data based on user interaction. This is particularly useful for exploratory data analysis and interactive visualizations.

### Basic Dynamic Mode Usage

```javascript
const griddedGlyph = L.griddedGlyph({
    geojsonLayer: geojsonLayer,
    gridSize: 20,
    dynamicMode: true,  // Enable dynamic mode
    dynamicThrottle: 16, // Throttle updates (60fps)
    gridType: 'square'   // or 'hexagon'
});
```

### Dynamic Mode Options

- `dynamicMode` (boolean): Enable/disable dynamic reaggregation (default: false)
- `dynamicThrottle` (number): Throttle updates in milliseconds (default: 16)
- `dynamicAggregationFn` (function): Custom aggregation function for dynamic mode

### Custom Aggregation Function

```javascript
const griddedGlyph = L.griddedGlyph({
    geojsonLayer: geojsonLayer,
    dynamicMode: true,
    dynamicAggregationFn: function(spatialUnit, datum, weight, global, panel) {
        // Custom aggregation logic
        spatialUnit.customValue = (spatialUnit.customValue || 0) + datum.properties.value;
        spatialUnit.averageValue = spatialUnit.customValue / spatialUnit.count;
    }
});
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `geojsonLayer` | L.GeoJSON | required | The GeoJSON layer containing point data |
| `gridSize` | number | 20 | Size of grid cells in pixels |
| `padding` | number | 5 | Padding between grid cells |
| `gridType` | string | 'square' | Grid type: 'square', 'hexagon' |
| `dynamicMode` | boolean | false | Enable dynamic reaggregation |
| `dynamicThrottle` | number | 16 | Throttle dynamic updates (ms) |
| `dynamicAggregationFn` | function | null | Custom aggregation function |
| `customDrawFunction` | function | null | Custom glyph drawing function |
| `debug` | boolean | false | Enable debug logging |

## Grid Types

### Square Grid
Traditional rectangular grid cells. Best for general-purpose visualizations.

```javascript
const griddedGlyph = L.griddedGlyph({
    gridType: 'square',
    gridSize: 20
});
```

### Hexagonal Grid
Hexagonal grid cells providing more uniform cell shapes and better visual flow.

```javascript
const griddedGlyph = L.griddedGlyph({
    gridType: 'hexagon',
    gridSize: 20
});
```

## Custom Drawing Functions

You can provide custom functions to draw unique glyphs for each grid cell:

```javascript
const griddedGlyph = L.griddedGlyph({
    geojsonLayer: geojsonLayer,
    customDrawFunction: function(ctx, cellData, centerX, centerY) {
        // Draw custom glyph based on cellData
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        
        // Example: draw circle with size based on count
        const radius = Math.min(cellData.count * 3, 20);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Add text label
        if (cellData.count > 0) {
            ctx.fillStyle = '#000';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(cellData.count.toString(), centerX, centerY + 4);
        }
    }
});
```

## API Methods

### Core Methods

- `addTo(map)`: Add the layer to a map
- `remove()`: Remove the layer from the map
- `redraw()`: Force a redraw of the layer

### Cache Management

- `invalidateCache()`: Clear all cached data
- `invalidateDynamicCache()`: Clear dynamic mode cache only
- `getCacheStats()`: Get cache statistics for debugging

### Dynamic Mode Methods

- `setDynamicMode(enabled)`: Enable/disable dynamic mode
- `setDynamicThrottle(ms)`: Set update throttle time

## Performance Considerations

### Static Mode
- Uses RBush spatial indexing for efficient queries
- Caches grid calculations until map changes
- Best for large datasets with infrequent updates

### Dynamic Mode
- Uses screen-coordinate based discretizers
- Throttled updates prevent performance issues
- Viewport culling reduces processing overhead
- Best for interactive exploration and smaller datasets

## Examples

See the `examples/` directory for complete working examples:

- `basic-example.html`: Basic static mode usage
- `dynamic-mode-example.html`: Dynamic mode with interactive controls
- `custom-glyphs-example.html`: Custom drawing functions

## Browser Support

- Modern browsers with ES6 support
- Canvas API support required
- Leaflet 1.0+ required

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
