const projectKey = document.body.dataset.projectKey;

const runtimeLine = document.getElementById("runtimeLine");
const errorLine = document.getElementById("errorLine");
const dataScopeNotice = document.getElementById("dataScopeNotice");

const daysSelect = document.getElementById("daysSelect");
const dateFieldSelect = document.getElementById("dateFieldSelect");

const kpiOpen = document.getElementById("kpiOpen");
const kpiClosed = document.getElementById("kpiClosed");
const kpiCloseRate = document.getElementById("kpiCloseRate");
const kpiAvgResolution = document.getElementById("kpiAvgResolution");
const kpiCreatedPeriod = document.getElementById("kpiCreatedPeriod");
const kpiUpdatedPeriod = document.getElementById("kpiUpdatedPeriod");
const kpiResolvedPeriod = document.getElementById("kpiResolvedPeriod");
const kpiOldestOpen = document.getElementById("kpiOldestOpen");
const kpiHighCriticalOpen = document.getElementById("kpiHighCriticalOpen");

const kpiCreatedPeriodLabel = document.getElementById("kpiCreatedPeriodLabel");
const kpiUpdatedPeriodLabel = document.getElementById("kpiUpdatedPeriodLabel");
const kpiResolvedPeriodLabel = document.getElementById("kpiResolvedPeriodLabel");

const statusMeta = document.getElementById("statusMeta");
const priorityMeta = document.getElementById("priorityMeta");
const timelineMeta = document.getElementById("timelineMeta");
const timelineTitle = document.getElementById("timelineTitle");

const oldestOpenBody = document.getElementById("oldestOpenBody");
const recentCreatedBody = document.getElementById("recentCreatedBody");
const recentResolvedBody = document.getElementById("recentResolvedBody");

const PERIOD_OPTIONS = [0, 7, 30, 90, 180, 365];

const STATUS_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#94a3b8",
];

const PRIORITY_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#3b82f6",
  "#22c55e",
  "#8b5cf6",
  "#94a3b8",
];

const JIRA_BASE_URL = "";

function fmtInt(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtPct(n) {
  if (n === null || n === undefined) return "—";
  return `${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function fmtHours1(n) {
  if (n === null || n === undefined) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function fmtDuration(n) {
  if (n === null || n === undefined) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";

  if (v >= 24) {
    return `${(v / 24).toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} d`;
  }

  return `${fmtHours1(v)} h`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clearError() {
  if (errorLine) {
    errorLine.textContent = "";
    errorLine.title = "";
  }
}

function showError(msg) {
  const text = String(msg instanceof Error ? msg.message : msg);

  if (errorLine) {
    errorLine.textContent = text;
    errorLine.title = text;
    return;
  }

  console.error(text);
}

function setRuntimeLine(text) {
  if (!runtimeLine) return;
  runtimeLine.textContent = text;
  runtimeLine.title = text;
}

async function fetchJson(url) {
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${url} -> ${res.status}: ${txt}`);
  }
  return res.json();
}

function getFilterState() {
  return {
    days: Number(daysSelect?.value || 30),
    dateField: String(dateFieldSelect?.value || "updated"),
  };
}

function normalizeText(value) {
  return String(value || "").trim();
}

function priorityTone(priority) {
  const p = normalizeText(priority).toLowerCase();

  if (["highest", "critical", "critique", "blocker"].includes(p)) return "critical";
  if (["high", "haute"].includes(p)) return "high";
  if (["medium", "moyenne"].includes(p)) return "medium";
  if (["low", "faible", "lowest"].includes(p)) return "low";
  return "neutral";
}

function statusTone(status) {
  const s = normalizeText(status).toLowerCase();

  if (["closed", "fermée", "fermee", "terminé(e)", "terminee", "done", "resolved"].includes(s)) {
    return "closed";
  }

  if (s.includes("analyse")) return "analysis";
  if (["open", "declared", "new", "to do"].includes(s)) return "open";
  if (["in progress", "ongoing", "rouvert", "reopened"].includes(s)) return "progress";

  return "neutral";
}

function ageTone(ageHours) {
  const hours = Number(ageHours || 0);

  if (hours >= 24 * 180) return "critical";
  if (hours >= 24 * 90) return "high";
  if (hours >= 24 * 30) return "medium";
  return "low";
}

