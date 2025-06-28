# Enhanced GriddedGlyphMap Library

A powerful Leaflet.js plugin for creating gridded data visualizations with advanced data processing and multiple chart types.

## Overview

The Enhanced GriddedGlyphMap library extends the original gridded glyphmap functionality with comprehensive data processing capabilities, automatic data type detection, statistical aggregation, and multiple visualization options. It transforms your map into a canvas for rich data visualizations.

## Key Features

### 🎯 **Advanced Data Processing**
- **Multi-format Support**: Load data from GeoJSON, CSV, or arrays
- **Automatic Type Detection**: Automatically detects nominal, ordinal, numeric, and temporal data types
- **Data Normalization**: Built-in normalization methods (min-max, z-score, decimal scaling)
- **Schema Analysis**: Comprehensive data schema analysis with statistics

### 📊 **Statistical Aggregation**
- **Multiple Aggregation Types**: Count, sum, mean, median, mode, min, max, standard deviation, variance
- **Frequency Analysis**: For categorical data
- **Custom Aggregation**: Support for custom aggregation functions
- **Global Statistics**: Calculate global statistics for normalization

### 🎨 **Rich Visualizations**
- **Multiple Chart Types**: Bar charts, pie charts, line charts, scatter plots, histograms, donut charts, treemaps
- **Text & Icons**: Display text values or icons
- **Customizable Colors**: Configurable color schemes
- **Responsive Design**: Charts adapt to cell size

### 🔧 **Flexible Configuration**
- **Grid Types**: Square and hexagonal grids
- **Dynamic Mode**: Real-time reaggregation on map movement
- **Performance Optimization**: Intelligent caching and throttling
- **Debug Mode**: Comprehensive debugging and monitoring

## Installation

```bash
npm install leaflet-gridded-glyphmap
```

Or include the files directly:

```html
<script src="src/modules/data-processor.js" type="module"></script>
<script src="src/modules/visualization-renderer.js" type="module"></script>
<script src="src/index.js" type="module"></script>
```

## Quick Start

```javascript
import { createDataProcessor, DATA_TYPES, AGGREGATION_TYPES } from './src/modules/data-processor.js';
import { createVisualizationRenderer, CHART_TYPES } from './src/modules/visualization-renderer.js';

// Create a map
const map = L.map('map').setView([0, 0], 2);

// Add your GeoJSON layer
const geoJsonLayer = L.geoJSON(yourData).addTo(map);

// Create enhanced gridded glyph layer
const griddedGlyphLayer = L.griddedGlyph({
    geojsonLayer: geoJsonLayer,
    gridSize: 30,
    gridType: 'hexagon',
    debug: true,
    
    // Data processing options
    dataProcessorOptions: {
        autoDetectTypes: true,
        normalizeData: false
    },
    
    // Visualization options
    visualizationOptions: {
        defaultColors: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
        fontSize: 12
    }
}).addTo(map);

// Load and process data
await griddedGlyphLayer.loadData(yourData);

// Set fields for visualization
griddedGlyphLayer.setSelectedFields(['population', 'crime_rate', 'district']);

// Configure visualization
griddedGlyphLayer.setVisualizationConfig({
    type: 'bar',
    field: 'population',
    maxValue: 1000000
});
```

## Data Processing

### Supported Data Types

```javascript
import { DATA_TYPES } from './src/modules/data-processor.js';

// Available data types
DATA_TYPES.NOMINAL    // Categorical data (e.g., city names)
DATA_TYPES.ORDINAL    // Ordered categories (e.g., low/medium/high)
DATA_TYPES.NUMERIC    // Numerical data (e.g., population, temperature)
DATA_TYPES.TEMPORAL   // Date/time data
DATA_TYPES.UNKNOWN    // Undetermined type
```

### Aggregation Types

```javascript
import { AGGREGATION_TYPES } from './src/modules/data-processor.js';

// Available aggregation types
AGGREGATION_TYPES.COUNT        // Count of records
AGGREGATION_TYPES.SUM          // Sum of values
AGGREGATION_TYPES.MEAN         // Average
AGGREGATION_TYPES.MEDIAN       // Median value
AGGREGATION_TYPES.MODE         // Most frequent value
AGGREGATION_TYPES.MIN          // Minimum value
AGGREGATION_TYPES.MAX          // Maximum value
AGGREGATION_TYPES.STD_DEV      // Standard deviation
AGGREGATION_TYPES.VARIANCE     // Variance
AGGREGATION_TYPES.FREQUENCY    // Frequency distribution
AGGREGATION_TYPES.UNIQUE_COUNT // Count of unique values
```

### Data Loading Examples

```javascript
// Load GeoJSON data
const geoJsonData = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: {
                population: 100000,
                crime_rate: 5.2,
                district: "Downtown"
            },
            geometry: { type: "Point", coordinates: [0, 0] }
        }
    ]
};

await griddedGlyphLayer.loadData(geoJsonData);

// Load CSV data
const csvData = `lat,lng,population,crime_rate,district
0,0,100000,5.2,Downtown
1,1,150000,4.8,Uptown`;

await griddedGlyphLayer.loadData(csvData, {
    latField: 'lat',
    lngField: 'lng'
});

// Load array data
const arrayData = [
    { lat: 0, lng: 0, population: 100000, crime_rate: 5.2 },
    { lat: 1, lng: 1, population: 150000, crime_rate: 4.8 }
];

await griddedGlyphLayer.loadData(arrayData);
```

## Visualization Types

### Available Chart Types

