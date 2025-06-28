/**
 * Data Processor Module for GriddedGlyphMap
 * Handles data loading, type detection, normalization, and aggregation
 */

// Data type constants
export const DATA_TYPES = {
  NOMINAL: 'nominal',
  ORDINAL: 'ordinal', 
  NUMERIC: 'numeric',
  TEMPORAL: 'temporal',
  UNKNOWN: 'unknown'
};

// Aggregation function types
export const AGGREGATION_TYPES = {
  COUNT: 'count',
  SUM: 'sum',
  MEAN: 'mean',
  MEDIAN: 'median',
  MODE: 'mode',
  MIN: 'min',
  MAX: 'max',
  STD_DEV: 'std_dev',
  VARIANCE: 'variance',
  PERCENTILE: 'percentile',
  UNIQUE_COUNT: 'unique_count',
  FREQUENCY: 'frequency'
};

/**
 * Data Processor Class
 * Handles all data processing operations
 */
export class DataProcessor {
  constructor(options = {}) {
    this.options = {
      autoDetectTypes: true,
      normalizeData: false,
      defaultAggregation: AGGREGATION_TYPES.COUNT,
      ...options
    };
    
    this.dataSchema = null;
    this.processedData = [];
    this.aggregationCache = new Map();
  }

  /**
   * Load data from various sources
   * @param {Object|Array|string} data - Data source (GeoJSON, CSV string, or array)
   * @param {Object} options - Loading options
   * @returns {Promise<Array>} Processed data array
   */
  async loadData(data, options = {}) {
    const loadOptions = {
      latField: 'lat',
      lngField: 'lng',
      geometryField: 'geometry',
      ...options
    };

    if (typeof data === 'string') {
      // Try to parse as CSV
      return this._loadCSV(data, loadOptions);
    } else if (data.type === 'FeatureCollection') {
      // GeoJSON FeatureCollection
      return this._loadGeoJSON(data, loadOptions);
    } else if (Array.isArray(data)) {
      // Array of objects
      return this._loadArray(data, loadOptions);
    } else {
      throw new Error('Unsupported data format');
    }
  }

  /**
   * Load CSV data
   * @private
   */
  async _loadCSV(csvString, options) {
    const lines = csvString.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      
      headers.forEach((header, index) => {
        row[header] = this._parseValue(values[index]);
      });
      
      data.push(row);
    }

