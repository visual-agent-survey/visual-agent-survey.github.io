"use strict";

const $ = (selector) => document.querySelector(selector);
const levelData = [
  {
    name: "Fixed workflow",
    section: "L0 · Fixed workflow",
    description: "The task goal and initial observations determine a workflow. Later observations supply inputs to its scheduled operations.",
    facts: ["Working state and operation inputs", "During execution", "Scheduled workflow steps"],
    mechanisms: [["Preset execution", "The harness coordinates a workflow chosen before execution."]],
  },
  {
    name: "Within-task adaptation",
    section: "L1 · Within-task adaptation",
    description: "Feedback changes what the agent observes, plans, or does while it is solving the current task.",
    facts: ["Active workflow, output, or action", "Within the current task", "Subsequent steps in that task"],
    mechanisms: [
      ["Adaptive perception", "Select a viewpoint, re-ground a target, or revisit earlier visual evidence."],
      ["Feedback-driven planning", "Revise subgoals, repair a plan segment, or replan from the current state."],
      ["Dynamic harness orchestration", "Route to a model, tool, or skill using feedback from execution."],
      ["Output and action refinement", "Inspect a proposed answer, artifact, or action and refine it."],
      ["Execution monitoring and control", "Detect deviations and intervene during execution."],
    ],
  },
  {
    name: "Self-evolution",
    section: "L2 · Self-evolution",
    description: "Experience updates a model or harness resource. The revised resource is retained for a later task, trial, or training round.",
    facts: ["Model or harness resources", "Across tasks or rounds", "Later execution using the revised resource"],
    mechanisms: [
      ["Model-level evolution", "Update model capabilities from visual interaction or task feedback."],
      ["Memory-driven capability evolution", "Write and consolidate experience that later tasks can retrieve."],
      ["Skill and tool-level evolution", "Create, revise, or expand reusable skills and tools."],
      ["Orchestration-level evolution", "Retain changes to workflows, routing policies, or agent coordination."],
      ["Dynamic data and task evolution", "Construct or select experience for subsequent learning."],
    ],
  },
  {
    name: "Toward recursive self-improvement",
    section: "L3 · Toward RSI",
    description: "Experience revises a component of the updater, and the agent uses that revised component to produce a later retained update.",
    facts: ["A component of the improvement process", "Across improvement rounds", "A subsequent update to the agent"],
    mechanisms: [
      ["Evolving learning signals and experience", "Revise how training tasks, rewards, or feedback are produced."],
      ["Evolving memory and context management", "Update the procedures that select and maintain experience for learning."],
      ["Evolving update mechanisms", "Revise the procedures that generate or apply later updates."],
      ["Evolving evaluation and validation", "Improve the evaluator or verifier that guides a later update."],
    ],
  },
];

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function resourceLink(url, label, accessibleLabel = label) {
  const node = element("a", label);
  node.href = url;
  node.target = "_blank";
  node.rel = "noopener noreferrer";
  node.setAttribute("aria-label", accessibleLabel);
  return node;
}

function resourceLinks(record, name) {
  const links = element("div", undefined, "ref-links");
  for (const [key, label] of [["paper", "Paper"], ["code", "Code"], ["data", "Data"]]) {
    if (record[key]) links.append(resourceLink(record[key], label, `${label} for ${name}`));
  }
  return links;
}

const tabs = [...document.querySelectorAll("[data-level]")];
function showLevel(index) {
  const level = levelData[index];
  for (const tab of tabs) {
    const selected = Number(tab.dataset.level) === index;
    tab.setAttribute("aria-selected", selected);
    tab.tabIndex = selected ? 0 : -1;
  }
  $("#level-panel").setAttribute("aria-labelledby", tabs[index].id);
  $("#level-title").textContent = level.name;
  $("#level-description").textContent = level.description;
  $("#mechanism-title").textContent = index === 0 ? "Workflow" : "Mechanisms in the survey";
  $("#level-facts").replaceChildren(...["What changes", "When", "Used in"].map((label, factIndex) => {
    const row = element("div");
    row.append(element("dt", label), element("dd", level.facts[factIndex]));
    return row;
  }));
  $("#level-mechanisms").replaceChildren(...level.mechanisms.map(([name, description]) => {
    const row = element("li");
    row.append(element("strong", name), element("span", description));
    return row;
  }));
}

tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => showLevel(index));
  tab.addEventListener("keydown", (event) => {
    const nextByKey = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!Object.hasOwn(nextByKey, event.key)) return;
    event.preventDefault();
    const next = nextByKey[event.key];
    showLevel(next);
    tabs[next].focus();
  });
});
for (const link of document.querySelectorAll("[data-level-link]")) {
  link.addEventListener("click", () => showLevel(Number(link.dataset.levelLink)));
}
showLevel(1);

