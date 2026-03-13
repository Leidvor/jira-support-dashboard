const runtimeLine = document.getElementById("runtimeLine");
const errorLine = document.getElementById("errorLine");

const kpiClients = document.getElementById("kpiClients");
const kpiTotalTickets = document.getElementById("kpiTotalTickets");
const kpiOpenTickets = document.getElementById("kpiOpenTickets");
const kpiClosedTickets = document.getElementById("kpiClosedTickets");
const kpiAvgResolution = document.getElementById("kpiAvgResolution");

const chartTicketsMeta = document.getElementById("chartTicketsMeta");
const chartOpenClosedMeta = document.getElementById("chartOpenClosedMeta");
const chartResolutionMeta = document.getElementById("chartResolutionMeta");
const clientsTableMeta = document.getElementById("clientsTableMeta");

const clientsTableBody = document.getElementById("clientsTableBody");
const clientsTableWrap = document.getElementById("clientsTableWrap");

const detailsTitle = document.getElementById("detailsTitle");
const detailsMeta = document.getElementById("detailsMeta");
const detailTotal = document.getElementById("detailTotal");
const detailOpen = document.getElementById("detailOpen");
const detailClosed = document.getElementById("detailClosed");
const detailAvgResolution = document.getElementById("detailAvgResolution");

const statusBreakdownBody = document.getElementById("statusBreakdownBody");
const priorityBreakdownBody = document.getElementById("priorityBreakdownBody");
const oldestClientTicketsBody = document.getElementById(
  "oldestClientTicketsBody",
);

let clientsOverview = null;
let selectedProjectKey = null;