    return this._processRawData(data, options);
  }

  /**
   * Load GeoJSON data
   * @private
   */
  async _loadGeoJSON(geojson, options) {
    const data = [];
    
    geojson.features.forEach(feature => {
      const row = { ...feature.properties };
      
      if (feature.geometry && feature.geometry.type === 'Point') {
        row[options.latField] = feature.geometry.coordinates[1];
        row[options.lngField] = feature.geometry.coordinates[0];
      }
      
      data.push(row);
    });

    return this._processRawData(data, options);
  }

  /**
   * Load array data
   * @private
   */
  async _loadArray(array, options) {
    return this._processRawData(array, options);
  }

  /**
   * Process raw data and detect schema
   * @private
   */
  _processRawData(data, options) {
    this.processedData = data;
    
    if (this.options.autoDetectTypes) {
      this.dataSchema = this._detectSchema(data);
    }
    
    return this.processedData;
  }

  /**
   * Detect data schema and types
   * @private
   */
  _detectSchema(data) {
    if (!data || data.length === 0) return null;

    const schema = {};
    const sample = data[0];
    
    Object.keys(sample).forEach(field => {
      const values = data.map(row => row[field]).filter(v => v !== null && v !== undefined);
      schema[field] = {
        type: this._detectDataType(values),
        originalType: typeof sample[field],
        hasNulls: values.length < data.length,
        uniqueCount: new Set(values).size,
        sampleValues: values.slice(0, 5)
      };
    });

    return schema;
  }

  /**
   * Detect data type for a field
   * @private
   */
  _detectDataType(values) {
    if (values.length === 0) return DATA_TYPES.UNKNOWN;

    const sample = values[0];
    
    // Check if it's a number
    if (typeof sample === 'number' || !isNaN(Number(sample))) {
      const nums = values.map(v => Number(v)).filter(n => !isNaN(n));
      if (nums.length === values.length) {
        return DATA_TYPES.NUMERIC;
      }
    }

    // Check if it's a date
    if (this._isDate(sample)) {
      return DATA_TYPES.TEMPORAL;
    }

    // Check if it's ordinal (has natural ordering)
    if (this._isOrdinal(values)) {
      return DATA_TYPES.ORDINAL;
    }

    // Default to nominal
    return DATA_TYPES.NOMINAL;
  }

  /**
   * Check if value is a date
   * @private
   */
  _isDate(value) {
    if (value instanceof Date) return true;
    if (typeof value === 'string') {
      const date = new Date(value);
      return !isNaN(date.getTime());
    }
    return false;
  }

  /**
   * Check if values have natural ordering (ordinal)
   * @private
   */
  _isOrdinal(values) {
    const uniqueValues = [...new Set(values)];
    if (uniqueValues.length <= 2) return false;
    
    // Check for common ordinal patterns
    const ordinalPatterns = [
      ['low', 'medium', 'high'],
      ['small', 'medium', 'large'],
      ['beginner', 'intermediate', 'advanced'],
      ['poor', 'fair', 'good', 'excellent'],
      ['never', 'rarely', 'sometimes', 'often', 'always']
    ];

    return ordinalPatterns.some(pattern => {
      const lowerValues = uniqueValues.map(v => String(v).toLowerCase());
      return pattern.every(p => lowerValues.includes(p));
    });
  }

  /**
   * Parse value with type conversion
   * @private
   */
  _parseValue(value) {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    // Try to parse as number
    const num = Number(value);
    if (!isNaN(num)) {
      return num;
    }

    // Try to parse as date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Return as string
    return value;
  }

  /**
   * Get data schema
   * @returns {Object} Data schema
   */
  getSchema() {
    return this.dataSchema;
  }

  /**
   * Get field names by type
   * @param {string} type - Data type to filter by
   * @returns {Array} Array of field names
   */
  getFieldsByType(type) {
    if (!this.dataSchema) return [];
    
    return Object.keys(this.dataSchema).filter(field => 
      this.dataSchema[field].type === type
    );
  }

  /**
   * Aggregate data within cells
   * @param {Array} cellData - Array of data points in a cell
   * @param {Object} aggregationConfig - Aggregation configuration
   * @returns {Object} Aggregated results
   */
  aggregateCellData(cellData, aggregationConfig = {}) {
    const config = {
      fields: [],
      aggregations: {},
      ...aggregationConfig
    };

    if (cellData.length === 0) {
      return { count: 0 };
    }

    const results = { count: cellData.length };

    // Apply aggregations for each field
    Object.keys(config.aggregations).forEach(field => {
      const aggregationType = config.aggregations[field];
      const values = cellData.map(row => row[field]).filter(v => v !== null && v !== undefined);
      
      if (values.length > 0) {
        results[field] = this._applyAggregation(values, aggregationType);
      }
    });

    return results;
  }

  /**
   * Apply aggregation function to values
   * @private
   */
  _applyAggregation(values, aggregationType) {
    switch (aggregationType) {
      case AGGREGATION_TYPES.COUNT:
        return values.length;
        
      case AGGREGATION_TYPES.SUM:
        return values.reduce((sum, val) => sum + val, 0);
        
      case AGGREGATION_TYPES.MEAN:
        return values.reduce((sum, val) => sum + val, 0) / values.length;
        
      case AGGREGATION_TYPES.MEDIAN:
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 
          ? (sorted[mid - 1] + sorted[mid]) / 2 
          : sorted[mid];
        
      case AGGREGATION_TYPES.MODE:
        const frequency = {};
        values.forEach(val => {
          frequency[val] = (frequency[val] || 0) + 1;
        });
        return Object.keys(frequency).reduce((a, b) => 
          frequency[a] > frequency[b] ? a : b
        );
        
      case AGGREGATION_TYPES.MIN:
        return Math.min(...values);
        
      case AGGREGATION_TYPES.MAX:
        return Math.max(...values);
        
      case AGGREGATION_TYPES.STD_DEV:
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
        
      case AGGREGATION_TYPES.VARIANCE:
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        return values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
        
      case AGGREGATION_TYPES.UNIQUE_COUNT:
        return new Set(values).size;
        
      case AGGREGATION_TYPES.FREQUENCY:
        const freq = {};
        values.forEach(val => {
          freq[val] = (freq[val] || 0) + 1;
        });
        return freq;
        
      default:
        return values;
    }
  }

  /**
   * Normalize data values
   * @param {Array} values - Array of values to normalize
   * @param {string} method - Normalization method ('minmax', 'zscore', 'decimal')
   * @returns {Array} Normalized values
   */
  normalizeValues(values, method = 'minmax') {
    const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
    
    if (numericValues.length === 0) return values;

    switch (method) {
      case 'minmax':
        const min = Math.min(...numericValues);
        const max = Math.max(...numericValues);
        const range = max - min;
        return numericValues.map(v => range === 0 ? 0 : (v - min) / range);
        
      case 'zscore':
        const mean = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
        const stdDev = Math.sqrt(
          numericValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / numericValues.length
        );
        return numericValues.map(v => stdDev === 0 ? 0 : (v - mean) / stdDev);
        
      case 'decimal':
        const maxVal = Math.max(...numericValues);
        return numericValues.map(v => maxVal === 0 ? 0 : v / maxVal);
        
      default:
        return numericValues;
    }
  }

  /**
   * Create aggregation configuration based on data schema
   * @param {Array} fields - Fields to aggregate
   * @returns {Object} Aggregation configuration
   */
  createAggregationConfig(fields) {
    if (!this.dataSchema) return {};

    const aggregations = {};
    
    fields.forEach(field => {
      if (this.dataSchema[field]) {
        const fieldType = this.dataSchema[field].type;
        
        switch (fieldType) {
          case DATA_TYPES.NUMERIC:
            aggregations[field] = AGGREGATION_TYPES.MEAN;
            break;
          case DATA_TYPES.NOMINAL:
          case DATA_TYPES.ORDINAL:
            aggregations[field] = AGGREGATION_TYPES.FREQUENCY;
            break;
          case DATA_TYPES.TEMPORAL:
            aggregations[field] = AGGREGATION_TYPES.MODE;
            break;
          default:
            aggregations[field] = AGGREGATION_TYPES.COUNT;
        }
      }
    });

    return { fields, aggregations };
  }

  /**
   * Get suggested visualization types for fields
   * @param {Array} fields - Fields to analyze
   * @returns {Object} Suggested visualization types
   */
  getVisualizationSuggestions(fields) {
    if (!this.dataSchema) return {};

    const suggestions = {};
    
    fields.forEach(field => {
      if (this.dataSchema[field]) {
        const fieldType = this.dataSchema[field].type;
        const uniqueCount = this.dataSchema[field].uniqueCount;
        
        switch (fieldType) {
          case DATA_TYPES.NUMERIC:
            suggestions[field] = ['bar', 'line', 'scatter', 'histogram'];
            break;
          case DATA_TYPES.NOMINAL:
            suggestions[field] = uniqueCount <= 10 ? ['pie', 'bar', 'donut'] : ['bar', 'treemap'];
            break;
          case DATA_TYPES.ORDINAL:
            suggestions[field] = ['bar', 'line', 'area'];
            break;
          case DATA_TYPES.TEMPORAL:
            suggestions[field] = ['line', 'area', 'bar'];
            break;
          default:
            suggestions[field] = ['text', 'icon'];
        }
      }
    });

    return suggestions;
  }

  /**
   * Clear cache and reset processor
   */
  reset() {
    this.aggregationCache.clear();
    this.processedData = [];
    this.dataSchema = null;
  }
}

/**
 * Create a data processor instance
 * @param {Object} options - Processor options
 * @returns {DataProcessor} Data processor instance
 */
export function createDataProcessor(options = {}) {
  return new DataProcessor(options);
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.DataProcessor = DataProcessor;
  window.createDataProcessor = createDataProcessor;
  window.DATA_TYPES = DATA_TYPES;
  window.AGGREGATION_TYPES = AGGREGATION_TYPES;
} 