function jiraIssueHref(key) {
  if (!JIRA_BASE_URL) return null;
  return `${JIRA_BASE_URL.replace(/\/$/, "")}/${encodeURIComponent(key)}`;
}

function renderIssueKey(key) {
  const safeKey = escapeHtml(key || "—");
  const href = jiraIssueHref(key);

  if (!href) {
    return `<span class="ticket-key">${safeKey}</span>`;
  }

  return `<a class="ticket-key ticket-key--link" href="${href}" target="_blank" rel="noopener noreferrer">${safeKey}</a>`;
}

function renderBadge(text, tone, extraClass = "") {
  const safeText = escapeHtml(text || "—");
  return `<span class="ui-badge ui-badge--${tone} ${extraClass}">${safeText}</span>`;
}

function renderPriorityBadge(priority) {
  return renderBadge(priority || "—", priorityTone(priority), "ui-badge--priority");
}

function renderStatusBadge(status) {
  return renderBadge(status || "—", statusTone(status), "ui-badge--status");
}

function renderAssignee(assignee) {
  const name = normalizeText(assignee) || "Unassigned";
  const tone = name.toLowerCase() === "unassigned" ? "neutral" : "person";

  return `
    <div class="assignee-cell" title="${escapeHtml(name)}">
      <span class="assignee-avatar assignee-avatar--${tone}">${escapeHtml(name.charAt(0).toUpperCase())}</span>
      <span class="assignee-name">${escapeHtml(name)}</span>
    </div>
  `;
}

function renderAge(ageHours) {
  const tone = ageTone(ageHours);
  return `<span class="age-chip age-chip--${tone}" title="${fmtDuration(ageHours)}">${fmtDuration(ageHours)}</span>`;
}

function renderEmptyRow(colspan, message) {
  return `<tr><td colspan="${colspan}" class="empty-state-cell">${escapeHtml(message)}</td></tr>`;
}

function renderLegend(containerId, items, colors) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const safeItems = Array.isArray(items) ? items : [];
  const total = safeItems.reduce((sum, item) => sum + Number(item?.count || 0), 0);

  container.innerHTML = "";

  if (!safeItems.length || total <= 0) {
    container.innerHTML = `<div class="muted">No data</div>`;
    return;
  }

  safeItems.forEach((item, index) => {
    const count = Number(item?.count || 0);
    const pct = total > 0 ? (count / total) * 100 : 0;

    const row = document.createElement("div");
    row.className = "chart-legend-item";
    row.innerHTML = `
      <div class="chart-legend-left">
        <span class="chart-legend-dot" style="background:${colors[index % colors.length]}"></span>
        <span class="chart-legend-label" title="${escapeHtml(item?.label)}">${escapeHtml(item?.label)}</span>
      </div>
      <div class="chart-legend-value">
        ${fmtInt(count)} • ${pct.toFixed(1)}%
      </div>
    `;
    container.appendChild(row);
  });
}

function renderDonutChart(id, items, colors, emptyText = "No data") {
  const host = document.getElementById(id);
  if (!host) return;

  const safeItems = Array.isArray(items) ? items : [];
  const total = safeItems.reduce((sum, item) => sum + Number(item?.count || 0), 0);

  if (!safeItems.length || total <= 0) {
    host.innerHTML = `<div class="chart-empty-state">${escapeHtml(emptyText)}</div>`;
    return;
  }

  const minPctForOwnSlice = 2.0;
  const mainItems = [];
  let otherCount = 0;

  for (const item of safeItems) {
    const count = Number(item?.count || 0);
    const pct = (count / total) * 100;

    if (pct < minPctForOwnSlice) {
      otherCount += count;
    } else {
      mainItems.push({
        label: item?.label,
        count,
      });
    }
  }

  if (otherCount > 0) {
    mainItems.push({
      label: "Other",
      count: otherCount,
    });
  }

  const finalTotal = mainItems.reduce((sum, item) => sum + item.count, 0);

  try {
    zingchart.exec(id, "destroy");
  } catch (_) {}

  host.innerHTML = "";

  zingchart.render({
    id,
    data: {
      type: "pie",
      backgroundColor: "transparent",
      plot: {
        slice: 62,
        size: "68%",
        borderColor: "#ffffff",
        borderWidth: 3,
        valueBox: {
          placement: "out",
          connected: true,
          connectorType: "straight",
          fontSize: 12,
          fontWeight: "bold",
          color: "#334155",
          offsetR: 6,
        },
        tooltip: {
          fontSize: 11,
          text: "%t: %v (%npv%)",
        },
      },
      plotarea: {
        margin: "30 30 30 30",
      },
      series: mainItems.map((item, index) => {
        const pct = (item.count / finalTotal) * 100;
        const color = colors[index % colors.length];

        return {
          values: [item.count],
          text: item.label,
          backgroundColor: color,
          lineColor: color,
          valueBox: {
            text: pct >= 3 ? `${item.label}\n${pct.toFixed(1)}%` : "",
          },
        };
      }),
    },
    height: "100%",
    width: "100%",
  });
}

