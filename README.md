# Recruiter Salary Benchmark Tool

This is a simple Phase 1 prototype for recruiters.

## What it does now

- Accepts a job title, years of experience, and keywords
- Scores comparable jobs with a simple weighted heuristic
- Estimates a salary range from the strongest visible salary examples
- Explains why each comparable job matched
- Generates a Google Jobs search URL for the recruiter
- Accepts pasted Google Jobs-style JSON as an ingestion step
- Shows a summary of how many jobs were found and how many had visible salary data

## What it does not do yet

- It does not automatically scrape Google Jobs yet
- It does not use machine learning
- It does not use embeddings or predictive models

## How the prototype is organized

- `index.html` - the page recruiters use
- `app/app.js` - matching, scoring, and salary range logic
- `app/styles.css` - simple visual styling
- `data/sampleJobs.js` - prototype job data used for testing the workflow

## How to use it

Open `index.html` in a browser.

## Phase plan

### Phase 1

Build the simplest working prototype with a clear recruiter workflow.

### Phase 2

Add a Google Jobs ingestion step. In this version, the app accepts structured Google Jobs-style JSON so the workflow can be tested end to end.

### Phase 3

Add a Google Jobs query builder so the recruiter can search Google Jobs directly, then paste structured results back into the tool.

### Phase 4

Improve filtering, outlier handling, and confidence rules.

### Phase 5

Make the output easier to copy, export, and share.
