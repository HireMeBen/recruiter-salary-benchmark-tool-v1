import { SAMPLE_JOBS } from "../data/sampleJobs.js";

const form = document.querySelector("#benchmark-form");
const queryForm = document.querySelector("#query-form");
const jobsForm = document.querySelector("#jobs-form");
const jobTitleInput = document.querySelector("#jobTitle");
const experienceInput = document.querySelector("#experience");
const keywordsInput = document.querySelector("#keywords");
const searchUrlInput = document.querySelector("#searchUrl");
const openSearchLink = document.querySelector("#openSearch");
const jobsJsonInput = document.querySelector("#jobsJson");
const salaryRangeEl = document.querySelector("#salaryRange");
const confidenceEl = document.querySelector("#confidence");
const jobCountEl = document.querySelector("#jobCount");
const salaryCountEl = document.querySelector("#salaryCount");
const topMatchEl = document.querySelector("#topMatch");
const copyReportBtn = document.querySelector("#copyReport");
const resetDemoBtn = document.querySelector("#resetDemo");
const copyStatusEl = document.querySelector("#copyStatus");
const actionStatusEl = document.querySelector("#actionStatus");
const reportSummaryMount = document.querySelector("#reportSummaryMount");
const jobListEl = document.querySelector("#jobList");
const rangeReasonEl = document.querySelector("#rangeReason");

const stopWords = new Set(["and", "or", "the", "a", "an", "for", "to", "of", "with", "in", "on"]);
const defaultJobs = SAMPLE_JOBS;
const demoDefaults = {
  jobTitle: "Sales Executive",
  experience: 2,
  keywords: "B2B Sales, Cold Calling, Lead Generation",
};

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9+ ]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(text) {
  return normalize(text)
    .split(" ")
    .filter((word) => word && !stopWords.has(word));
}

function titleSimilarity(inputTitle, jobTitle) {
  const a = new Set(tokenize(inputTitle));
  const b = new Set(tokenize(jobTitle));
  const overlap = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size || 1;
  return overlap / union;
}

function experienceMatch(inputYears, job) {
  if (inputYears >= job.experience_min && inputYears <= job.experience_max) return 1;
  const delta = inputYears < job.experience_min
    ? job.experience_min - inputYears
    : inputYears - job.experience_max;
  return Math.max(0, 1 - delta / 6);
}

function keywordOverlap(keywords, skills) {
  const input = new Set(tokenize(keywords));
  const jobSkills = new Set(skills.flatMap((skill) => tokenize(skill)));
  const overlap = [...input].filter((token) => jobSkills.has(token)).length;
  return overlap / (input.size || 1);
}

function scoreJob(input, job) {
  const title = titleSimilarity(input.jobTitle, job.job_title);
  const exp = experienceMatch(input.experience, job);
  const keywords = keywordOverlap(input.keywords, job.skills);
  const score = Math.round((title * 0.4 + exp * 0.3 + keywords * 0.3) * 100);

  return { ...job, similarity_score: score };
}

function salaryToNumber(value) {
  return Number(String(value).replace(/[^\d.]/g, ""));
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function summarizeReason(jobs) {
  const visible = jobs.filter((job) => job.salary_min && job.salary_max);
  if (visible.length === 0) return "No salary-visible jobs were found in this prototype dataset.";
  const sorted = [...visible].sort((a, b) => b.similarity_score - a.similarity_score);
  const top = sorted.slice(0, 3);
  return `Based on ${visible.length} salary-visible comparable jobs. Strongest examples: ${top
    .map((job) => `${job.job_title} (${job.similarity_score}/100)`)
    .join(", ")}.`;
}

function removeOutliers(values) {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
  const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
  const iqr = q3 - q1;
  const min = q1 - 1.5 * iqr;
  const max = q3 + 1.5 * iqr;
  return sorted.filter((value) => value >= min && value <= max);
}

function estimateSalary(jobs) {
  const visible = jobs.filter((job) => job.salary_min && job.salary_max);
  const weighted = visible.flatMap((job) => {
    const midpoint = (salaryToNumber(job.salary_min) + salaryToNumber(job.salary_max)) / 2;
    const repeats = Math.max(1, Math.round(job.similarity_score / 25));
    return Array.from({ length: repeats }, () => midpoint);
  });

  if (weighted.length === 0) {
    return { range: null, confidence: "Low" };
  }

  const cleaned = removeOutliers(weighted);
  const sorted = cleaned.sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.15)] ?? sorted[0];
  const high = sorted[Math.floor(sorted.length * 0.75)] ?? sorted[sorted.length - 1];

  let confidence = "Low";
  if (visible.length >= 10 && jobs.filter((job) => job.similarity_score >= 70).length >= 5) confidence = "High";
  else if (visible.length >= 5) confidence = "Medium";

  return { range: [low, high], confidence };
}

