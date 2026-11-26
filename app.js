"use strict";

const $ = (selector) => document.querySelector(selector);
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
  const levelLinks = [...document.querySelectorAll("[data-reference-section]")];
  const sectionNames = [...levelLinks.map((link) => link.dataset.referenceSection), "Benchmarks and evaluation", "Foundations", "Introduction", "Research outlook", "Conclusion"];
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
  for (const link of levelLinks) {
    link.addEventListener("click", () => {
      for (const key of ["q", "year", "type", "venue"]) inputs[key].value = defaultValues[key];
      inputs.section.value = link.dataset.referenceSection;
      changeFilters();
    });
  }
  window.addEventListener("popstate", () => {
    loadLocation();
    render();
  });
  loadLocation();
  render();
  const query = new URLSearchParams(location.search);
  if (!location.hash && ["page", ...Object.keys(inputs)].some((key) => query.has(key))) {
    library.scrollIntoView({behavior: "instant"});
  }
}

if (window.surveyData) {
  initBenchmarks(window.surveyData.benchmarks);
  initReferences(window.surveyData.references);
} else {
  $("#result-count").textContent = "The reference data could not be loaded.";
}