function fmtInt(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
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

function clearError() {
  errorLine.textContent = "";
}

function showError(msg) {
  errorLine.textContent = String(msg);
}

async function fetchJson(url) {
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${url} -> ${res.status}: ${txt}`);
  }
  return res.json();
}

function updateScrollableCue(el) {
  if (!el) return;
  const hasOverflow = el.scrollHeight > el.clientHeight + 2;
  el.classList.toggle("has-overflow", hasOverflow);
}

function setRuntimeLine(text) {
  if (runtimeLine) {
    runtimeLine.textContent = text;
    runtimeLine.title = text;
  }
}

function renderTicketsByClientChart(items) {
  const top = items.slice(0, 10);
  chartTicketsMeta.textContent = `${fmtInt(items.length)} clients • Top 10 by volume`;

  zingchart.render({
    id: "ticketsByClientChart",
    data: {
      type: "bar",
      backgroundColor: "transparent",
      scaleX: {
        labels: top.map((x) => x.project_key),
        item: { fontColor: "#667085" },
      },
      scaleY: {
        guide: { lineStyle: "solid" },
        item: { fontColor: "#667085" },
      },
      plot: {
        borderRadius: 6,
        tooltip: {
          text: "%kt: %v tickets",
        },
      },
      series: [
        {
          values: top.map((x) => Number(x.total_issues || 0)),
          text: "Tickets",
          backgroundColor: "#3b82f6",
        },
      ],
    },
    height: "100%",
    width: "100%",
  });
}

function renderOpenClosedChart(items) {
  const top = items.slice(0, 10);
  chartOpenClosedMeta.textContent = `${fmtInt(items.length)} clients • Top 10 by volume`;

  zingchart.render({
    id: "openClosedChart",
    data: {
      type: "bar",
      stacked: true,
      backgroundColor: "transparent",
      scaleX: {
        labels: top.map((x) => x.project_key),
        item: { fontColor: "#667085" },
      },
      scaleY: {
        guide: { lineStyle: "solid" },
        item: { fontColor: "#667085" },
      },
      plot: {
        tooltip: {
          text: "%t • %kt: %v",
        },
      },
      legend: {
        layout: "x2",
        backgroundColor: "transparent",
        borderWidth: 0,
      },
      series: [
        {
          text: "Open",
          values: top.map((x) => Number(x.open_issues || 0)),
          backgroundColor: "#3b82f6",
        },
        {
          text: "Closed",
          values: top.map((x) => Number(x.closed_issues || 0)),
          backgroundColor: "#22c55e",
        },
      ],
    },
    height: "100%",
    width: "100%",
  });
}

function renderResolutionChart(items) {
  const filtered = items
    .filter(
      (x) =>
        x.avg_resolution_hours !== null && x.avg_resolution_hours !== undefined,
    )
    .sort(
      (a, b) =>
        Number(b.avg_resolution_hours || 0) -
        Number(a.avg_resolution_hours || 0),
    )
    .slice(0, 10);

  chartResolutionMeta.textContent = `${fmtInt(filtered.length)} clients with resolved tickets`;

  zingchart.render({
    id: "resolutionChart",
    data: {
      type: "bar",
      backgroundColor: "transparent",
      scaleX: {
        labels: filtered.map((x) => x.project_key),
        item: { fontColor: "#667085" },
      },
      scaleY: {
        guide: { lineStyle: "solid" },
        item: { fontColor: "#667085" },
      },
      plot: {
        borderRadius: 6,
        tooltip: {
          text: "%kt: %v h",
        },
      },
      series: [
        {
          values: filtered.map((x) => Number(x.avg_resolution_hours || 0)),
          text: "Avg resolution (h)",
          backgroundColor: "#8b5cf6",
        },
      ],
    },
    height: "100%",
    width: "100%",
  });
}

function renderOverviewTable(items) {
  clientsTableBody.innerHTML = "";
  clientsTableMeta.textContent = `${fmtInt(items.length)} clients • Click a row for details`;

  if (!items.length) {
    clientsTableBody.innerHTML = `<tr><td colspan="7" class="muted">No data</td></tr>`;
    return;
  }

  for (const row of items) {
    const tr = document.createElement("tr");
    tr.classList.add("clickable-row");
    tr.dataset.projectKey = row.project_key;

    tr.addEventListener("click", () => {
      window.location.href = `/clients/${encodeURIComponent(row.project_key)}`;
    });

    tr.innerHTML = `
    <td class="mono nowrap">${row.project_key || "UNKNOWN"}</td>
    <td class="right mono">${fmtInt(row.total_issues)}</td>
    <td class="right mono">${fmtInt(row.open_issues)}</td>
    <td class="right mono">${fmtInt(row.closed_issues)}</td>
    <td class="right mono">${fmtHours1(row.time_spent_hours)}</td>
    <td class="right mono">${fmtHours1(row.avg_hours_per_ticket)}</td>
    <td class="right mono">${fmtHours1(row.avg_resolution_hours)}</td>
  `;

    clientsTableBody.appendChild(tr);
  }

  updateSelectedClientRow();
  requestAnimationFrame(() => updateScrollableCue(clientsTableWrap));
}

function updateSelectedClientRow() {
  const rows = clientsTableBody.querySelectorAll("tr");
  rows.forEach((row) => {
    row.classList.toggle(
      "client-row-active",
      row.dataset.projectKey === selectedProjectKey,
    );
  });
}

function renderEmptyDetails() {
  detailsTitle.textContent = "Client details";
  detailsMeta.textContent = "Select a client";
  detailTotal.textContent = "—";
  detailOpen.textContent = "—";
  detailClosed.textContent = "—";
  detailAvgResolution.textContent = "—";

  statusBreakdownBody.innerHTML = `<tr><td colspan="2" class="muted">No client selected</td></tr>`;
  priorityBreakdownBody.innerHTML = `<tr><td colspan="2" class="muted">No client selected</td></tr>`;
  oldestClientTicketsBody.innerHTML = `<tr><td colspan="5" class="muted">No client selected</td></tr>`;
}

function renderDetails(details) {
  detailsTitle.textContent = `Client details • ${details.project_key}`;
  detailsMeta.textContent = `${fmtInt(details.total_issues)} tickets • ${fmtHours1(details.time_spent_hours)} h logged`;

  detailTotal.textContent = fmtInt(details.total_issues);
  detailOpen.textContent = fmtInt(details.open_issues);
  detailClosed.textContent = fmtInt(details.closed_issues);
  detailAvgResolution.textContent = fmtDuration(details.avg_resolution_hours);

  statusBreakdownBody.innerHTML = "";
  if (!details.status_breakdown.length) {
    statusBreakdownBody.innerHTML = `<tr><td colspan="2" class="muted">No data</td></tr>`;
  } else {
    for (const row of details.status_breakdown) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="truncate" title="${row.label}">${row.label}</td>
        <td class="right mono">${fmtInt(row.count)}</td>
      `;
      statusBreakdownBody.appendChild(tr);
    }
  }

  priorityBreakdownBody.innerHTML = "";
  if (!details.priority_breakdown.length) {
    priorityBreakdownBody.innerHTML = `<tr><td colspan="2" class="muted">No data</td></tr>`;
  } else {
    for (const row of details.priority_breakdown) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="truncate" title="${row.label}">${row.label}</td>
        <td class="right mono">${fmtInt(row.count)}</td>
      `;
      priorityBreakdownBody.appendChild(tr);
    }
  }

  oldestClientTicketsBody.innerHTML = "";
  if (!details.oldest_open_tickets.length) {
    oldestClientTicketsBody.innerHTML = `<tr><td colspan="5" class="muted">No open tickets</td></tr>`;
  } else {
    for (const row of details.oldest_open_tickets) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="mono nowrap">${row.key}</td>
        <td class="truncate" title="${row.status || ""}">${row.status || "—"}</td>
        <td class="truncate" title="${row.priority || ""}">${row.priority || "—"}</td>
        <td class="truncate" title="${row.assignee || ""}">${row.assignee || "—"}</td>
        <td class="right mono">${fmtHours1(row.age_hours)}</td>
      `;
      oldestClientTicketsBody.appendChild(tr);
    }
  }
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

  return `${v.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} h`;
}