function render(results) {
  const { jobs, salary } = results;
  const visible = jobs.filter((job) => job.salary_min && job.salary_max);
  const top = jobs[0];
  jobListEl.innerHTML = jobs
    .map(
      (job) => `
        <article class="job-card">
          <div class="job-top">
            <div>
              <div class="job-title">${job.job_title}</div>
              <div class="job-meta">
                Experience: ${job.experience_min}-${job.experience_max} years<br />
                Skills: ${job.skills.join(", ")}
              </div>
            </div>
            <div class="pill">${job.similarity_score}/100 match</div>
          </div>
          <div class="job-body">
            <div><strong>Salary:</strong> ${job.salary_min && job.salary_max ? `${formatMoney(job.salary_min)}–${formatMoney(job.salary_max)}` : "Not visible"}</div>
            <div><strong>Why it matched:</strong> ${escapeHtml(job.match_reason)}</div>
            <div class="job-link-state">
              <a href="${escapeHtml(job.job_link)}" target="_blank" rel="noreferrer">Open job link</a>
            </div>
          </div>
        </article>
      `
    )
    .join("");

  if (salary.range) {
    salaryRangeEl.textContent = `${formatMoney(salary.range[0])}–${formatMoney(salary.range[1])}`;
  } else {
    salaryRangeEl.textContent = "No salary estimate yet";
  }
  confidenceEl.textContent = `Confidence: ${salary.confidence}`;
  jobCountEl.textContent = String(jobs.length);
  salaryCountEl.textContent = String(visible.length);
  topMatchEl.textContent = top ? `${top.job_title} (${top.similarity_score}/100)` : "-";
  rangeReasonEl.textContent = summarizeReason(jobs);
  reportSummaryMount.innerHTML = buildSummaryHtml(jobs, salary);
  actionStatusEl.textContent = `Loaded ${jobs.length} comparable jobs and ${visible.length} salary-visible jobs.`;
  copyReportBtn.onclick = async () => {
    const copied = await copyText(buildReportText(jobs, salary));
    copyStatusEl.textContent = copied ? "Report copied to clipboard." : "Copy failed in this browser.";
    setTimeout(() => {
      copyStatusEl.textContent = "Ready to copy the current recommendation.";
    }, 1400);
  };
}

function getJobsSource() {
  const raw = jobsJsonInput.value.trim();
  if (!raw) return defaultJobs;
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.jobs ?? [];
}

function buildGoogleJobsUrl({ jobTitle, experience, keywords }) {
  const query = [jobTitle, keywords].filter(Boolean).join(" ");
  const encoded = encodeURIComponent(query.trim());
  const base = `https://www.google.com/search?q=${encoded}`;
  const params = new URLSearchParams({
    hl: "en",
    gl: "us",
    ibp: "htl;jobs",
  });
  if (experience > 0) params.set("as_ylo", String(new Date().getFullYear() - experience));
  return `${base}&${params.toString()}`;
}

function buildComparableSearchUrl(jobTitle, keywords = []) {
  return [jobTitle, ...keywords].filter(Boolean).join(" ");
}

function loadDemoExample() {
  jobTitleInput.value = demoDefaults.jobTitle;
  experienceInput.value = String(demoDefaults.experience);
  keywordsInput.value = demoDefaults.keywords;
  searchUrlInput.value = "";
  openSearchLink.href = "#";
  openSearchLink.textContent = "Open Google Jobs Search";
  runBenchmark(null, defaultJobs);
  actionStatusEl.textContent = "Demo example loaded. Click Find Comparable Jobs to refresh the report.";
}

function buildJobLink(jobTitle, keywords = []) {
  const query = [jobTitle, ...keywords].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    q: query,
    hl: "en",
    gl: "us",
    ibp: "htl;jobs",
  });
  return `https://www.google.com/search?${params.toString()}`;
}

function resolveJobLink(job) {
  const link = typeof job.job_link === "string" ? job.job_link.trim() : "";
  if (link) return link;
  const fallbackTitle = job.job_title ?? job.title ?? "";
  const fallbackKeywords = job.skills ?? job.keywords ?? [];
  return buildJobLink(fallbackTitle, fallbackKeywords);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  try {
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.setAttribute("readonly", "true");
    temp.style.position = "fixed";
    temp.style.left = "-9999px";
    document.body.appendChild(temp);
    temp.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(temp);
    return copied;
  } catch {
    return false;
  }
}