const copyButton = $("#copy-citation");
let copyTimer;
copyButton.addEventListener("click", async () => {
  const citation = $("#bibtex");
  clearTimeout(copyTimer);
  try {
    await navigator.clipboard.writeText(citation.textContent.trim());
    copyButton.textContent = "Copied";
    $("#copy-status").textContent = "BibTeX copied to the clipboard.";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(citation);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    copyButton.textContent = "BibTeX selected";
    $("#copy-status").textContent = "BibTeX selected. Use your system shortcut to copy.";
  }
  copyTimer = setTimeout(() => { copyButton.textContent = "Copy BibTeX"; }, 2400);
});

function normalized(text) {
  return text.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function searchWords(query) {
  return normalized(query).trim().split(/\s+/).filter(Boolean);
}

function addOptions(select, values) {
  for (const value of values) select.add(new Option(value, value));
}

function initBenchmarks(benchmarks) {
  const group = $("#benchmark-group");
  const search = $("#benchmark-search");
  const output = $("#benchmark-table");
  const items = benchmarks.map((row) => ({
    ...row,
    text: normalized([row.name, row.setting, row.capability, row.focus].join(" ")),
  }));
  addOptions(group, new Set(items.map((row) => row.group)));
  $("#benchmark-total").textContent = String(items.length);

  function render() {
    const words = searchWords(search.value);
    const rows = items.filter((row) =>
      (group.value === "all" || row.group === group.value) &&
      words.every((word) => row.text.includes(word))
    );
    if (!rows.length) {
      output.replaceChildren(element("p", "No matching benchmarks."));
      return;
    }
    const scroll = element("div", undefined, "benchmark-scroll");
    scroll.tabIndex = 0;
    scroll.setAttribute("role", "region");
    scroll.setAttribute("aria-label", "Benchmark table");
    const table = element("table");
    const header = table.createTHead().insertRow();
    for (const title of ["Benchmark", "Setting", "Capability", "Focus", "Scale", "Resources"]) {
      const cell = element("th", title);
      cell.scope = "col";
      header.append(cell);
    }
    const body = table.createTBody();
    for (const benchmark of rows) {
      const row = body.insertRow();
      const name = element("th", benchmark.name);
      name.scope = "row";
      row.append(name);
      for (const field of ["setting", "capability", "focus", "size"]) {
        row.insertCell().textContent = benchmark[field];
      }
      row.insertCell().append(resourceLinks(benchmark, benchmark.name));
    }
    scroll.append(table);
    output.replaceChildren(scroll);
  }

  group.addEventListener("change", render);
  search.addEventListener("input", render);
  render();
}

function initReferences(references) {
  const inputs = {
    q: $("#ref-search"),
    year: $("#ref-year"),
    type: $("#ref-type"),
    venue: $("#ref-venue"),
    section: $("#ref-section"),
    sort: $("#ref-sort"),
  };
  const resultList = $("#reference-results");
  const count = $("#result-count");
  const pagination = $("#pagination");
  const clear = $("#clear-filters");
  const library = $("#references");
  const pageSize = 12;
  const entries = references.map((row) => ({
    ...row,
    text: normalized([row.title, ...row.authors, row.key, row.year, row.venue].join(" ")),
  }));
  const years = [...new Set(entries.map((row) => row.year).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  const byLabel = (a, b) => a.localeCompare(b);
  const sectionNames = [...levelData.map((level) => level.section), "Benchmarks and evaluation", "Foundations", "Introduction", "Research outlook", "Conclusion"];
  addOptions(inputs.year, years);
  addOptions(inputs.type, [...new Set(entries.map((row) => row.type))].sort(byLabel));
  addOptions(inputs.venue, [...new Set(entries.map((row) => row.venue).filter(Boolean))].sort(byLabel));
  addOptions(inputs.section, sectionNames);
  $("#total-references").textContent = String(entries.length);
  $("#year-range").textContent = years.length ? `${years.at(-1)}–${years[0]}` : "";

  const yearCounts = years.map((year) => [year, entries.filter((row) => row.year === year).length]);
  const largest = Math.max(1, ...yearCounts.map(([, total]) => total));
  const bars = yearCounts.map(([year, total]) => {
    const bar = element("button", undefined, "year-bar");
    bar.type = "button";
    bar.setAttribute("aria-label", `${year}: ${total} references`);
    const meter = element("i");
    meter.setAttribute("aria-hidden", "true");
    meter.style.setProperty("--bar", `${total / largest * 100}%`);
    bar.append(element("span", year), meter, element("span", String(total)));
    bar.addEventListener("click", () => {
      inputs.year.value = inputs.year.value === year ? "all" : year;
      changeFilters();
    });
    return { year, bar };
  });
  $("#year-chart").replaceChildren(...bars.map(({ bar }) => bar));

  let page = 1;
  const defaultValues = {q: "", year: "all", type: "all", venue: "all", section: "all", sort: "recent"};
  const sorting = {
    recent: (a, b) => Number(b.year) - Number(a.year) || a.number - b.number,
    oldest: (a, b) => Number(a.year) - Number(b.year) || a.number - b.number,
    title: (a, b) => a.title.localeCompare(b.title),
    citation: (a, b) => a.number - b.number,
  };

  function loadLocation() {
    const parameters = new URLSearchParams(location.search);
    for (const [key, input] of Object.entries(inputs)) {
      input.value = parameters.get(key) ?? defaultValues[key];
      if (input instanceof HTMLSelectElement && input.selectedIndex < 0) input.value = defaultValues[key];
    }
    page = Math.max(1, Number.parseInt(parameters.get("page"), 10) || 1);
  }

  function writeLocation() {
    if (!["http:", "https:"].includes(location.protocol)) return;
    const url = new URL(location.href);
    for (const [key, input] of Object.entries(inputs)) {
      if (input.value === defaultValues[key]) url.searchParams.delete(key);
      else url.searchParams.set(key, input.value);
    }
    if (page === 1) url.searchParams.delete("page");
    else url.searchParams.set("page", page);
    history.replaceState(null, "", url);
  }

  function changeFilters() {
    page = 1;
    render();
    writeLocation();
  }

  function referenceRow(row) {
    const item = element("li");
    const key = element("span", `[${row.number}]`, "ref-index");
    const main = element("div", undefined, "ref-main");
    const title = element("h3");
    if (row.paper) title.append(resourceLink(row.paper, row.title));
    else title.textContent = row.title;
    main.append(title);
    const authorLimit = 5;
    if (row.authors.length) {
      const authors = row.authors.slice(0, authorLimit).join(", ");
      const suffix = row.authors.length > authorLimit ? ", et al." : "";
      const authorLine = element("p", authors + suffix, "ref-authors");
      if (suffix) authorLine.title = row.authors.join(", ");
      main.append(authorLine);
    }
    main.append(element("p", [row.venue, row.year, row.type].filter(Boolean).join(" · "), "ref-meta"));
    item.append(key, main);
    const links = resourceLinks(row, row.title);
    if (links.childElementCount) item.append(links);
    return item;
  }

  function renderPages(totalPages) {
    pagination.replaceChildren();
    if (totalPages < 2) return;
    function pageButton(label, target, disabled = false) {
      const button = element("button", label);
      button.type = "button";
      button.disabled = disabled;
      if (typeof label === "number") {
        button.setAttribute("aria-label", `Page ${label}`);
        if (target === page) button.setAttribute("aria-current", "page");
      }
      button.addEventListener("click", () => {
        page = target;
        render();
        writeLocation();
        count.tabIndex = -1;
        count.focus({preventScroll: true});
        count.scrollIntoView({block: "start"});
      });
      pagination.append(button);
    }
    pageButton("← Prev", page - 1, page === 1);
    const visible = new Set([1, totalPages, page - 1, page, page + 1]);
    let previous = 0;
    for (const number of [...visible].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b)) {
      if (number - previous > 1) pagination.append(element("span", "…"));
      pageButton(number, number);
      previous = number;
    }
    pageButton("Next →", page + 1, page === totalPages);
  }

  function render() {
    const words = searchWords(inputs.q.value);
    const filtered = entries.filter((row) =>
      ["year", "type", "venue"].every((key) => inputs[key].value === "all" || row[key] === inputs[key].value) &&
      (inputs.section.value === "all" || row.sections.includes(inputs.section.value)) &&
      words.every((word) => row.text.includes(word))
    ).sort(sorting[inputs.sort.value]);
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(page, totalPages);
    const first = (page - 1) * pageSize;
    count.textContent = total ? `${first + 1}–${Math.min(first + pageSize, total)} of ${total} references` : "0 references";
    clear.hidden = !["q", "year", "type", "venue", "section"].some((key) => inputs[key].value !== defaultValues[key]);
    for (const { year, bar } of bars) bar.setAttribute("aria-pressed", inputs.year.value === year);
    const visible = filtered.slice(first, first + pageSize).map(referenceRow);
    resultList.replaceChildren(...(visible.length ? visible : [element("li", "No matching references. Try a different search or clear the filters.", "no-results")]));
    renderPages(totalPages);
  }

  $("#reference-filters").addEventListener("submit", (event) => event.preventDefault());
  inputs.q.addEventListener("input", changeFilters);
  for (const key of ["year", "type", "venue", "section", "sort"]) inputs[key].addEventListener("change", changeFilters);
  clear.addEventListener("click", () => {
    for (const key of ["q", "year", "type", "venue", "section"]) inputs[key].value = defaultValues[key];
    changeFilters();
    inputs.q.focus();
  });
  $("#level-references").addEventListener("click", () => {
    for (const key of ["q", "year", "type", "venue"]) inputs[key].value = defaultValues[key];
    const current = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
    inputs.section.value = levelData[current].section;
    changeFilters();
  });
  window.addEventListener("popstate", () => {
    loadLocation();
    render();
  });
  loadLocation();
  render();
  if (!location.hash && location.search) library.scrollIntoView({behavior: "instant"});
}

if (window.surveyData) {
  initBenchmarks(window.surveyData.benchmarks);
  initReferences(window.surveyData.references);
} else {
  $("#result-count").textContent = "The reference data could not be loaded.";
}