async function selectClient(projectKey) {
  selectedProjectKey = projectKey;
  updateSelectedClientRow();

  try {
    const details = await fetchJson(
      `/stats/clients/details/${encodeURIComponent(projectKey)}`,
    );
    renderDetails(details);
  } catch (e) {
    showError(e);
  }
}

function renderOverview(data) {
  const items = Array.isArray(data.clients) ? data.clients.slice() : [];

  kpiClients.textContent = fmtInt(data.total_clients);
  kpiTotalTickets.textContent = fmtInt(data.total_tickets);
  kpiOpenTickets.textContent = fmtInt(data.total_open);
  kpiClosedTickets.textContent = fmtInt(data.total_closed);
  kpiAvgResolution.textContent = fmtDuration(data.global_avg_resolution_hours);

  renderTicketsByClientChart(items);
  renderOpenClosedChart(items);
  renderResolutionChart(items);
  renderOverviewTable(items);

  setRuntimeLine(
    `Clients: ${fmtInt(data.total_clients)} • Tickets: ${fmtInt(data.total_tickets)} • Open: ${fmtInt(data.total_open)} • Closed: ${fmtInt(data.total_closed)} • Logged time: ${fmtHours1(data.total_time_spent_hours)} h`,
  );
}

async function bootstrapClientsPage() {
  renderEmptyDetails();

  try {
    clearError();
    clientsOverview = await fetchJson("/stats/clients/overview");
    renderOverview(clientsOverview);

    const firstClient = clientsOverview?.clients?.[0]?.project_key;
    if (firstClient) {
      await selectClient(firstClient);
    }
  } catch (e) {
    console.error("bootstrapClientsPage failed", e);
    showError(e);
  }
}

window.addEventListener("resize", () => {
  updateScrollableCue(clientsTableWrap);
  try {
    zingchart.exec("ticketsByClientChart", "resize");
  } catch (_) {}
  try {
    zingchart.exec("openClosedChart", "resize");
  } catch (_) {}
  try {
    zingchart.exec("resolutionChart", "resize");
  } catch (_) {}
});

bootstrapClientsPage();