function renderTimelineChart(points, dateField, days) {
  const safePoints = Array.isArray(points) ? points : [];
  const labels = safePoints.map((p) => String(p.period || "").slice(5));
  const sourceValues = safePoints.map((p) => Number(p.created || 0));
  const resolvedValues = safePoints.map((p) => Number(p.resolved || 0));

  try {
    zingchart.exec("timelineChart", "destroy");
  } catch (_) {}

  zingchart.render({
    id: "timelineChart",
    data: {
      type: "line",
      backgroundColor: "transparent",
      scaleX: {
        labels,
        item: { fontColor: "#667085", angle: -35 },
        maxItems: 12,
      },
      scaleY: {
        guide: { lineStyle: "solid" },
        item: { fontColor: "#667085" },
      },
      legend: {
        layout: "x2",
        backgroundColor: "transparent",
        borderWidth: 0,
      },
      plot: {
        marker: { visible: false },
        tooltip: {
          text: "%t • %kl: %v",
        },
      },
      series: [
        {
          text: dateField.charAt(0).toUpperCase() + dateField.slice(1),
          values: sourceValues,
          lineColor: "#3b82f6",
          backgroundColor: "#3b82f6",
        },
        {
          text: "Resolved",
          values: resolvedValues,
          lineColor: "#22c55e",
          backgroundColor: "#22c55e",
        },
      ],
    },
    height: "100%",
    width: "100%",
  });

  if (timelineTitle) {
    if (dateField === "resolved") {
      timelineTitle.textContent = "Resolved activity trend";
    } else {
      timelineTitle.textContent = `${dateField.charAt(0).toUpperCase() + dateField.slice(1)} vs resolved trend`;
    }
  }

  if (timelineMeta) {
    timelineMeta.textContent = Number(days) === 0 ? "All available data" : `Last ${days} days`;
  }
}

function renderBacklogChart(bucketsInput) {
  const host = document.getElementById("backlogChart");
  if (!host) return;

  const buckets = Array.isArray(bucketsInput) ? bucketsInput : [];

  if (!buckets.length) {
    host.innerHTML = `<div class="chart-empty-state">No backlog data</div>`;
    return;
  }

  try {
    zingchart.exec("backlogChart", "destroy");
  } catch (_) {}

  host.innerHTML = "";

  zingchart.render({
    id: "backlogChart",
    data: {
      type: "bar",
      backgroundColor: "transparent",
      scaleX: {
        labels: buckets.map((x) => x?.label || "—"),
        item: { fontColor: "#667085" },
      },
      scaleY: {
        guide: { lineStyle: "solid" },
        item: { fontColor: "#667085" },
      },
      plot: {
        borderRadius: 6,
        tooltip: {
          text: "%kt: %v open tickets",
        },
      },
      series: [
        {
          values: buckets.map((x) => Number(x?.count || 0)),
          backgroundColor: "#f59e0b",
          text: "Open tickets",
        },
      ],
    },
    height: "100%",
    width: "100%",
  });
}

function formatPeriodLabel(days) {
  return Number(days) === 0 ? "All time" : `Last ${days}d`;
}

function updatePeriodLabels(days) {
  if (Number(days) === 0) {
    if (kpiCreatedPeriodLabel) kpiCreatedPeriodLabel.textContent = "Created all time";
    if (kpiUpdatedPeriodLabel) kpiUpdatedPeriodLabel.textContent = "Updated all time";
    if (kpiResolvedPeriodLabel) kpiResolvedPeriodLabel.textContent = "Resolved all time";
    return;
  }

  if (kpiCreatedPeriodLabel) kpiCreatedPeriodLabel.textContent = `Created last ${days}d`;
  if (kpiUpdatedPeriodLabel) kpiUpdatedPeriodLabel.textContent = `Updated last ${days}d`;
  if (kpiResolvedPeriodLabel) kpiResolvedPeriodLabel.textContent = `Resolved last ${days}d`;
}