function buildReportText(jobs, salary) {
  const visible = jobs.filter((job) => job.salary_min && job.salary_max);
  const topJobs = [...jobs].slice(0, 3).map((job) => {
    const salaryText = job.salary_min && job.salary_max ? `${formatMoney(job.salary_min)}-${formatMoney(job.salary_max)}` : "Not visible";
    return `${job.job_title} | ${job.similarity_score}/100 | ${salaryText} | ${job.job_link}`;
  });

  return [
    `Recruiter salary benchmark snapshot`,
    `Suggested salary range: ${salary.range ? `${formatMoney(salary.range[0])}-${formatMoney(salary.range[1])}` : "Not available"}`,
    `Confidence: ${salary.confidence}`,
    `Comparable jobs: ${jobs.length}`,
    `Salary-visible jobs: ${visible.length}`,
    "Top matches:",
    ...topJobs.map((line) => `- ${line}`),
  ].join("\n");
}

function buildSummaryHtml(jobs, salary) {
  const topFive = jobs.slice(0, 5);
  const topFiveHtml = topFive
    .map(
      (job, index) => `
        <div class="visible-report-job">
          <span>${index + 1}. ${escapeHtml(job.job_title)}</span>
          <a class="visible-report-link" href="${escapeHtml(job.job_link)}" target="_blank" rel="noreferrer">Open job link</a>
        </div>
      `
    )
    .join("");
  return `
    <div class="visible-report">
      <div class="visible-report-head">At-a-glance report</div>
      <div class="visible-report-row"><span>Confidence</span><strong>${salary.confidence}</strong></div>
      <div class="visible-report-row"><span>Comparable jobs</span><strong>${jobs.length}</strong></div>
      <div class="visible-report-row"><span>Top matches</span><strong>${topFive.length}</strong></div>
      <div class="visible-report-list">${topFiveHtml}</div>
      <div class="visible-report-row"><span>Suggested salary range</span><strong>${salary.range ? `${formatMoney(salary.range[0])}–${formatMoney(salary.range[1])}` : "Not available"}</strong></div>
    </div>
  `;
}

async function runBenchmark(event, sourceJobs = defaultJobs) {
  if (event) event.preventDefault();
  const input = {
    jobTitle: jobTitleInput.value,
    experience: Number(experienceInput.value || 0),
    keywords: keywordsInput.value,
  };

  const normalizedJobs = sourceJobs.map((job) => ({
    ...job,
    salary_min: job.salary_min ?? job.salaryMin ?? null,
    salary_max: job.salary_max ?? job.salaryMax ?? null,
    experience_min: job.experience_min ?? job.experienceMin ?? 0,
    experience_max: job.experience_max ?? job.experienceMax ?? 0,
    skills: job.skills ?? job.keywords ?? [],
    job_title: job.job_title ?? job.title ?? "",
    job_link: resolveJobLink(job),
    search_phrase: job.search_phrase ?? buildComparableSearchUrl(job.job_title ?? job.title ?? "", job.skills ?? job.keywords ?? []),
  }));

  const jobs = normalizedJobs
    .map((job) => {
      const scored = scoreJob(input, job);
      const match_reason = [
        `title overlap ${Math.round(titleSimilarity(input.jobTitle, job.job_title) * 100)}%`,
        `experience fit ${Math.round(experienceMatch(input.experience, job) * 100)}%`,
        `keyword overlap ${Math.round(keywordOverlap(input.keywords, job.skills) * 100)}%`,
      ].join(", ");
      return { ...scored, match_reason };
    })
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, 5);

  const salary = estimateSalary(jobs);
  render({ jobs, salary });
}

form.addEventListener("submit", (event) => {
  actionStatusEl.textContent = "Generating comparable jobs...";
  form.classList.add("is-pressing");
  setTimeout(() => form.classList.remove("is-pressing"), 180);
  runBenchmark(event);
});

queryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const searchUrl = buildGoogleJobsUrl({
    jobTitle: jobTitleInput.value,
    experience: Number(experienceInput.value || 0),
    keywords: keywordsInput.value,
  });
  searchUrlInput.value = searchUrl;
  openSearchLink.href = searchUrl;
  openSearchLink.textContent = "Open Google Jobs Search";
});

jobsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const jobs = getJobsSource();
    jobsJsonInput.value = JSON.stringify(jobs, null, 2);
    runBenchmark(null, jobs);
  } catch (error) {
    alert("The Google Jobs JSON could not be read. Please paste valid JSON and try again.");
    console.error(error);
  }
});

resetDemoBtn.addEventListener("click", () => {
  loadDemoExample();
});

runBenchmark(new Event("submit"), defaultJobs);

jobsJsonInput.value = JSON.stringify(
  SAMPLE_JOBS.map((job) => ({
    title: job.job_title,
    salaryMin: job.salary_min,
    salaryMax: job.salary_max,
    experienceMin: job.experience_min,
    experienceMax: job.experience_max,
    keywords: job.skills,
    url: job.job_link,
  })),
  null,
  2
);
