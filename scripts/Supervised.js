// NOTE: Need feature classes for the following:
// water
// peatland
// forest
// grassland and shrub
// bare


// 1. STUDY AREA

var StudyArea = ProposedArea;
Map.centerObject(StudyArea, 11);


// 2. LOAD SENTINEL-2 DATA (Growing Season)

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(StudyArea)
  .filterDate('2023-10-01', '2024-02-28')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));

print('Image count:', s2.size());


// 3. CLOUD MASK FUNCTION

function maskS2(image) {
  var scl = image.select('SCL');
  var mask = scl.neq(3)   // cloud shadow
    .and(scl.neq(8))      // medium cloud
    .and(scl.neq(9))      // high cloud
    .and(scl.neq(10))     // cirrus
    .and(scl.neq(11));    // snow
  
  return image.updateMask(mask);
}


// 4. ADD SPECTRAL INDICES

function addIndices(image) {
  
  var scaled = image.select(['B2','B3','B4','B8','B11','B12'])
                    .multiply(0.0001);

  var ndvi = scaled.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var ndmi = scaled.normalizedDifference(['B8', 'B11']).rename('NDMI');

  var evi = scaled.expression(
    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      'NIR': scaled.select('B8'),
      'RED': scaled.select('B4'),
      'BLUE': scaled.select('B2')
  }).rename('EVI');

  var wetness = scaled.expression(
    '(0.1509 * B2) + (0.1973 * B3) + (0.3279 * B4) + (0.3406 * B8) - (0.7112 * B11) - (0.4572 * B12)', {
      'B2': scaled.select('B2'),
      'B3': scaled.select('B3'),
      'B4': scaled.select('B4'),
      'B8': scaled.select('B8'),
      'B11': scaled.select('B11'),
      'B12': scaled.select('B12')
  }).rename('WETNESS');

  return scaled.addBands([ndvi, ndmi, evi, wetness]);
}


// 5. PROCESS COLLECTION

var s2Processed = s2
  .map(maskS2)
  .map(addIndices);

var composite = s2Processed.median().clip(StudyArea);


// 6. TERRAIN (SLOPE)

var terrain = ee.Algorithms.Terrain(
  ee.Image('USGS/SRTMGL1_003')
);

var slope = terrain.select('slope')
  .divide(90)
  .rename('slope_norm')
  .clip(StudyArea);

composite = composite.addBands(slope);

// 7. DEFINE PREDICTION BANDS

var predictionBands = [
  'B2','B3','B4','B8','B11','B12',
  'NDVI','NDMI','EVI','WETNESS',
  'slope_norm'
];

print('Bands used:', predictionBands);

// 8. MERGE TRAINING FEATURES

var trainingPolygons = features_water
  .merge(features_wetland)
  .merge(features_forest)
  .merge(features_grasslandshrub)
  .merge(features_barren);

print('Training polygons:', trainingPolygons.size());

// 9. SAMPLE TRAINING PIXELS

var training = composite.select(predictionBands).sampleRegions({
  collection: trainingPolygons,
  properties: ['class'],
  scale: 10,
  tileScale: 4
});

print('Training samples:', training.size());

// 10. TRAIN / VALIDATION SPLIT

var withRandom = training.randomColumn('rand', 42);

var trainSet = withRandom.filter('rand < 0.7');
var testSet  = withRandom.filter('rand >= 0.7');

// 11. TRAIN RANDOM FOREST CLASSIFIER

var classifier = ee.Classifier.smileRandomForest({
  numberOfTrees: 300,
  minLeafPopulation: 2,
  bagFraction: 0.6,
  seed: 42
}).train({
  features: trainSet,
  classProperty: 'class',
  inputProperties: predictionBands
});


// 12. VALIDATION

var validated = testSet.classify(classifier);

var confusionMatrix = validated.errorMatrix('class', 'classification');

print('Confusion Matrix:', confusionMatrix);
print('Overall Accuracy:', confusionMatrix.accuracy());
print('Kappa:', confusionMatrix.kappa());


// 13. CLASSIFY FULL IMAGE

var classified = composite
  .select(predictionBands)
  .classify(classifier);


// 14. SMOOTH 

var kernel = ee.Kernel.square({radius: 2});

var smoothed = classified.focal_mode({
  kernel: kernel,
  iterations: 1
});


// 15. VISUALIZATION

var palette = [
  '#2166ac', // 0 Water
  '#67a9cf', // 1 Wetland
  '#1b7837', // 2 Forest
  '#a6d96a', // 3 Grass/Shrub
  '#fdae61'  // 4 Barren
];

Map.addLayer(composite, {
  bands: ['B11','B8','B4'],
  min: 0,
  max: 0.3
}, 'False Color');

Map.addLayer(smoothed, {
  min: 0,
  max: 4,
  palette: palette
}, 'Supervised Classification');
