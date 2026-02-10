<a name="readme-top"></a>

# The Snowbasin "Congestion Engine"

## The Wildcats

### 
- Dani Lopez (Data Analyst)
- Hazem Dawahi (Frontend and Backend integration)
- Roberto Camposeco (Data Engineer)
- Kevin Bell (Data Miner)

#### The Goal: Predict peak-hour traffic volume on Trappers Loop (SR-167) to optimize mountain resort staffing and parking operations 72 hours in advance.

https://dashboard-snowbasin-wildcats.vercel.app/

https://d34agsj343lfgw.cloudfront.net/

<!--

https://docs.google.com/spreadsheets/d/19SCDgp7Sh4boJbSSh4ONVqS9Zff8TVXjXxcgmYpLlhA/edit?gid=1263462889#gid=1263462889

https://drive.google.com/drive/folders/1ZYy-WkICLOp1482vwEbTc5UvLItbWs4y

https://udot.iteris-pems.com/#41.203198,-111.878929,12

https://prod-ut.ibi511.com/developers/doc

https://mesowest.utah.edu/cgi-bin/droman/variable_download_select.cgi

-->

<p align="right"><a href="#readme-top">back to top</a></p>

## Sprint 2 Data Pipeline Status

- ✅ Raw traffic files (2015-2024) are available under `data/raw/trappersLoopCounts/`.
- ✅ Federal holiday file is available under `data/raw/federalHolidayData/`.
- ✅ Reproducible cleaning script now lives in `src/data_cleaning.py`.

### Run the cleaning pipeline

```bash
python src/data_cleaning.py --output data/processed/trappers_loop_daily_features.csv
```

This script:
1. Reads all yearly Trappers Loop traffic CSV files.
2. Converts hourly traffic columns (`H0000`..`H2300`) into a normalized time series.
3. Builds daily features with a 7:00-9:00 AM focus window.
4. Adds a federal holiday flag from the holiday dataset.
