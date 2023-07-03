onmessage = function (e) {
  // Get data from the main thread
  var gridData = e.data.gridData;
  var features = e.data.features;

  // Count number of features in each cell
  for (var i = 0; i < features.length; i++) {
    var feature = features[i];
    for (var j = 0; j < gridData.length; j++) {
      for (var k = 0; k < gridData[j].length; k++) {
        if (gridData[j][k].bounds.contains(feature.geometry.coordinates)) {
          gridData[j][k].count++;
        }
      }
    }
  }

  // Send updated grid data back to the main thread
  postMessage({ gridData: gridData });
};
