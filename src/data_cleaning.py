"""Build a reproducible daily feature dataset for Snowbasin congestion modeling.

Pipeline summary:
1. Read yearly Trappers Loop hourly traffic files from ``data/raw/trappersLoopCounts``.
2. Normalize hourly counts into a single time-series table.
3. Aggregate to daily features aligned to the 7:00-9:00 AM congestion window.
4. Add federal holiday flags from ``data/raw/federalHolidayData``.
5. Write the analysis-ready dataset to ``data/processed``.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import argparse
import re

import pandas as pd


HOURLY_COLUMN_PATTERN = re.compile(r"H\d{4}")


@dataclass(frozen=True)
class Paths:
    """Filesystem locations used by the cleaning pipeline."""

    traffic_dir: Path = Path("data/raw/trappersLoopCounts")
    holiday_file: Path = Path("data/raw/federalHolidayData/us_federal_holidays_2015_2026.csv")
    output_file: Path = Path("data/processed/trappers_loop_daily_features.csv")


def _year_from_filename(path: Path) -> int | None:
    match = re.search(r"(20\d{2})", path.name)
    return int(match.group(1)) if match else None


def load_hourly_traffic(traffic_dir: Path) -> pd.DataFrame:
    """Load and normalize all yearly Trappers Loop files to one hourly table."""

    traffic_files = sorted(
        (
            file
            for file in traffic_dir.glob("Trappers_Loop_*.csv")
            if _year_from_filename(file) is not None
        ),
        key=lambda file: _year_from_filename(file) or 0,
    )
    if not traffic_files:
        raise FileNotFoundError(f"No yearly traffic CSV files were found in: {traffic_dir}")

    frames: list[pd.DataFrame] = []
    for file in traffic_files:
        frame = pd.read_csv(file)
        frame["source_file"] = file.name
        frames.append(frame)

    traffic = pd.concat(frames, ignore_index=True)
    hour_columns = [column for column in traffic.columns if HOURLY_COLUMN_PATTERN.fullmatch(column)]
    if not hour_columns:
        raise ValueError("No hourly columns (H0000..H2300) found in traffic files.")

    traffic_long = traffic.melt(
        id_vars=["DATE", "LANE", "source_file"],
        value_vars=hour_columns,
        var_name="hour_label",
        value_name="vehicle_count",
    )

    traffic_long["hour_of_day"] = traffic_long["hour_label"].str[1:3].astype(int)
    traffic_long["date_hour"] = pd.to_datetime(
        traffic_long["DATE"].astype(str) + " " + traffic_long["hour_label"].str[1:],
        format="%m/%d/%Y %H%M",
        errors="coerce",
    )
    traffic_long["vehicle_count"] = pd.to_numeric(traffic_long["vehicle_count"], errors="coerce")

    traffic_long = traffic_long.dropna(subset=["date_hour", "vehicle_count"])

    return traffic_long


def build_daily_traffic_features(traffic_hourly: pd.DataFrame) -> pd.DataFrame:
    """Aggregate hourly records into daily congestion-oriented features."""

    hourly_totals = (
        traffic_hourly.groupby("date_hour", as_index=False)["vehicle_count"].sum().rename(
            columns={"vehicle_count": "hourly_total_volume"}
        )
    )
    hourly_totals["date"] = hourly_totals["date_hour"].dt.normalize()

    daily_total = (
        hourly_totals.groupby("date", as_index=False)["hourly_total_volume"]
        .sum()
        .rename(columns={"hourly_total_volume": "daily_total_volume"})
    )

    morning_window = hourly_totals[hourly_totals["date_hour"].dt.hour.isin([7, 8])]
    morning_features = (
        morning_window.groupby("date", as_index=False)
        .agg(
            morning_peak_volume=("hourly_total_volume", "max"),
            morning_window_avg_volume=("hourly_total_volume", "mean"),
            morning_window_total_volume=("hourly_total_volume", "sum"),
        )
    )

    daily = daily_total.merge(morning_features, on="date", how="left")
    daily["day_of_week"] = daily["date"].dt.day_name()
    daily["is_weekend"] = daily["date"].dt.dayofweek >= 5
    return daily


def load_holidays(holiday_file: Path) -> pd.DataFrame:
    """Load observed U.S. federal holidays and keep one row per date."""

    holidays = pd.read_csv(holiday_file)
    holidays["date"] = pd.to_datetime(holidays["observed_date"], errors="coerce")

    cleaned = (
        holidays.dropna(subset=["date"])
        .sort_values(["date", "holiday_name"])
        .drop_duplicates(subset=["date"], keep="first")
        [["date", "holiday_name"]]
    )

    cleaned["is_federal_holiday"] = True
    return cleaned


def build_modeling_dataset(paths: Paths) -> pd.DataFrame:
    """Create the final analysis-ready dataset and write it to disk."""

    traffic_hourly = load_hourly_traffic(paths.traffic_dir)
    daily_traffic = build_daily_traffic_features(traffic_hourly)
    holidays = load_holidays(paths.holiday_file)

    dataset = daily_traffic.merge(holidays, on="date", how="left")
    dataset["is_federal_holiday"] = dataset["is_federal_holiday"].fillna(False)

    dataset = dataset.sort_values("date").reset_index(drop=True)
    paths.output_file.parent.mkdir(parents=True, exist_ok=True)
    dataset.to_csv(paths.output_file, index=False)

    return dataset


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a daily Snowbasin congestion feature dataset.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Paths.output_file,
        help="Path to the output CSV file (default: data/processed/trappers_loop_daily_features.csv).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    paths = Paths(output_file=args.output)
    dataset = build_modeling_dataset(paths)
    print(
        "Created modeling dataset "
        f"with {len(dataset):,} rows and {len(dataset.columns)} columns at {paths.output_file}."
    )


if __name__ == "__main__":
    main()
