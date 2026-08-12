## Troubleshooting Trend Data

If you notice that some technologies have empty "30-Day Adoption Trend" charts or uncalculated trend scores, this is typically due to the data maturity requirements of the daily pipeline:

1. **Minimum Snapshots for Rendering:** The UI trend chart requires at least **2 days of snapshot data** to render. If a technology was only recently discovered by the crawler, it may not have enough history yet.
2. **Trend Eligibility:** To ensure trend scores are statistically meaningful and not overly noisy, the trend computation algorithm requires at least **4 days of data** (today's snapshot + 3 days of prior history). Technologies with fewer than 4 recorded snapshots will not have a computed trend score.
3. **Data Maturity:** Because the system relies on a rolling crawl, new technologies or those with sparse activity may take several days to accumulate the history needed to populate these fields. If you have recently initialized your database, allow the daily pipeline to run for at least one week to ensure most tracked technologies have satisfied these thresholds.

For further inspection of your data state, you can check snapshot counts directly using the included scripts:
```bash
# Check how many snapshots a specific tech has
npx tsx scripts/check_trending.ts
```