function syncPeriodOptions(summary) {
  if (!daysSelect) return;

  const allowed = Array.isArray(summary.allowed_periods) && summary.allowed_periods.length
    ? summary.allowed_periods.map((x) => Number(x)).filter((x) => Number.isFinite(x))
    : PERIOD_OPTIONS.slice();

  const normalizedAllowed = [...new Set(allowed)].sort((a, b) => a - b);
  const currentRequested = Number(daysSelect.value || 30);

  daysSelect.innerHTML = "";

  normalizedAllowed.forEach((days) => {
    const option = document.createElement("option");
    option.value = String(days);
    option.textContent = days === 0 ? "All time" : `${days} days`;

    if (days === 0 && currentRequested === 0) {
      option.selected = true;
    } else if (days !== 0 && currentRequested !== 0 && days === Number(summary.days)) {
      option.selected = true;
    }

    daysSelect.appendChild(option);
  });

  if (currentRequested === 0 && normalizedAllowed.includes(0)) {
    daysSelect.value = "0";
  } else if (normalizedAllowed.includes(Number(summary.days))) {
    daysSelect.value = String(summary.days);
  } else if (normalizedAllowed.length) {
    daysSelect.value = String(normalizedAllowed[normalizedAllowed.length - 1]);
  }
}

function renderCoverageNotice(summary) {
  if (!dataScopeNotice) return;

  const text = summary.coverage_notice || "";

  if (!text) {
    dataScopeNotice.hidden = true;
    dataScopeNotice.textContent = "";
    dataScopeNotice.title = "";
    return;
  }

  dataScopeNotice.hidden = false;
  dataScopeNotice.textContent = text;
  dataScopeNotice.title = text;
}

function renderSummary(summary) {
  syncPeriodOptions(summary);
  renderCoverageNotice(summary);

  if (kpiOpen) kpiOpen.textContent = fmtInt(summary.open_tickets);
  if (kpiClosed) kpiClosed.textContent = fmtInt(summary.closed_tickets);
  if (kpiCloseRate) kpiCloseRate.textContent = fmtPct(summary.close_rate_percent);
  if (kpiAvgResolution) kpiAvgResolution.textContent = fmtDuration(summary.avg_resolution_hours);
  if (kpiCreatedPeriod) kpiCreatedPeriod.textContent = fmtInt(summary.created_in_period);
  if (kpiUpdatedPeriod) kpiUpdatedPeriod.textContent = fmtInt(summary.updated_in_period);
  if (kpiResolvedPeriod) kpiResolvedPeriod.textContent = fmtInt(summary.resolved_in_period);
  if (kpiOldestOpen) kpiOldestOpen.textContent = fmtDuration(summary.oldest_open_hours);
  if (kpiHighCriticalOpen) kpiHighCriticalOpen.textContent = fmtInt(summary.high_critical_open);

  updatePeriodLabels(summary.days);

  if (statusMeta) {
    statusMeta.textContent = `${fmtInt(summary.status_breakdown?.length || 0)} status families`;
  }

  if (priorityMeta) {
    priorityMeta.textContent = `${fmtInt(summary.priority_breakdown?.length || 0)} priorities`;
  }

  renderDonutChart("statusChart", summary.status_breakdown || [], STATUS_COLORS);
  renderLegend("statusLegend", summary.status_breakdown || [], STATUS_COLORS);

  renderDonutChart("priorityChart", summary.priority_breakdown || [], PRIORITY_COLORS);
  renderLegend("priorityLegend", summary.priority_breakdown || [], PRIORITY_COLORS);

  setRuntimeLine(
    `Client ${summary.project_key} • Total tickets: ${fmtInt(summary.total_tickets)} • Open: ${fmtInt(summary.open_tickets)} • Closed: ${fmtInt(summary.closed_tickets)} • Logged time: ${fmtHours1(summary.total_time_spent_hours)} h • Filter: ${Number(daysSelect?.value) === 0 ? "all time" : `${summary.days}d`} / ${summary.date_field}`
  );
}

