# Peatlands in Transition: Land Cover Classification Framework

**Author:** Joel Brendan Wommack  
**Affiliation:** University of Michigan School for Environment and Sustainability (SEAS)  
**Partner Organization:** Fundación Planeta Agua  
**Region:** Seno Obstrucción, Southern Patagonia, Chile  

---

## Project Overview

This repository contains a set of **Google Earth Engine (GEE) classification workflows** developed for Phase I of the **“Peatlands in Transition”** Master’s Project.

The objective of this work is to establish **baseline land cover maps** for a remote, cloud-prone, and data-scarce region of Southern Patagonia, with particular emphasis on distinguishing **peatland systems** from surrounding forest, grassland, and barren landscapes.

The repository documents the methodological progression from exploratory **unsupervised pixel-based clustering**, through **object-based segmentation**, to a final **supervised Random Forest classification** informed by manually delineated training polygons. Later project phases will incorporate ground-truth data and ecological validation.

---

## Repository Structure

The project currently includes three primary classification workflows:

### 1. Pixel-Based Unsupervised Classification (K-Means)
- Multi-temporal Sentinel-2 median composite  
- Spectral, temporal, and topographic feature stack  
- Weka K-Means clustering  
- Spatial smoothing to reduce pixel noise  

### 2. Object-Based Unsupervised Classification (SNIC)
- Image segmentation using SNIC superpixels  
- Mean spectral and index features computed per object  
- K-Means clustering applied to landscape objects rather than pixels  
- Produces ecologically meaningful spatial units and reduces salt-and-pepper effects  

### 3. Supervised Classification (Random Forest)
- Training polygons representing known land cover types  
- Random Forest classifier with internal validation  
- Final smoothed land cover map suitable for analysis and export  

---

## Target Land Cover Classes

| Class ID | Land Cover Type |
|----------|----------------|
| 0 | Water |
| 1 | Wetland / Peatland |
| 2 | Forest |
| 3 | Grassland / Shrub |
| 4 | Barren / Exposed |

---

## Data Sources

- **Satellite Imagery:** Sentinel-2 Surface Reflectance  
  `COPERNICUS/S2_SR_HARMONIZED`
- **Topography:** SRTM DEM  
  `USGS/SRTMGL1_003`
- **Time Period:** Austral growing season (October 2023 – February 2024)

---

## Feature Engineering

All workflows are built on a consistent, ecologically informed feature stack.

### Spectral Bands
- B2 (Blue)  
- B3 (Green)  
- B4 (Red)  
- B8 (NIR)  
- B11 (SWIR1)  
- B12 (SWIR2)  

### Spectral Indices
- **NDVI** – Vegetation vigor  
- **NDMI** – Canopy and soil moisture  
- **EVI** – Vegetation structure and biomass  
- **Tasseled Cap Wetness** – Soil saturation and peatland detection  

### Temporal Metrics
- NDMI standard deviation  
- NDVI minimum / maximum / amplitude  
- NDMI minimum / maximum  

### Topographic Metrics
- Normalized slope (0–1) derived from SRTM DEM  

---

## Methodology Summary

### 1. Pre-Processing
- Cloud and shadow masking using Sentinel-2 Scene Classification Layer (SCL)  
- Median compositing to reduce atmospheric noise and transient artifacts  

### 2. Feature Stacking
- All spectral, index, temporal, and terrain layers combined into a single composite image  

### 3. Classification Approaches

#### Pixel-Based (Exploratory)
- Weka K-Means clustering  
- Useful for pattern discovery and feature testing  

#### Object-Based (SNIC)
- Superpixel segmentation at ~30–60 m scale  
- Mean features per object  
- Reduces noise and improves spatial coherence  

#### Supervised (Final Mapping)
- Random Forest classifier  
- 70/30 train–test split  
- Accuracy assessment using:
  - Confusion matrix  
  - Overall accuracy  
  - Kappa statistic  

---

## Usage

### Prerequisites
- Active Google Earth Engine account  

### Running the Scripts

1. Import scripts into the GEE Code Editor  
2. Define the study area as a geometry named `ProposedArea`  
3. Import training feature collections for supervised classification:
   - `features_water`
   - `features_wetland`
   - `features_forest`
   - `features_grasslandshrub`
   - `features_barren`
4. Run the desired workflow (unsupervised, object-based, or supervised)

---

## Outputs

- Pixel-based cluster maps  
- Object-based segmentation maps  
- Supervised land cover classification raster  
- Accuracy metrics (confusion matrix, overall accuracy, Kappa)  
- Export-ready GeoTIFF outputs for GIS analysis  

---

## Project Status

### Phase I – Complete
- Feature engineering finalized  
- Multiple classification paradigms tested  
- Baseline land cover map produced  

### Next Phases
- Field validation and ground truthing  
- Peatland sub-type differentiation  
- Temporal change detection  
- Hydrological and carbon-focused analyses  

---

## License

This project is developed for academic and conservation research purposes.  
Please cite appropriately if adapting or extending this framework.
