export { Header } from "./Header";
export { AppLauncher } from "./AppLauncher";
export { UserMenu } from "./UserMenu";
export type { ProfileLink } from "./usermenu-logic";
export { SubNav, isActiveTab, startsNewGroup } from "./SubNav";
export type { SubNavTab } from "./SubNav";
export { Breadcrumb } from "./Breadcrumb";
export { segmentKind, isCurrentPage } from "./breadcrumb-logic";
export type { BreadcrumbItem, SegmentKind } from "./breadcrumb-logic";
export { APPS, visibleApps } from "./apps";
export type { AppEntry, ShellUser } from "./apps";
export { SearchBar } from "./SearchBar";
export { visibleResults, groupByApp } from "./searchbar-logic";
export type { SearchResult, SearchResultApp } from "./searchbar-logic";
export { ThemeToggle } from "./ThemeToggle";
export { THEME_INIT_SCRIPT, THEME_COOKIE, resolveTheme, applyTheme } from "./theme";
export type { Theme } from "./theme";
export { LAST_TAB_COOKIE, parseLastTabCookie, resolveLastTab, lastTabCookieString, rememberTab } from "./last-tab";
export { parseNotificationPayload, badgeText, loadEstateCounts, NOTIFY_TTL_MS } from "./notifications";
export type { AppNotifications } from "./notifications";
// ── 2027 app layer: the data parts ──────────────────────────────────────────
// Apps COMPOSE these; apps never restyle them. If one cannot do the job,
// extend it here rather than rebuilding it locally — that is how the estate
// ended up with 22 tables and 14 charts. See src/styles/ADHERENCE.md.
export { Panel, PanelGrid } from "./Panel";
export type { PanelProps } from "./Panel";
export { Status, Notice, Delta } from "./Status";
export type { StatusProps, NoticeProps, StatusTone } from "./Status";
export { Kpi, KpiRow } from "./Kpi";
export type { KpiProps, KpiState } from "./Kpi";
export { Ledger, LedgerBar, headerGroups } from "./Ledger";
export type { LedgerProps, LedgerColumn, LedgerRow, SortDirection } from "./Ledger";
export { Filters, Segmented } from "./Filters";
export type { FiltersProps, FilterDimension, SegmentedProps } from "./Filters";
export {
  ALL,
  FILTER_LABEL_WIDTH,
  FILTER_COLLAPSE_AFTER,
  filterSummary,
  hasActiveFilters,
  isAllSelected,
  nextSelection,
  shouldCollapse,
} from "./filters-logic";
export type { FilterOption, ActiveDimension } from "./filters-logic";
export { Chart, ChartTable } from "./Chart";
export type { ChartProps, ChartView } from "./Chart";
export { ChartPanel } from "./ChartPanel";
export type { ChartPanelProps } from "./ChartPanel";
export {
  CHART_SERIES_BUDGET,
  SERIES_GREY,
  seriesBudgetError,
  seriesColour,
  greySeriesCount,
  accentSeriesCount,
  yDomain,
  yTicks,
  yScale,
  xScale,
  band,
  niceCeiling,
} from "./chart-logic";
export type { Series, Point } from "./chart-logic";
export { Calendar } from "./Calendar";
export type { CalendarProps } from "./Calendar";
export {
  DAY_START_MIN,
  DAY_END_MIN,
  LANE_GUTTER,
  OWNER_COLLAPSE_AFTER,
  overlaps,
  clusterEvents,
  assignLanes,
  layoutEvents,
  laneGeometry,
  isOutOfHours,
  busiestDay,
  shouldCollapseOwners,
} from "./calendar-logic";
export type { CalendarEvent, LaneAssignment } from "./calendar-logic";
export { RecordCard, RecordGrid } from "./RecordCard";
export type { RecordCardProps } from "./RecordCard";
export {
  DEFAULT_K,
  SKIN_TARGET,
  SKIN_P99_MAX,
  SKIN_MAX,
  exposureFor,
  isSuspectK,
  gradeFilter,
  skinWithinCeilings,
} from "./portrait-grade";

export {
  DENSITY_COOKIE,
  DENSITY_INIT_SCRIPT,
  DENSITY_METRICS,
  applyDensity,
  densityCookieString,
  densityMetrics,
  resolveDensity,
} from "./density";
export type { Density } from "./density";
export {
  CHROME_INIT_SCRIPT,
  SCALE_COOKIE,
  SCALE_CHOICES,
  SCALE_STEPS,
  scaleForWidth,
  scaleValue,
  resolveScale,
  scaleCookieString,
  applyScale,
} from "./scale";
export type { Scale } from "./scale";

export { buildUrl } from "./url-state";
export { useUrlState } from "./useUrlState";
export type { UrlStateCodec, UrlState } from "./useUrlState";
