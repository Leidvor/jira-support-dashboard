const ASSIGNEE_TOP_N = null;

const syncBtn = document.getElementById("syncBtn");
const syncDot = document.getElementById("syncDot");
const syncText = document.getElementById("syncText");
const syncMeta = document.getElementById("syncMeta");
const lastRefresh = document.getElementById("lastRefresh");
const errorLine = document.getElementById("errorLine");
const toggleClosed = document.getElementById("toggleClosed");

const runtimeLine = document.getElementById("runtimeLine");
const syncLine = document.getElementById("syncLine");

const kpiTotal = document.getElementById("kpiTotal");
const kpiOpen = document.getElementById("kpiOpen");
const kpiClosed = document.getElementById("kpiClosed");
const kpiOldestCreated = document.getElementById("kpiOldestCreated");
const kpiOldestCreatedHint = document.getElementById("kpiOldestCreatedHint");
const kpiOldestUpdated = document.getElementById("kpiOldestUpdated");
const kpiOldestUpdatedHint = document.getElementById("kpiOldestUpdatedHint");

const assigneeBody = document.getElementById("assigneeBody");
const oldestBody = document.getElementById("oldestBody");
const assigneeMeta = document.getElementById("assigneeMeta");
const timeByProjectBody = document.getElementById("timeByProjectBody");
const timeByProjectMeta = document.getElementById("timeByProjectMeta");
const timeByProjectWrap = document.getElementById("timeByProjectWrap");

const statusFamilyMeta = document.getElementById("statusFamilyMeta");
const statusFamilyChart = document.getElementById("statusFamilyChart");

