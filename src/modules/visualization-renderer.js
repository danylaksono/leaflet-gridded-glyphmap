/**
 * Visualization Renderer Module for GriddedGlyphMap
 * Handles drawing different chart types on canvas
 */

import { DATA_TYPES } from './data-processor.js';

// Chart type constants
export const CHART_TYPES = {
  BAR: 'bar',
  PIE: 'pie',
  LINE: 'line',
  SCATTER: 'scatter',
  HISTOGRAM: 'histogram',
  DONUT: 'donut',
  TREEMAP: 'treemap',
  TEXT: 'text',
  ICON: 'icon',
  CIRCLE: 'circle'
};

/**
 * Visualization Renderer Class
 * Handles drawing charts on canvas
 */
export class VisualizationRenderer {
  constructor(options = {}) {
    this.options = {
      defaultColors: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
      ],
      fontSize: 12,
      fontFamily: 'Arial, sans-serif',
      strokeWidth: 1,
      ...options
    };
  }

  /**
   * Draw a chart on canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} cellData - Cell data with aggregated values
   * @param {Object} config - Visualization configuration
   * @param {number} centerX - Center X coordinate
   * @param {number} centerY - Center Y coordinate
   * @param {number} size - Available size for drawing
   */
  drawChart(ctx, cellData, config, centerX, centerY, size) {
    const chartType = config.type || CHART_TYPES.CIRCLE;
    
    switch (chartType) {
      case CHART_TYPES.BAR:
        this._drawBarChart(ctx, cellData, config, centerX, centerY, size);
        break;
      case CHART_TYPES.PIE:
        this._drawPieChart(ctx, cellData, config, centerX, centerY, size);
        break;
      case CHART_TYPES.LINE:
        this._drawLineChart(ctx, cellData, config, centerX, centerY, size);
        break;
      case CHART_TYPES.SCATTER:
        this._drawScatterPlot(ctx, cellData, config, centerX, centerY, size);
        break;
      case CHART_TYPES.HISTOGRAM:
        this._drawHistogram(ctx, cellData, config, centerX, centerY, size);
        break;
      case CHART_TYPES.DONUT:
        this._drawDonutChart(ctx, cellData, config, centerX, centerY, size);
        break;
      case CHART_TYPES.TREEMAP:
        this._drawTreemap(ctx, cellData, config, centerX, centerY, size);
        break;
      case CHART_TYPES.TEXT:
        this._drawText(ctx, cellData, config, centerX, centerY, size);
        break;
      case CHART_TYPES.ICON:
        this._drawIcon(ctx, cellData, config, centerX, centerY, size);
        break;
      case CHART_TYPES.CIRCLE:
      default:
        this._drawCircle(ctx, cellData, config, centerX, centerY, size);
        break;
    }
  }

  /**
   * Draw bar chart
   * @private
   */
  _drawBarChart(ctx, cellData, config, centerX, centerY, size) {
    const field = config.field;
    const value = cellData[field];
    
    if (value === undefined || value === null) return;

    const maxValue = config.maxValue || value;
    const barHeight = (value / maxValue) * size * 0.8;
    const barWidth = size * 0.6;
    
    // Draw bar
    ctx.fillStyle = config.color || this.options.defaultColors[0];
    ctx.fillRect(
      centerX - barWidth / 2,
      centerY + size / 2 - barHeight,
      barWidth,
      barHeight
    );
    
    // Draw border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = this.options.strokeWidth;
    ctx.strokeRect(
      centerX - barWidth / 2,
      centerY + size / 2 - barHeight,
      barWidth,
      barHeight
    );
  }

  /**
   * Draw pie chart
   * @private
   */
  _drawPieChart(ctx, cellData, config, centerX, centerY, size) {
    const field = config.field;
    const data = cellData[field];
    
    if (!data || typeof data !== 'object') return;

    const radius = size * 0.4;
    const entries = Object.entries(data);
    const total = entries.reduce((sum, [_, value]) => sum + value, 0);
    
    if (total === 0) return;

    let currentAngle = -Math.PI / 2; // Start from top
    
    entries.forEach(([key, value], index) => {
      const sliceAngle = (value / total) * 2 * Math.PI;
      
      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      
      ctx.fillStyle = this.options.defaultColors[index % this.options.defaultColors.length];
      ctx.fill();
      
      // Draw border
      ctx.strokeStyle = '#000';
      ctx.lineWidth = this.options.strokeWidth;
      ctx.stroke();
      
      currentAngle += sliceAngle;
    });
  }

  /**
   * Draw line chart
   * @private
   */
  _drawLineChart(ctx, cellData, config, centerX, centerY, size) {
    const field = config.field;
    const data = cellData[field];
    
    if (!Array.isArray(data) || data.length < 2) return;

    const width = size * 0.8;
    const height = size * 0.6;
    const padding = size * 0.1;
    
    const maxValue = Math.max(...data);
    const minValue = Math.min(...data);
    const range = maxValue - minValue;
    
    if (range === 0) return;

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = config.color || this.options.defaultColors[0];
    ctx.lineWidth = 2;
    
    data.forEach((value, index) => {
      const x = centerX - width / 2 + (index / (data.length - 1)) * width;
      const y = centerY + height / 2 - ((value - minValue) / range) * height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
  }

  /**
   * Draw scatter plot
   * @private
   */
  _drawScatterPlot(ctx, cellData, config, centerX, centerY, size) {
    const xField = config.xField;
    const yField = config.yField;
    
    if (!xField || !yField) return;

    const xValues = cellData[xField];
    const yValues = cellData[yField];
    
    if (!Array.isArray(xValues) || !Array.isArray(yValues)) return;

    const radius = size * 0.05;
    const maxRadius = size * 0.1;
    
    xValues.forEach((x, index) => {
      const y = yValues[index];
      if (x === null || y === null) return;
      
      // Normalize coordinates to cell space
      const normalizedX = centerX + (x - Math.min(...xValues)) / (Math.max(...xValues) - Math.min(...xValues)) * size * 0.6 - size * 0.3;
      const normalizedY = centerY - (y - Math.min(...yValues)) / (Math.max(...yValues) - Math.min(...yValues)) * size * 0.6 + size * 0.3;
      
      ctx.beginPath();
      ctx.arc(normalizedX, normalizedY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = config.color || this.options.defaultColors[0];
      ctx.fill();
    });
  }

  /**
   * Draw histogram
   * @private
   */
  _drawHistogram(ctx, cellData, config, centerX, centerY, size) {
    const field = config.field;
    const data = cellData[field];
    
    if (!Array.isArray(data) || data.length === 0) return;

    const width = size * 0.8;
    const height = size * 0.6;
    const bins = config.bins || 5;
    
    // Create histogram bins
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binSize = (max - min) / bins;
    
    const histogram = new Array(bins).fill(0);
    data.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binSize), bins - 1);
      histogram[binIndex]++;
    });
    
    const maxCount = Math.max(...histogram);
    
    // Draw bars
    const barWidth = width / bins;
    histogram.forEach((count, index) => {
      const barHeight = (count / maxCount) * height;
      const x = centerX - width / 2 + index * barWidth;
      const y = centerY + height / 2 - barHeight;
      
      ctx.fillStyle = this.options.defaultColors[index % this.options.defaultColors.length];
      ctx.fillRect(x, y, barWidth * 0.8, barHeight);
    });
  }

  /**
   * Draw donut chart
   * @private
   */
  _drawDonutChart(ctx, cellData, config, centerX, centerY, size) {
    const field = config.field;
    const data = cellData[field];
    
    if (!data || typeof data !== 'object') return;

    const outerRadius = size * 0.4;
    const innerRadius = size * 0.2;
    const entries = Object.entries(data);
    const total = entries.reduce((sum, [_, value]) => sum + value, 0);
    
    if (total === 0) return;

    let currentAngle = -Math.PI / 2;
    
    entries.forEach(([key, value], index) => {
      const sliceAngle = (value / total) * 2 * Math.PI;
      
      // Draw outer arc
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, currentAngle, currentAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
      ctx.closePath();
      
      ctx.fillStyle = this.options.defaultColors[index % this.options.defaultColors.length];
      ctx.fill();
      
      currentAngle += sliceAngle;
    });
  }

  /**
   * Draw treemap
   * @private
   */
  _drawTreemap(ctx, cellData, config, centerX, centerY, size) {
    const field = config.field;
    const data = cellData[field];
    
    if (!data || typeof data !== 'object') return;

    const entries = Object.entries(data);
    const total = entries.reduce((sum, [_, value]) => sum + value, 0);
    
    if (total === 0) return;

    const width = size * 0.8;
    const height = size * 0.6;
    const x = centerX - width / 2;
    const y = centerY - height / 2;
    
    // Simple treemap layout
    let currentX = x;
    let currentY = y;
    let rowHeight = 0;
    
    entries.forEach(([key, value], index) => {
      const area = (value / total) * width * height;
      const rectWidth = Math.sqrt(area * (width / height));
      const rectHeight = area / rectWidth;
      
      if (currentX + rectWidth > x + width) {
        currentX = x;
        currentY += rowHeight;
        rowHeight = 0;
      }
      
      ctx.fillStyle = this.options.defaultColors[index % this.options.defaultColors.length];
      ctx.fillRect(currentX, currentY, rectWidth, rectHeight);
      
      currentX += rectWidth;
      rowHeight = Math.max(rowHeight, rectHeight);
    });
  }

  /**
   * Draw text
   * @private
   */
  _drawText(ctx, cellData, config, centerX, centerY, size) {
    const field = config.field;
    const value = cellData[field];
    
    if (value === undefined || value === null) return;

    ctx.fillStyle = config.color || '#000';
    ctx.font = `${this.options.fontSize}px ${this.options.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const text = String(value);
    const maxWidth = size * 0.8;
    
    // Truncate text if too long
    let displayText = text;
    while (ctx.measureText(displayText).width > maxWidth && displayText.length > 0) {
      displayText = displayText.slice(0, -1);
    }
    
    ctx.fillText(displayText, centerX, centerY);
  }

  /**
   * Draw icon
   * @private
   */
  _drawIcon(ctx, cellData, config, centerX, centerY, size) {
    const field = config.field;
    const value = cellData[field];
    
    if (value === undefined || value === null) return;

    const iconSize = size * 0.4;
    
    // Simple icon drawing based on value type
    if (typeof value === 'number') {
      // Draw a number icon
      ctx.fillStyle = config.color || this.options.defaultColors[0];
      ctx.beginPath();
      ctx.arc(centerX, centerY, iconSize, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.font = `${this.options.fontSize}px ${this.options.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(value), centerX, centerY);
    } else {
      // Draw a text icon
      ctx.fillStyle = config.color || this.options.defaultColors[0];
      ctx.fillRect(centerX - iconSize, centerY - iconSize, iconSize * 2, iconSize * 2);
      
      ctx.fillStyle = '#fff';
      ctx.font = `${this.options.fontSize}px ${this.options.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(value).charAt(0).toUpperCase(), centerX, centerY);
    }
  }

  /**
   * Draw circle (default)
   * @private
   */
  _drawCircle(ctx, cellData, config, centerX, centerY, size) {
    const field = config.field || 'count';
    const value = cellData[field];
    
    if (value === undefined || value === null) return;

    const maxValue = config.maxValue || value;
    const radius = Math.min((value / maxValue) * size * 0.4, size * 0.4);
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = config.color || this.options.defaultColors[0];
    ctx.fill();
    
    ctx.strokeStyle = '#000';
    ctx.lineWidth = this.options.strokeWidth;
    ctx.stroke();
  }

  /**
   * Create visualization configuration based on data type
   * @param {string} field - Field name
   * @param {string} dataType - Data type
   * @param {Object} options - Additional options
   * @returns {Object} Visualization configuration
   */
  createVisualizationConfig(field, dataType, options = {}) {
    const baseConfig = {
      field: field,
      color: options.color,
      ...options
    };

    switch (dataType) {
      case DATA_TYPES.NUMERIC:
        return {
          ...baseConfig,
          type: options.chartType || CHART_TYPES.BAR,
          maxValue: options.maxValue
        };
        
      case DATA_TYPES.NOMINAL:
        return {
          ...baseConfig,
          type: options.chartType || CHART_TYPES.PIE
        };
        
      case DATA_TYPES.ORDINAL:
        return {
          ...baseConfig,
          type: options.chartType || CHART_TYPES.BAR
        };
        
      case DATA_TYPES.TEMPORAL:
        return {
          ...baseConfig,
          type: options.chartType || CHART_TYPES.LINE
        };
        
      default:
        return {
          ...baseConfig,
          type: options.chartType || CHART_TYPES.TEXT
        };
    }
  }

  /**
   * Get available chart types for a data type
   * @param {string} dataType - Data type
   * @returns {Array} Available chart types
   */
  getAvailableChartTypes(dataType) {
    switch (dataType) {
      case DATA_TYPES.NUMERIC:
        return [CHART_TYPES.BAR, CHART_TYPES.LINE, CHART_TYPES.SCATTER, CHART_TYPES.HISTOGRAM, CHART_TYPES.CIRCLE];
        
      case DATA_TYPES.NOMINAL:
        return [CHART_TYPES.PIE, CHART_TYPES.BAR, CHART_TYPES.DONUT, CHART_TYPES.TREEMAP, CHART_TYPES.TEXT];
        
      case DATA_TYPES.ORDINAL:
        return [CHART_TYPES.BAR, CHART_TYPES.LINE, CHART_TYPES.AREA];
        
      case DATA_TYPES.TEMPORAL:
        return [CHART_TYPES.LINE, CHART_TYPES.AREA, CHART_TYPES.BAR];
        
      default:
        return [CHART_TYPES.TEXT, CHART_TYPES.ICON, CHART_TYPES.CIRCLE];
    }
  }
}

/**
 * Create a visualization renderer instance
 * @param {Object} options - Renderer options
 * @returns {VisualizationRenderer} Visualization renderer instance
 */
export function createVisualizationRenderer(options = {}) {
  return new VisualizationRenderer(options);
}

// Export for browser environment
if (typeof window !== 'undefined') {
  window.VisualizationRenderer = VisualizationRenderer;
  window.createVisualizationRenderer = createVisualizationRenderer;
  window.CHART_TYPES = CHART_TYPES;
} 