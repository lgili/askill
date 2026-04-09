# Curve Digitization Methodology

## What Is Curve Digitization?

Curve digitization is the process of extracting numerical (x, y) data from a graph image. The goal is to reconstruct the data series that was used to draw the curve, so it can be used in calculations, simulations, or regenerated as a clean plot.

Accuracy is limited by:
- Image resolution (usually 150–300 DPI in datasheets → ±1–3 pixels)
- Axis calibration quality (the accuracy with which the user identifies reference pixel positions)
- Curve anti-aliasing and image compression artifacts
- Overlapping curves or thin lines

Typical achievable accuracy: **±2–3% of full scale** for cleanly printed datasheet graphs at 150+ DPI.

## Coordinate System Conventions

A graph has two coordinate systems:
- **Pixel space:** (px, py) where (0,0) is top-left, px increases right, py increases downward.
- **Data space:** (dx, dy) where the origin depends on the graph, dy may increase upward (normal math convention) or downward.

The mapping between them is linear for linear axes and logarithmic for log axes.

### Linear Axis Mapping

Given two calibration points ((px1, dx1) and (px2, dx2)) on the x-axis:

```
dx = dx1 + (px - px1) * (dx2 - dx1) / (px2 - px1)
```

For y-axis (note: pixel y increases downward, data y typically increases upward):
```
dy = dy1 + (py - py1) * (dy2 - dy1) / (py2 - py1)
```
If data y increases upward, py2 < py1 for dy2 > dy1 → the result is a negative scale factor, which automatically handles the inversion.

### Log Axis Mapping

For a logarithmic axis:
```
log_dy = log10(dy1) + (px - px1) * (log10(dy2) - log10(dy1)) / (px2 - px1)
dy = 10 ** log_dy
```

## Axis Calibration Procedure

1. Open the graph image in any image viewer that shows pixel coordinates on hover.
2. Identify two well-separated, axis-aligned points whose data values are known from the axis tick marks.
3. For x: choose two tick marks at different x positions but the same y position (on the x axis).
4. For y: choose two tick marks at different y positions but the same x position (on the y axis).
5. Record: `(px1, dx1), (px2, dx2)` for x-axis and `(py1, dy1), (py2, dy2)` for y-axis.

**Guideline:** calibration points should be at least 50% of the axis length apart to minimize the effect of pixel-identification error. Using the two axis extremes is ideal.

## Curve Detection by Color

Most datasheet graphs have:
- White or light gray background
- Black or dark gray axis lines
- Colored curves (blue, red, green, orange) for families of curves

Strategy:
1. User specifies a target color as (R, G, B) — match the dominant curve color by eye.
2. With tolerance `T` (typically 30–50), classify each pixel as matching if:
   ```
   max(|pixel_R - target_R|, |pixel_G - target_G|, |pixel_B - target_B|) <= T
   ```
   (Chebyshev distance, faster than Euclidean, works well for color matching)
3. For each x-column, collect all matching pixel y-coordinates and take the median as the representative y.
4. Skip columns with no matching pixels or with too many (> 20% of column height) matching pixels (overmatching).

### Auto-Detection of Curve Color

When the user does not specify a color, scan the image for the most common non-background, non-axis color:
1. Exclude pixels near pure white (R,G,B > 230) and pure black (R,G,B < 30).
2. Bucket remaining pixel colors into 8×8×8 RGB bins.
3. The most populous bin is the dominant curve color.

This works well for single-curve graphs but may select the wrong curve for multi-curve graphs.

## Multi-Curve Graphs

For graphs with multiple curves (e.g., `I_D` vs `V_DS` at `V_GS = 1V, 2V, 3V, 4V`):
1. Run `digitize_curve.py` once per curve with different `--color` values.
2. Name output files with the curve label: `id_vds_vgs1v.csv`, `id_vds_vgs2v.csv`, etc.
3. If curves are not color-coded (all black), isolation is not possible automatically — manual point selection is needed.

## Handling Log-Scale Graphs

Common log-scale graphs in power electronics datasheets:
- `C_oss` vs Reverse Voltage (log-log)
- Switching energy vs `I_D`
- Thermal impedance vs pulse width
- Gain-bandwidth plot (semi-log: log frequency, linear gain)

For log axes in `digitize_curve.py`: pass `--x-log` or `--y-log` flags. The calibration input is the same (data values at pixel positions), but the interpolation uses log10 of the calibration values.

## Accuracy Estimation

For each digitized dataset, report:
- Calibration point separation (as % of image width/height) → larger is better
- Image resolution (DPI or pixel dimensions)
- Estimated full-scale error: `2 px / (calibration_point_separation_in_px)` × full_scale_range
- Whether axis scale is linear or logarithmic (log axes have non-uniform absolute error)

Example: 600px-wide image, calibration span 500px, full-scale 100A → pixel error ≈ 2px → accuracy ≈ 0.4% FS = 0.4A. At 150 DPI, resolution in image coordinates is adequate.

## Reference Tools

| Tool | Type | Use case |
|---|---|---|
| `digitize_curve.py` (this skill) | CLI script | Automated color-based digitization from calibrated axis |
| WebPlotDigitizer | Web GUI | Manual point selection, best for complex or low-contrast graphs |
| Engauge Digitizer | Desktop app | Advanced: background subtraction, spline fitting, auto-trace |