function fmtInt(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
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

function fmtHours0(h) {
  if (h === null || h === undefined) return "—";
  const v = Number(h);
  if (!Number.isFinite(v)) return "—";
  return fmtInt(v);
}

function fmtDateTime(value) {
  if (!value) return "Never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function setSyncPill(state, label, meta) {
  syncDot.classList.remove("good", "bad", "warn");
  syncDot.classList.add(state);
  syncText.textContent = label;
  syncMeta.textContent = meta || "—";
}

function clearError() {
  errorLine.textContent = "";
}

function showError(msg) {
  errorLine.textContent = msg;
}

async function fetchJson(url) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${url} -> ${res.status}: ${txt}`);
  }
  return res.json();
}

async function fetchSyncStatus() {
  const data = await fetchJson("/sync/status");
  const running = !!data.is_running;

  if (running) {
    syncBtn.disabled = true;
    syncBtn.textContent = "Sync running…";
    setSyncPill("warn", "Sync: running", "—");
    return data;
  }

  syncBtn.disabled = false;
  syncBtn.textContent = "Sync Jira";

  if (data.success === true) {
    const meta = `${fmtInt(data.upserted)} upsert • ${fmtInt(data.duration_ms)} ms`;
    setSyncPill("good", "Sync: success", meta);
  } else if (data.success === false) {
    const meta = `${fmtInt(data.duration_ms)} ms`;
    setSyncPill("bad", "Sync: failed", meta);
  } else {
    setSyncPill("warn", "Sync: unknown", "—");
  }

  return data;
}

async function triggerSync() {
  const res = await fetch("/sync", { method: "POST" });
  if (res.status === 409) {
    const err = await res.json();
    alert(err.detail || "A sync is already running.");
    return;
  }
  if (!res.ok) {
    const txt = await res.text();
    alert("Sync error: " + txt);
    return;
  }
}

function ageSeverityClass(ageHours) {
  const h = Number(ageHours);
  if (!Number.isFinite(h)) return "age-normal";
  if (h < 48) return "age-normal";
  if (h < 168) return "age-warn";
  if (h < 720) return "age-warn-strong";
  return "age-bad";
}

function ageRowClass(ageHours) {
  const h = Number(ageHours);
  if (!Number.isFinite(h)) return "";
  if (h < 48) return "";
  if (h < 168) return "row-warn";
  if (h < 720) return "row-warn-strong";
  return "row-bad";
}

function applyAgeClass(el, ageHours) {
  el.classList.remove("age-normal", "age-warn", "age-warn-strong", "age-bad");
  el.classList.add(ageSeverityClass(ageHours));
}

function setKpiOldest(elValue, elHint, obj) {
  if (!obj || !obj.key) {
    elValue.textContent = "—";
    elHint.textContent = "—";
    applyAgeClass(elValue, null);
    return;
  }
  elValue.textContent = fmtHours0(obj.age_hours);
  elHint.textContent = `${obj.key} • ${fmtHours0(obj.age_hours)}h`;
  applyAgeClass(elValue, obj.age_hours);
}

function effortRowClass(totalHours) {
  const h = Number(totalHours);
  if (!Number.isFinite(h)) return "";
  if (h > 300) return "effort-strong";
  if (h > 100) return "effort-mild";
  return "";
}

function effortTextClass(totalHours) {
  const h = Number(totalHours);
  if (!Number.isFinite(h)) return "";
  if (h > 300) return "effort-strong-text";
  if (h > 100) return "effort-mild-text";
  return "";
}

function isUnassigned(label) {
  if (!label) return true;
  const s = String(label).trim().toLowerCase();
  return s === "unassigned";
}

function makeUnassignedBadge() {
  const span = document.createElement("span");
  span.className = "badge badge-unassigned";
  const dot = document.createElement("span");
  dot.className = "badge-dot";
  const txt = document.createElement("span");
  txt.textContent = "Unassigned";
  span.appendChild(dot);
  span.appendChild(txt);
  return span;
}

function updateScrollableCue(el) {
  if (!el) return;
  const hasOverflow = el.scrollHeight > el.clientHeight + 2;
  el.classList.toggle("has-overflow", hasOverflow);
}

async function loadRuntimeInfo(syncStatus = null) {
  try {
    const config = await fetchJson("/config");
    const sync = syncStatus || (await fetchJson("/sync/status"));

    const jql = config.jira_jql || "N/A";
    const sqlitePath = config.sqlite_path || "N/A";
    const pageSize = config.jira_page_size ?? "N/A";

    runtimeLine.textContent = `JQL: ${jql}`;
    runtimeLine.title = `JQL: ${jql}`;

    const lastRunAt = fmtDateTime(sync.last_run_at);
    const success =
      sync.success === true
        ? "success"
        : sync.success === false
          ? "failed"
          : "unknown";
    const upserted = fmtInt(sync.upserted);
    const durationMs = fmtInt(sync.duration_ms);

    syncLine.textContent = `Last sync: ${lastRunAt} • Status: ${success} • Upserted: ${upserted} • Duration: ${durationMs} ms • SQLite: ${sqlitePath} • Page size: ${pageSize}`;
    syncLine.title = `Last sync: ${lastRunAt}\nStatus: ${success}\nUpserted: ${upserted}\nDuration: ${durationMs} ms\nSQLite: ${sqlitePath}\nPage size: ${pageSize}`;
  } catch (e) {
    runtimeLine.textContent = "Runtime info unavailable";
    syncLine.textContent = "Sync info unavailable";
  }
}

function getStatusFamilyColor(label, index) {
  if (label === "Open") return "#6ea8ff";
  if (label === "Analyse Client") return "#ffb020";
  if (label === "Analyse Luxtrust") return "#b197fc";
  if (label === "Closed") return "#3ad07a";
  const palette = [
    "#94a3b8",
    "#f87171",
    "#34d399",
    "#fbbf24",
    "#38bdf8",
    "#fb7185",
    "#c084fc",
    "#4ade80",
    "#f472b6",
    "#a3e635",
  ];
  return palette[index % palette.length];
}

let statusChartRendered = false;

function renderStatusFamilyChart(data) {
  let families = Array.isArray(data?.families) ? data.families : [];

  if (!toggleClosed.checked) {
    families = families.filter((f) => f.label !== "Closed");
  }

  const total = families.reduce((sum, f) => sum + Number(f.count || 0), 0);

  statusFamilyMeta.textContent = `${fmtInt(total)} tickets • ${fmtInt(families.length)} groups`;

  if (!families.length || total <= 0) {
    if (statusChartRendered) {
      try {
        zingchart.exec("statusFamilyChart", "destroy");
      } catch (e) {}
      statusChartRendered = false;
    }

    statusFamilyChart.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:220px;color:#9ca3af;">
        No data
      </div>
    `;
    return;
  }

  const series = families.map((item, index) => {
    const count = Number(item.count || 0);
    const pct = total > 0 ? (count / total) * 100 : 0;
    const color = getStatusFamilyColor(item.label, index);

    return {
      values: [count],
      text: item.label,
      backgroundColor: color,
      lineColor: color,
      valueBox: {
        text: `${item.label}\n${pct.toFixed(1)}%`,
        placement: "out",
        color: color,
        fontSize: 12,
        fontWeight: "bold",
        offsetR: 8,
      },
      tooltip: {
        text: `${item.label}: ${fmtInt(count)} tickets (${pct.toFixed(1)}%)`,
        backgroundColor: "#111827",
        borderColor: "#273244",
        borderWidth: 1,
        color: "#e5e7eb",
      },
    };
  });

  const chartConfig = {
    type: "pie",
    backgroundColor: "transparent",
    plot: {
      borderColor: "#2a303b",
      borderWidth: 3,
      slice: 64,
      size: "70%",
      valueBox: {
        placement: "out",
        connected: true,
        connectorType: "straight",
        fontFamily: "Arial",
        fontSize: 12,
        fontWeight: "bold",
        color: "#e5e7eb",
      },
      tooltip: {
        fontSize: 11,
        fontFamily: "Arial",
        borderRadius: 8,
      },
      animation: statusChartRendered
        ? {
            effect: 0,
            speed: 0,
          }
        : {
            effect: 2,
            method: 5,
            speed: 900,
            sequence: 1,
            delay: 500,
          },
    },
    plotarea: {
      margin: "4 10 4 10",
    },
    series,
  };

  if (!statusChartRendered) {
    statusFamilyChart.innerHTML = "";

    zingchart.render({
      id: "statusFamilyChart",
      data: chartConfig,
      height: "100%",
      width: "100%",
    });

    statusChartRendered = true;
  } else {
    zingchart.exec("statusFamilyChart", "setdata", {
      data: chartConfig,
    });
  }
}

