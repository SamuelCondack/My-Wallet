import PropTypes from "prop-types";
import styles from "./CategoryPieChart.module.scss";
import { formatCurrency } from "../../utils/finance";
import { useT } from "../../i18n/useT";

function polarToCartesian(cx, cy, radius, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function describeDonutSlice(cx, cy, outerR, innerR, startAngle, endAngle) {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.99) {
    // Full circle: two semicircle arcs
    const top = polarToCartesian(cx, cy, outerR, 0);
    const bottom = polarToCartesian(cx, cy, outerR, 180);
    const topInner = polarToCartesian(cx, cy, innerR, 0);
    const bottomInner = polarToCartesian(cx, cy, innerR, 180);
    return [
      `M ${top.x} ${top.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${bottom.x} ${bottom.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${top.x} ${top.y}`,
      `M ${topInner.x} ${topInner.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${bottomInner.x} ${bottomInner.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${topInner.x} ${topInner.y}`,
      "Z",
    ].join(" ");
  }

  const largeArc = sweep > 180 ? 1 : 0;
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

export default function CategoryPieChart({
  data,
  categoriesMap,
  onSliceClick,
}) {
  const t = useT();
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return <p className={styles.empty}>{t("chart.empty")}</p>;
  }

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 78;
  const innerR = 48;
  let rotation = 0;

  const slices = data.map((item) => {
    const sliceDeg = (item.value / total) * 360;
    const start = rotation;
    rotation += sliceDeg;
    const end = rotation;
    return {
      ...item,
      start,
      end,
      path: describeDonutSlice(cx, cy, outerR, innerR, start, end),
      color: categoriesMap[item.categoryId]?.color || "#B0B0B0",
    };
  });

  const clickable = typeof onSliceClick === "function";

  return (
    <div className={styles.wrapper}>
      <div className={styles.donutWrap}>
        <svg
          className={styles.donutSvg}
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label={t("chart.spendingByCategory")}
        >
          {slices.map((slice) => {
            const category = categoriesMap[slice.categoryId];
            const label = category?.name || t("common.other");
            return (
              <path
                key={slice.categoryId}
                d={slice.path}
                fill={slice.color}
                className={clickable ? styles.sliceClickable : undefined}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                aria-label={
                  clickable
                    ? t("chart.viewExpenses", {
                        label,
                        amount: formatCurrency(slice.value),
                      })
                    : undefined
                }
                onClick={
                  clickable
                    ? () => onSliceClick(slice.categoryId)
                    : undefined
                }
                onKeyDown={
                  clickable
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSliceClick(slice.categoryId);
                        }
                      }
                    : undefined
                }
              >
                <title>
                  {category?.icon} {label}: {formatCurrency(slice.value)}
                </title>
              </path>
            );
          })}
        </svg>
        <div className={styles.donutCenter} aria-hidden="true">
          <span className={styles.donutCenterLabel}>{t("common.total")}</span>
          <strong className={styles.donutCenterValue}>
            {formatCurrency(total)}
          </strong>
        </div>
      </div>

      <ul className={styles.legend}>
        {data.map((item) => {
          const category = categoriesMap[item.categoryId];
          const percent = ((item.value / total) * 100).toFixed(1);
          const label = `${category?.icon || ""} ${
            category?.name || t("common.other")
          }`.trim();

          const content = (
            <>
              <span
                className={styles.dot}
                style={{ backgroundColor: category?.color || "#B0B0B0" }}
              />
              <span className={styles.legendName}>{label}</span>
              <span className={styles.legendValue}>
                {formatCurrency(item.value)}
              </span>
              <span className={styles.legendPercent}>{percent}%</span>
            </>
          );

          return (
            <li key={item.categoryId}>
              {clickable ? (
                <button
                  type="button"
                  className={styles.legendBtn}
                  onClick={() => onSliceClick(item.categoryId)}
                >
                  {content}
                </button>
              ) : (
                <div className={styles.legendRow}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

CategoryPieChart.propTypes = {
  data: PropTypes.arrayOf(
    PropTypes.shape({
      categoryId: PropTypes.string,
      value: PropTypes.number,
    })
  ).isRequired,
  categoriesMap: PropTypes.object.isRequired,
  onSliceClick: PropTypes.func,
};