function buildAttentionRow(row) {
  const tr = document.createElement("tr");
  const rowTone = ageTone(row?.age_hours);
  tr.className = `table-row-tone-${rowTone}`;

  tr.innerHTML = `
    <td class="nowrap">${renderIssueKey(row?.key)}</td>
    <td>${renderStatusBadge(row?.status || "—")}</td>
    <td>${renderPriorityBadge(row?.priority || "—")}</td>
    <td>${renderAssignee(row?.assignee)}</td>
    <td class="right">${renderAge(row?.age_hours)}</td>
  `;
  return tr;
}

function buildStandardRow(row) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="nowrap">${renderIssueKey(row?.key)}</td>
    <td>${renderStatusBadge(row?.status || "—")}</td>
    <td>${renderPriorityBadge(row?.priority || "—")}</td>
    <td>${renderAssignee(row?.assignee)}</td>
  `;
  return tr;
}

function renderActivity(activity) {
  const oldest = Array.isArray(activity?.oldest_open_tickets) ? activity.oldest_open_tickets : [];
  const created = Array.isArray(activity?.recent_created) ? activity.recent_created : [];
  const resolved = Array.isArray(activity?.recent_resolved) ? activity.recent_resolved : [];

  if (oldestOpenBody) {
    oldestOpenBody.innerHTML = "";
    if (!oldest.length) {
      oldestOpenBody.innerHTML = renderEmptyRow(5, "No open tickets requiring attention");
    } else {
      for (const row of oldest) {
        oldestOpenBody.appendChild(buildAttentionRow(row));
      }
    }
  }

  if (recentCreatedBody) {
    recentCreatedBody.innerHTML = "";
    if (!created.length) {
      recentCreatedBody.innerHTML = renderEmptyRow(4, "No recent created tickets");
    } else {
      for (const row of created) {
        recentCreatedBody.appendChild(buildStandardRow(row));
      }
    }
  }

  if (recentResolvedBody) {
    recentResolvedBody.innerHTML = "";
    if (!resolved.length) {
      recentResolvedBody.innerHTML = renderEmptyRow(4, "No recent resolved tickets");
    } else {
      for (const row of resolved) {
        recentResolvedBody.appendChild(buildStandardRow(row));
      }
    }
  }
}

async function loadClientPage() {
  const { days, dateField } = getFilterState();

  try {
    clearError();

    const [summary, timeline, backlog, activity] = await Promise.all([
      fetchJson(
        `/stats/clients/summary/${encodeURIComponent(projectKey)}?days=${days}&date_field=${encodeURIComponent(dateField)}`
      ),
      fetchJson(
        `/stats/clients/timeline/${encodeURIComponent(projectKey)}?days=${days}&date_field=${encodeURIComponent(dateField)}`
      ),
      fetchJson(`/stats/clients/backlog/${encodeURIComponent(projectKey)}`),
      fetchJson(
        `/stats/clients/activity/${encodeURIComponent(projectKey)}?oldest_limit=10&recent_limit=10`
      ),
    ]);

    try {
      renderSummary(summary);
    } catch (e) {
      console.error("renderSummary failed", e, summary);
      showError(e);
    }

    try {
      renderTimelineChart(timeline?.points || [], timeline?.date_field || dateField, Number(daysSelect?.value || timeline?.days || days));
    } catch (e) {
      console.error("renderTimelineChart failed", e, timeline);
      showError(e);
    }

    try {
      renderBacklogChart(backlog?.buckets || []);
    } catch (e) {
      console.error("renderBacklogChart failed", e, backlog);
      showError(e);
    }

    try {
      renderActivity(activity || {});
    } catch (e) {
      console.error("renderActivity failed", e, activity);
      showError(e);
    }
  } catch (e) {
    console.error("loadClientPage failed", e);
    showError(e);
  }
}

if (daysSelect) {
  daysSelect.addEventListener("change", loadClientPage);
}

if (dateFieldSelect) {
  dateFieldSelect.addEventListener("change", loadClientPage);
}

window.addEventListener("resize", () => {
  try {
    zingchart.exec("timelineChart", "resize");
  } catch (_) {}

  try {
    zingchart.exec("statusChart", "resize");
  } catch (_) {}

  try {
    zingchart.exec("priorityChart", "resize");
  } catch (_) {}

  try {
    zingchart.exec("backlogChart", "resize");
  } catch (_) {}
});

loadClientPage();