// 1. SETUP & COLLECTION

var StudyArea = ProposedArea;

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(StudyArea)
  .filterDate('2023-10-01', '2024-02-28')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30));

print('Image count:', s2.size());

// 2. FUNCTIONS: MASKING & INDICES

function maskS2(image) {
  var scl = image.select('SCL');
  var mask = scl.neq(3)
    .and(scl.neq(8))
    .and(scl.neq(9))
    .and(scl.neq(10))
    .and(scl.neq(11));
  return image.updateMask(mask);
}

function addIndices(image) {
  var scaled = image.select(['B2','B3','B4','B8','B11','B12'])
    .multiply(0.0001);

  var ndvi = scaled.normalizedDifference(['B8','B4']).rename('NDVI');
  var ndmi = scaled.normalizedDifference(['B8','B11']).rename('NDMI');

  var evi = scaled.expression(
    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      NIR: scaled.select('B8'),
      RED: scaled.select('B4'),
      BLUE: scaled.select('B2')
    }).rename('EVI');

  var wetness = scaled.expression(
    '(0.1509*B2)+(0.1973*B3)+(0.3279*B4)+(0.3406*B8)-(0.7112*B11)-(0.4572*B12)', {
      B2: scaled.select('B2'),
      B3: scaled.select('B3'),
      B4: scaled.select('B4'),
      B8: scaled.select('B8'),
      B11: scaled.select('B11'),
      B12: scaled.select('B12')
    }).rename('WETNESS');

  return scaled.addBands([ndvi, ndmi, evi, wetness]);
}

// 3. PROCESSING

var s2Processed = s2.map(maskS2).map(addIndices);

var median = s2Processed.median().clip(StudyArea);

var ndmiStd = s2Processed.select('NDMI')
  .reduce(ee.Reducer.stdDev())
  .rename('NDMI_std')
  .clip(StudyArea);

var terrain = ee.Algorithms.Terrain(ee.Image('USGS/SRTMGL1_003'));
var slope = terrain.select('slope')
  .divide(90)
  .rename('slope_norm')
  .clip(StudyArea);

var ndviMax = s2Processed.select('NDVI').reduce(ee.Reducer.max()).rename('NDVI_max');
var ndviMin = s2Processed.select('NDVI').reduce(ee.Reducer.min()).rename('NDVI_min');
var ndviAmp = ndviMax.subtract(ndviMin).rename('NDVI_amp');

var ndmiMax = s2Processed.select('NDMI').reduce(ee.Reducer.max()).rename('NDMI_max');
var ndmiMin = s2Processed.select('NDMI').reduce(ee.Reducer.min()).rename('NDMI_min');

// 4. FEATURE STACK

var composite = median.addBands([
  ndmiStd,
  slope,
  ndviMax,
  ndviMin,
  ndviAmp,
  ndmiMax,
  ndmiMin
]);

var predictionBands = [
  'B2','B3','B4','B8','B11','B12',
  'NDVI','NDMI','EVI','WETNESS',
  'slope_norm','NDMI_std',
  'NDVI_max','NDVI_min','NDVI_amp',
  'NDMI_max','NDMI_min'
];

var snicBands = [
  'B4','B8','B11',
  'NDVI','NDMI', 'EVI', 'WETNESS',
  'NDMI_std',
  'slope_norm'
];


// 5. SNIC SEGMENTATION (OBJECTS)

// ---- DOWNSCALE COMPOSITE FOR SNIC ----
var compositeSNIC = composite
  .resample('bilinear')
  .reproject({
    crs: composite.projection(),
    scale: 60   // ← THIS IS KEY
  });

// Seed grid ~40m
var seeds = ee.Algorithms.Image.Segmentation.seedGrid(40);

var snic = ee.Algorithms.Image.Segmentation.SNIC({
  image: composite.select(snicBands),
  size: 30,
  compactness: 0.5,
  connectivity: 8,
  neighborhoodSize: 128,
  seeds: seeds
});

// Mean features per object
var objectFeatures = snic.select(
  snicBands.map(function(b){ return b + '_mean'; })
);

// 6. TRAIN OBJECT-BASED K-MEANS

var training = objectFeatures.sample({
  region: StudyArea,
  scale: 40,
  numPixels: 5000,
  seed: 42,
  geometries: false
});

var numClasses = 4;

var clusterer = ee.Clusterer.wekaKMeans(numClasses)
  .train(training);

// Apply clustering to objects
var clustered = objectFeatures.cluster(clusterer);

// 7. VISUALIZATION

Map.centerObject(StudyArea, 11);

Map.addLayer(median, {
  bands: ['B11','B8','B4'],
  min: 0, max: 0.3
}, 'False Color');

Map.addLayer(clustered.randomVisualizer(), {}, 'SNIC Object Clusters');
