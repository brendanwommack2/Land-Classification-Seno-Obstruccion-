# Peatlands in Transition: Unsupervised Classification Framework

**Author:** Joel Brendan Wommack  
**Affiliation:** University of Michigan School for Environment and Sustainability (SEAS)  
**Partner Organization:** Fundación Planeta Agua  
**Region:** Seno Obstrucción, Southern Patagonia, Chile

## Project Overview

This repository contains the Google Earth Engine (GEE) framework used to generate baseline unsupervised land cover classifications for phase I of my **"Peatlands in Transition"** Master's Project.

The objective of this initial script is to identify and delineate broad **land cover zones** in the cloud-prone, data-scarce region of the Seno Obstruccion in Southern Patagonia. By leveraging multi-temporal Sentinel-2 imagery and topographic data, this model distinguishs land cover type in the region using unsupervised machine learning. The ultimate goal of this project is creating a model which can distingusih *Nothofagus* forests, Sphagnum peatlands, cushion bogs, and water bodies after ground truthing in further phases.

## Key Features

* **Phenological Filtering:** Utilizes a specific Austral Summer growing season (Oct 2023 – Feb 2024) to maximize vegetation spectral separability.
* **Advanced Feature Engineering:**
    * **Spectral Indices:** NDVI, NDMI, EVI.
    * **Tasseled Cap Wetness:** Specifically implemented to detect saturated peat soils.
    * **Temporal Statistics:** Standard deviation, Min/Max, and Amplitude of moisture/vegetation indices to capture seasonal dynamics.
* **Topographic Normalization:** Integrates SRTM DEM data with normalized slope to distinguish topogenic peat basins from forested slopes.
* **Post-Processing:** Applies morphological spatial filtering (Focal Mode) to reduce the "salt-and-pepper" effect common in pixel-based classification.

## Methodology

### 1. Data Pre-processing
* **Collection:** `COPERNICUS/S2_SR_HARMONIZED` (Sentinel-2 Surface Reflectance).
* **Masking:** Aggressive cloud and shadow masking using the Scene Classification Layer (SCL).
* **Compositing:** Median temporal composite to remove transient noise and atmospheric artifacts.

### 2. Feature Stack
The model is trained on a 17-band stack designed to capture structure, moisture, and topography:

| Category | Bands/Metrics | Purpose |
| :--- | :--- | :--- |
| **Spectral** | B2, B3, B4, B8, B11, B12 | Base reflectance |
| **Indices** | NDVI, EVI, NDMI, Wetness | Vegetation health & soil saturation |
| **Topography** | Slope (Normalized 0-1) | Distinguishing valley-bottom bogs |
| **Temporal** | NDMI_std, NDVI_amp | Separating permanent vs. seasonal features |

### 3. Clustering
* **Algorithm:** Weka K-Means (Unsupervised).
* **Classes:** 10 (tuned to capture subtle ecotonal gradients).
* **Sampling:** 5,000 pixels sampled from the `ProposedArea` ROI.

## Usage

### Prerequisites
To run this script, you must have a valid Google Earth Engine account.

1.  **Clone the Repository:**
    ```bash
    git clone [https://github.com/your-username/peatlands-transition.git](https://github.com/your-username/peatlands-transition.git)
    ```
2.  **Import to Earth Engine:**
    Copy the contents of `script.js` into the GEE Code Editor.
3.  **Define ROI:**
    You must define a geometry polygon named `ProposedArea` in the import section of the script covering the Seno Obstrucción region.