async function refreshDashboard() {
  try {
    clearError();

    const [
      overview,
      byAssignee,
      oldestCreated,
      timeByProject,
      statusFamilyDistribution,
      syncStatus,
    ] = await Promise.all([
      fetchJson("/stats/overview"),
      fetchJson("/stats/by_assignee?only_open=true"),
      fetchJson("/stats/top_oldest_open?limit=200&sort=created"),
      fetchJson("/stats/time_by_project"),
      fetchJson("/stats/status_family_distribution"),
      fetchSyncStatus(),
    ]);

    kpiTotal.textContent = fmtInt(overview.total_tickets);
    kpiOpen.textContent = fmtInt(overview.open_tickets);
    kpiClosed.textContent = fmtInt(overview.closed_tickets);

    setKpiOldest(
      kpiOldestCreated,
      kpiOldestCreatedHint,
      overview.oldest_open_ticket,
    );
    setKpiOldest(
      kpiOldestUpdated,
      kpiOldestUpdatedHint,
      overview.oldest_open_ticket_by_updated,
    );

    assigneeBody.innerHTML = "";
    const assignees = Array.isArray(byAssignee) ? byAssignee.slice() : [];
    assignees.sort(
      (a, b) => Number(b.open_count || 0) - Number(a.open_count || 0),
    );

    const topAssignees = ASSIGNEE_TOP_N
      ? assignees.slice(0, ASSIGNEE_TOP_N)
      : assignees;
    assigneeMeta.textContent = `${topAssignees.length} assignees • Sorted by open`;

    if (!topAssignees.length) {
      assigneeBody.innerHTML = `<tr><td colspan="4" class="muted">No data</td></tr>`;
    } else {
      for (const row of topAssignees) {
        const tr = document.createElement("tr");

        const tdA = document.createElement("td");
        tdA.className = "truncate";
        if (isUnassigned(row.assignee)) {
          tdA.appendChild(makeUnassignedBadge());
        } else {
          tdA.title = row.assignee || "";
          tdA.textContent = row.assignee || "—";
        }

        const tdC = document.createElement("td");
        tdC.className = "right mono";
        tdC.textContent = fmtInt(row.open_count);

        const tdOC = document.createElement("td");
        tdOC.className = "right mono";
        tdOC.textContent = fmtHours0(row.oldest_open_created_hours);

        const tdOU = document.createElement("td");
        tdOU.className = "right mono";
        tdOU.textContent = fmtHours0(row.oldest_open_updated_hours);

        tr.appendChild(tdA);
        tr.appendChild(tdC);
        tr.appendChild(tdOC);
        tr.appendChild(tdOU);

        assigneeBody.appendChild(tr);
      }
    }

    oldestBody.innerHTML = "";
    const oldestList = Array.isArray(oldestCreated) ? oldestCreated : [];
    if (!oldestList.length) {
      oldestBody.innerHTML = `<tr><td colspan="5" class="muted">No open tickets</td></tr>`;
    } else {
      for (const row of oldestList) {
        const tr = document.createElement("tr");
        tr.className = ageRowClass(row.age_hours);

        const tdKey = document.createElement("td");
        tdKey.className = "mono nowrap";
        tdKey.textContent = row.key || "—";

        const tdStatus = document.createElement("td");
        tdStatus.className = "truncate";
        tdStatus.title = row.status || "";
        tdStatus.textContent = row.status || "—";

        const tdPrio = document.createElement("td");
        tdPrio.className = "nowrap";
        tdPrio.textContent = row.priority || "—";

        const tdAss = document.createElement("td");
        tdAss.className = "truncate";
        if (isUnassigned(row.assignee)) {
          tdAss.appendChild(makeUnassignedBadge());
        } else {
          tdAss.title = row.assignee || "";
          tdAss.textContent = row.assignee || "—";
        }

        const tdAge = document.createElement("td");
        tdAge.className = "right mono";
        tdAge.textContent = fmtHours0(row.age_hours);
        applyAgeClass(tdAge, row.age_hours);

        tr.appendChild(tdKey);
        tr.appendChild(tdStatus);
        tr.appendChild(tdPrio);
        tr.appendChild(tdAss);
        tr.appendChild(tdAge);

        oldestBody.appendChild(tr);
      }
    }

    timeByProjectBody.innerHTML = "";
    const projects = Array.isArray(timeByProject) ? timeByProject.slice() : [];
    projects.sort(
      (a, b) =>
        Number(b.time_spent_hours || 0) - Number(a.time_spent_hours || 0),
    );

    timeByProjectMeta.textContent = `${projects.length} projects • Sorted by hours`;

    if (!projects.length) {
      timeByProjectBody.innerHTML = `<tr><td colspan="6" class="muted">No data</td></tr>`;
    } else {
      for (const row of projects) {
        const totalHours = Number(row.time_spent_hours || 0);
        const totalIssues = Number(row.total_issues || 0);
        const avg = totalIssues > 0 ? totalHours / totalIssues : 0;

        const tr = document.createElement("tr");
        tr.className = effortRowClass(totalHours);

        const tdProj = document.createElement("td");
        tdProj.className = "mono nowrap";
        tdProj.textContent = row.project_key || "UNKNOWN";

        const tdOpen = document.createElement("td");
        tdOpen.className = "right mono";
        tdOpen.textContent = fmtInt(row.open_issues);

        const tdClosed = document.createElement("td");
        tdClosed.className = "right mono";
        tdClosed.textContent = fmtInt(row.closed_issues);

        const tdHours = document.createElement("td");
        tdHours.className = "right mono";
        tdHours.textContent = fmtHours1(totalHours);
        const tClass = effortTextClass(totalHours);
        if (tClass) tdHours.classList.add(tClass);

        const tdAvg = document.createElement("td");
        tdAvg.className = "right mono";
        tdAvg.textContent = fmtHours1(avg);

        const tdTickets = document.createElement("td");
        tdTickets.className = "right mono";
        tdTickets.textContent = fmtInt(totalIssues);

        tr.appendChild(tdProj);
        tr.appendChild(tdOpen);
        tr.appendChild(tdClosed);
        tr.appendChild(tdHours);
        tr.appendChild(tdAvg);
        tr.appendChild(tdTickets);

        timeByProjectBody.appendChild(tr);
      }
    }

    renderStatusFamilyChart(statusFamilyDistribution);

    requestAnimationFrame(() => updateScrollableCue(timeByProjectWrap));

    const t = new Date();
    lastRefresh.textContent = t.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    await loadRuntimeInfo(syncStatus);
  } catch (e) {
    showError(String(e));
    try {
      const syncStatus = await fetchSyncStatus();
      await loadRuntimeInfo(syncStatus);
    } catch (_) {}
  }
}

syncBtn.addEventListener("click", async () => {
  syncBtn.disabled = true;
  syncBtn.textContent = "Starting…";
  try {
    await triggerSync();
  } finally {
    setTimeout(refreshDashboard, 700);
  }
});

window.addEventListener("resize", () => {
  updateScrollableCue(timeByProjectWrap);
  try {
    zingchart.exec("statusFamilyChart", "resize");
  } catch (e) {}
});

toggleClosed.addEventListener("change", () => {
  refreshDashboard();
});

refreshDashboard();
setInterval(refreshDashboard, 10000);
