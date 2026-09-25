export type AppEntry = {
  key: string;
  name: string;
  url: string;
  description: string;
  icon?: string;
};

export type ShellUser = {
  email: string;
  apps: string[];
  // Both optional: 13 of the 14 consuming apps pass only { email, apps } until
  // they bump past this version, and none of them may break. Absent name/image
  // falls back to the initials badge (see usermenu-logic.ts initialsFor).
  name?: string | null;
  image?: string | null;
};

// Canonical CGSI app catalog. `key` matches the grant keys the auth host embeds
// in the session token. Adding an app here (+ a grant-matrix row in the auth
// host) is the only change needed to surface a new app in every launcher.
// Department split in progress (dept-split spec 2026-06-10): People shipped;
// Finance/Marketing/Partnerships/AcademicOps land as their phases ship.
export const APPS: AppEntry[] = [
  // `home` leads: it is the staff landing app, and the only one every
  // authenticated staffer holds by role rather than by grant. Added 2026-09-24
  // when `home` joined the floor in the auth host (app-auth#2) — before that
  // it had no key in any catalog and was reachable only through hardcoded
  // header links in two apps, which is why those links exist.
  { key: "home", name: "Home", url: "https://home.cgspectrum.com", description: "Your workspace: classes, marking, attendance, notes" },
  { key: "leadership", name: "Leadership", url: "https://leadership.cgspectrum.com", description: "Conversion rally dashboard: lead→enrolment, CAC, referrals" },
  { key: "product", name: "Product", url: "https://catalog.cgspectrum.com", description: "Course catalogue, org & policy" },
  { key: "people", name: "People", url: "https://people.cgspectrum.com", description: "Org chart & mentor directory" },
  { key: "marketing", name: "Marketing", url: "https://marketing.cgspectrum.com", description: "Testimonials & brand" },
  { key: "sales", name: "Sales", url: "https://sales.cgspectrum.com", description: "Funnel & cohort operations" },
  { key: "scheduling", name: "Academic Ops", url: "https://academicops.cgspectrum.com", description: "Scheduling, accreditation & policy" },
  { key: "finance", name: "Finance", url: "https://finance.cgspectrum.com", description: "Cohort & financial dashboards" },
  { key: "partnerships", name: "Partnerships", url: "https://partnerships.cgspectrum.com", description: "Partner programs & industry" },
  { key: "cms", name: "Media", url: "https://cms.cgspectrum.com", description: "Media library (in development)" },
  { key: "audit", name: "Audits", url: "https://audit.cgspectrum.com", description: "Cypher audit remediation" },
  { key: "governance", name: "Governance", url: "https://governance.cgspectrum.com", description: "TEQSA self-assurance registers & compliance" },
  { key: "launchpad", name: "Launchpad", url: "https://launchpad.cgspectrum.com", description: "Launchpad subscription & mentor admin (read-only)" },
  { key: "admin", name: "Admin", url: "https://auth.cgspectrum.com/admin", description: "Manage app access" },
];

// Apps the user may open: those granted, plus the current app (you're in it).
// Order follows the canonical APPS order.
export function visibleApps(catalog: AppEntry[], userApps: string[], currentApp: string): AppEntry[] {
  const allowed = new Set(userApps);
  return catalog.filter((a) => allowed.has(a.key) || a.key === currentApp);
}

// The admin-page entry for admin-grant holders, else null. Drives the header's
// far-right Admin shortcut so admins reach the grants/roles page from any app.
export function adminEntryFor(userApps: string[]): AppEntry | null {
  if (!userApps.includes("admin")) return null;
  return APPS.find((a) => a.key === "admin") ?? null;
}
