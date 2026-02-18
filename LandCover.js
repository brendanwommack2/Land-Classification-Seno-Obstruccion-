// 1. SETUP & COLLECTION

var StudyArea = ProposedArea

// For better performance, but a simplified polygon
//var StudyArea = ProposedArea.simplify(100);

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(StudyArea)
  // 4–5 month growing season (Spring/Summer in Southern Hemisphere)
  .filterDate('2023-10-01', '2024-02-28') 
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));

print('Image count:', s2.size());

// 2. FUNCTIONS: MASKING & INDICES

function maskS2(image) {
  var scl = image.select('SCL');
  var mask = scl.neq(3)  // cloud shadow
    .and(scl.neq(8))     // medium cloud
    .and(scl.neq(9))     // high cloud
    .and(scl.neq(10))    // cirrus
    .and(scl.neq(11));   // snow
  return image.updateMask(mask);
}

function addIndices(image) {
  // Scale reflectance bands to 0–1
  var scaled = image.select(['B2','B3','B4','B8','B11','B12'])
                    .multiply(0.0001);

  // 1. NDVI (Vegetation Health)
  var ndvi = scaled.normalizedDifference(['B8', 'B4']).rename('NDVI');
  
  // 2. NDMI (Moisture Content)
  var ndmi = scaled.normalizedDifference(['B8', 'B11']).rename('NDMI');
  
  // 3. EVI (Structure & Biomass - better for dense forest)
  var evi = scaled.expression(
    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      'NIR': scaled.select('B8'),
      'RED': scaled.select('B4'),
      'BLUE': scaled.select('B2')
    }).rename('EVI');

  // 4. Tasseled Cap Wetness
  var wetness = scaled.expression(
    '(0.1509 * B2) + (0.1973 * B3) + (0.3279 * B4) + (0.3406 * B8) - (0.7112 * B11) - (0.4572 * B12)',
    { 'B2': scaled.select('B2'), 'B3': scaled.select('B3'), 'B4': scaled.select('B4'),
      'B8': scaled.select('B8'), 'B11': scaled.select('B11'), 'B12': scaled.select('B12') }
  ).rename('WETNESS');

  // Return the original scaled bands PLUS our new indices
  return scaled
    .addBands([ndvi, ndmi, evi, wetness])
    .copyProperties(image, image.propertyNames());
}

// 3. PROCESSING

// Apply masking and index calculation to the whole collection FIRST
var s2Processed = s2.map(maskS2).map(addIndices);

print("Indices & Masking complete");

// Create Temporal Composite (Median)
var median = s2Processed.median().clip(StudyArea);

// Create Temporal Variance (Standard Deviation of Moisture)
// This helps distinguish permanent lakes vs. seasonal peat bogs
var ndmiStd = s2Processed.select('NDMI').reduce(ee.Reducer.stdDev())
  .rename('NDMI_std')
  .clip(StudyArea);

// Load Topography and Normalize
var terrain = ee.Algorithms.Terrain(ee.Image('USGS/SRTMGL1_003'));
// Divide by 90 (max theoretical slope) to scale to 0-1 range
var slope = terrain.select('slope').divide(90).rename('slope_norm').clip(StudyArea);

// Seasonal Metrics
var ndviMax = s2Processed.select('NDVI').reduce(ee.Reducer.max()).rename('NDVI_max').clip(StudyArea);

var ndviMin = s2Processed.select('NDVI').reduce(ee.Reducer.min()).rename('NDVI_min').clip(StudyArea);

var ndviAmp = ndviMax.subtract(ndviMin).rename('NDVI_amp');

var ndmiMax = s2Processed.select('NDMI').reduce(ee.Reducer.max()).rename('NDMI_max').clip(StudyArea);

var ndmiMin = s2Processed.select('NDMI').reduce(ee.Reducer.min()).rename('NDMI_min').clip(StudyArea);

// 4. FEATURE STACKING & SAMPLING

// Combine all layers into one "Master Image" for classification
var composite = median.addBands([
  ndmiStd,
  slope,
  ndviMax,
  ndviMin,
  ndviAmp,
  ndmiMax,
  ndmiMin
]);

// Define the bands we want the model to learn from
var predictionBands = [
  'B2','B3','B4','B8','B11','B12',
  'NDVI','NDMI','EVI','WETNESS', // Spectral Indices
  'slope_norm', // Topographic
  'NDMI_std', // Temporal
  'NDVI_max',
  'NDVI_min',
  'NDVI_amp',
  'NDMI_max',
  'NDMI_min'
];

print("Features selected:", predictionBands);

// Sample pixels for training
var training = composite.select(predictionBands).sample({
  region: StudyArea,
  scale: 10,
  numPixels: 5000,
  seed: 42,
  geometries: false
}).filter(ee.Filter.notNull(predictionBands)); 

print("Training sample size:", training.size());

// 5. CLUSTERING (UNSUPERVISED)

// Train K-Means
var numClasses = 10
var clusterer = ee.Clusterer.wekaKMeans(numClasses).train(training);


/*
// X-Means will attempt to find the best k between min and max
var clusterer = ee.Clusterer.wekaXMeans({
  minClusters: 4, 
  maxClusters: 10,  // Don't go too high or you'll get noise
  seed: 42,
  useKD: true // Faster processing
}).train(training);
*/

// Apply to the image
var clustered = composite.select(predictionBands).cluster(clusterer);

print("Clustering complete");

// 6. VISUALIZATION

Map.centerObject(StudyArea, 11);

// Visualizing the Raw Data (False Color for Peatlands)
Map.addLayer(median, {
  bands: ['B11', 'B8', 'B4'], 
  min: 0, max: 0.3
}, 'False Color (Vegetation)');

// Visualizing the "Wetness" Index
Map.addLayer(median.select('WETNESS'), {
  min: -0.1, max: 0.1, palette: ['brown', 'white', 'blue']
}, 'Tasseled Cap Wetness');

// Visualizing the Clusters
Map.addLayer(clustered.randomVisualizer(), {}, 'K-Means Clusters');

// 7. POST-PROCESSING (REMOVE SALT & PEPPER EFFECT)

// Define a kernel for smoothing. 
// 'radius' is in pixels. 1 or 2 is sufficient for Sentinel-2 (10m).
// A radius of 1 = 3x3 window (approx 0.09 hectares)
// A radius of 2 = 5x5 window (approx 0.25 hectares)
var kernel = ee.Kernel.square({radius: 1});

// Apply a Mode filter (Majority Vote)
// This replaces isolated pixels with the dominant surrounding class.
var smoothed = clustered.focal_mode({
  kernel: kernel,
  iterations: 1 // Run once. You can increase this for more aggressive smoothing.
});

// Visualization: Compare Raw vs. Smoothed
Map.addLayer(clustered.randomVisualizer(), {}, 'Raw Clusters (Noisy)');
Map.addLayer(smoothed.randomVisualizer(), {}, 'Smoothed Clusters (Clean)');