```javascript
import { CHART_TYPES } from './src/modules/visualization-renderer.js';

// Available chart types
CHART_TYPES.BAR         // Bar chart
CHART_TYPES.PIE         // Pie chart
CHART_TYPES.LINE        // Line chart
CHART_TYPES.SCATTER     // Scatter plot
CHART_TYPES.HISTOGRAM   // Histogram
CHART_TYPES.DONUT       // Donut chart
CHART_TYPES.TREEMAP     // Treemap
CHART_TYPES.TEXT        // Text display
CHART_TYPES.ICON        // Icon display
CHART_TYPES.CIRCLE      // Circle (default)
```

### Visualization Configuration Examples

```javascript
// Bar chart for numeric data
griddedGlyphLayer.setVisualizationConfig({
    type: 'bar',
    field: 'population',
    maxValue: 1000000,
    color: '#FF6B6B'
});

// Pie chart for categorical data
griddedGlyphLayer.setVisualizationConfig({
    type: 'pie',
    field: 'district'
});

// Text display
griddedGlyphLayer.setVisualizationConfig({
    type: 'text',
    field: 'district',
    color: '#000'
});

// Custom visualization
griddedGlyphLayer.setVisualizationConfig({
    type: 'custom',
    renderFunction: (ctx, cellData, centerX, centerY, size) => {
        // Custom drawing logic
    }
});
```

## API Reference

### Core Methods

#### `loadData(data, options)`
Load and process data from various sources.

**Parameters:**
- `data`: GeoJSON, CSV string, or array of objects
- `options`: Loading options (latField, lngField, etc.)

**Returns:** Promise<Array> - Processed data

#### `getDataSchema()`
Get the detected data schema.

**Returns:** Object - Data schema with type information

#### `getFieldsByType(type)`
Get field names by data type.

**Parameters:**
- `type`: Data type (DATA_TYPES.NOMINAL, etc.)

**Returns:** Array - Field names

#### `setSelectedFields(fields)`
Set fields for aggregation and visualization.

**Parameters:**
- `fields`: Array of field names

#### `setVisualizationConfig(config)`
Configure visualization settings.

**Parameters:**
- `config`: Visualization configuration object

#### `getGlobalStats()`
Get global statistics for all numeric fields.

**Returns:** Object - Global statistics

#### `getVisualizationSuggestions(fields)`
Get suggested visualization types for fields.

**Parameters:**
- `fields`: Array of field names

**Returns:** Object - Visualization suggestions

### Configuration Options

```javascript
const options = {
    // Grid options
    gridSize: 30,
    padding: 2,
    gridType: 'hexagon', // 'square' or 'hexagon'
    
    // Data processing
    dataProcessorOptions: {
        autoDetectTypes: true,
        normalizeData: false,
        defaultAggregation: AGGREGATION_TYPES.COUNT
    },
    
    // Visualization
    visualizationOptions: {
        defaultColors: ['#FF6B6B', '#4ECDC4', '#45B7D1'],
        fontSize: 12,
        fontFamily: 'Arial, sans-serif',
        strokeWidth: 1
    },
    
    // Performance
    dynamicMode: false,
    dynamicThrottle: 16,
    debug: false
};
```

## Examples

### Basic Crime Data Visualization

```javascript
// Load crime data
const crimeData = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: {
                crime_type: "Theft",
                severity: "Medium",
                age: 25,
                district: "Downtown"
            },
            geometry: { type: "Point", coordinates: [0, 0] }
        }
        // ... more features
    ]
};

// Initialize layer
const layer = L.griddedGlyph({
    geojsonLayer: L.geoJSON(crimeData),
    gridSize: 25,
    gridType: 'hexagon'
}).addTo(map);

// Load and configure
await layer.loadData(crimeData);
layer.setSelectedFields(['crime_type', 'severity', 'age']);
layer.setVisualizationConfig({
    type: 'pie',
    field: 'crime_type'
});
```

### Population Density with Bar Charts

```javascript
// Load population data
const populationData = [
    { lat: 0, lng: 0, population: 100000, density: 5000 },
    { lat: 1, lng: 1, population: 150000, density: 7500 }
];

// Initialize layer
const layer = L.griddedGlyph({
    geojsonLayer: L.geoJSON(populationData),
    gridSize: 30,
    gridType: 'square'
}).addTo(map);

// Load and configure
await layer.loadData(populationData);
layer.setSelectedFields(['population', 'density']);
layer.setVisualizationConfig({
    type: 'bar',
    field: 'population',
    maxValue: 200000
});
```

## Performance Considerations

### Caching
The library implements intelligent caching to avoid unnecessary recalculations:
- Grid data is cached based on zoom level, bounds, and data hash
- Screen coordinates are cached for dynamic mode
- Aggregation results are cached per cell

### Dynamic Mode
For real-time applications, enable dynamic mode:
```javascript
const layer = L.griddedGlyph({
    dynamicMode: true,
    dynamicThrottle: 16 // 60 FPS
});
```

### Large Datasets
For large datasets:
- Use appropriate grid sizes
- Enable debug mode to monitor performance
- Consider using static mode for better performance
- Use data sampling for initial exploration

## Browser Support

- Modern browsers with ES6+ support
- Canvas API support required
- Leaflet.js 1.9.4 or higher

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Changelog

### v2.0.0 (Enhanced Version)
- ✨ Added comprehensive data processing module
- ✨ Added visualization renderer with multiple chart types
- ✨ Added automatic data type detection
- ✨ Added statistical aggregation functions
- ✨ Added data normalization capabilities
- ✨ Added CSV data loading support
- ✨ Added visualization suggestions
- ✨ Improved performance with intelligent caching
- ✨ Added comprehensive API documentation
- ✨ Added interactive examples

### v1.0.0 (Original Version)
- Basic gridded glyphmap functionality
- Square and hexagonal grids
- Simple circle visualizations
- GeoJSON data support 