// report-logic.js — V4
// Explains calculation methodology for each module

function renderReportLogic() {
  var content = document.getElementById('page-content');
  content.innerHTML = '<div id="logic-root"></div>';
  var root = document.getElementById('logic-root');

  root.innerHTML =
    '<div class="page-header">' +
      '<h2>Report Logic</h2>' +
      '<p>How each section calculates its numbers — reference for ops team</p>' +
    '</div>' +

    // Daily Tracker
    _logicSection('Daily Tracker', '#2E86C1', [
      {
        title: 'Data Source & Date',
        body: 'Each day at 2:00 AM, the system downloads the Unicommerce Inventory Adjustment History CSV from the automated email. It filters rows where the <strong>Created</strong> date = yesterday. All other dates in the CSV are ignored — this prevents historical duplication since Unicommerce sends a cumulative file each day.'
      },
      {
        title: 'Total Events',
        body: 'Count of unique SKU-level adjustment groups for the day. One "event" = one SKU at one facility by one user, regardless of how many individual ADD/REMOVE rows exist for that combination.'
      },
      {
        title: 'Added / Removed Qty',
        body: 'Sum of absolute quantities across all ADD rows (Added Qty) and all REMOVE rows (Removed Qty) for the day. TRANSFER rows are excluded entirely. REPLACE rows are handled separately.'
      },
      {
        title: 'Net Variance',
        body: '<strong>Added Qty − Removed Qty</strong>. Positive = more stock added than removed. Negative = more removed than added. Zero = perfectly balanced day.'
      },
      {
        title: 'Balanced SKUs',
        body: 'SKU groups where Added Qty = Removed Qty exactly (Net Variance = 0). These are included in the count but excluded from the Variance Tracker table — unless they have an Expiry Loss/Gain.'
      },
      {
        title: 'Variance SKUs',
        body: 'SKU groups where Net Variance ≠ 0. These appear in the Variance Tracker.'
      },
      {
        title: 'REPLACE Net Impact',
        body: 'For REPLACE type adjustments: <strong>New Quantity − Old Quantity</strong>. If a batch of 10 was replaced with 8, net impact = −2 (stock reduced). This is tracked separately from ADD/REMOVE variance and shown as an alert requiring ops review.'
      },
    ]) +

    // MTD Tracker
    _logicSection('MTD Tracker', '#059669', [
      {
        title: 'Month-to-Date Scope',
        body: 'Aggregates all daily records from the 1st of the current month through the latest processed date. Uses the same underlying data as Daily Tracker but accumulated across all days.'
      },
      {
        title: 'Daily Trend Chart',
        body: 'Each point = one calendar day. Shows Added Qty, Removed Qty, and Net Variance for that day. X-axis is sorted chronologically (oldest left, newest right).'
      },
      {
        title: 'Facility Type Breakdown',
        body: 'Groups all SKU events by Facility_Type (from Facility_Mapping sheet: Darkstore, MW-3PL, MW-Self, etc.) and sums Added/Removed/Net per type.'
      },
      {
        title: 'Top 20 SKUs by Variance',
        body: 'SKUs ranked by absolute Net Variance (|Added − Removed|) across the full MTD period. A SKU that added 100 and removed 90 ranks by its variance of 10. Balanced SKUs (variance = 0) are excluded.'
      },
      {
        title: 'Users Impacted',
        body: 'Count of <strong>unique</strong> usernames (from the Username column) who performed any adjustment during the MTD period. The same user working on multiple days is counted once.'
      },
    ]) +

    // Variance Tracker
    _logicSection('Variance Tracker', '#DC2626', [
      {
        title: 'What Appears Here',
        body: 'All SKU groups where: (a) Net Variance ≠ 0, OR (b) Net Variance = 0 but an Expiry Loss or Gain was detected. Purely balanced SKUs with no expiry issue are excluded to reduce noise.'
      },
      {
        title: 'Grouping Key',
        body: 'Each row = one unique combination of <strong>Date + Facility + Username + SKU Code</strong>. If the same SKU was adjusted by two different users at the same facility on the same day, they appear as separate rows.'
      },
      {
        title: 'Status Labels',
        body: '<strong>Added Not Removed</strong>: stock came in but nothing went out for this SKU. <strong>Removed Not Added</strong>: stock went out with no corresponding addition. <strong>Balanced</strong>: only shown here when there is an expiry impact.'
      },
      {
        title: 'Expiry Impact Column',
        body: 'Shown when the same SKU had both ADD and REMOVE on the same day. Compares the <strong>earliest ADD batch expiry</strong> vs the <strong>latest REMOVE batch expiry</strong>. If the batch you added expires sooner than the batch you removed, that is a loss (shelf life reduced). Days = difference in calendar days.'
      },
      {
        title: 'Facility Level 1 Cards',
        body: 'Each card = one facility. Net Qty = sum of all variance quantities for that facility in the selected month. Expiry Loss count = number of SKU events at that facility with detected expiry loss.'
      },
    ]) +

    // Expiry Tracker
    _logicSection('Expiry Tracker', '#D97706', [
      {
        title: 'What Is Captured',
        body: 'Only SKU groups where the same SKU had <strong>both ADD and REMOVE</strong> adjustments on the same day at the same facility by the same user. Pure ADD-only or REMOVE-only rows do not appear here.'
      },
      {
        title: 'Worst-Case Batch Selection',
        body: 'When multiple ADD batches exist for a SKU group, the system picks the one with the <strong>earliest expiry date</strong> (worst batch you added). For REMOVE, it picks the one with the <strong>latest expiry date</strong> (best batch you gave away). This gives the maximum possible expiry loss.'
      },
      {
        title: 'Days Lost/Gained',
        body: '<strong>REMOVE Batch Expiry − ADD Batch Expiry</strong> (in calendar days). Positive = Loss (you replaced a longer-life batch with a shorter-life one). Negative = Gain (you replaced a shorter-life batch with a longer one).'
      },
      {
        title: 'ADD Qty / REMOVE Qty',
        body: 'These quantities refer to the <strong>specific worst-case batch identified</strong>, not the total of all ADD or REMOVE rows for that SKU. Example: if 3 ADD batches exist, the qty shown is only for the one with earliest expiry. This is intentional — it identifies the exact batch causing the loss.'
      },
      {
        title: 'Loss vs Gain',
        body: '<strong>Loss</strong>: the batch you added expires earlier than the batch you removed — you have effectively shortened the shelf life of your stock. <strong>Gain</strong>: the batch you added expires later than the batch you removed — shelf life improved. <strong>Neutral</strong>: same expiry dates, no impact.'
      },
    ]) +

    // Remarks
    _logicSection('Remarks', '#6C3483', [
      {
        title: 'Purpose',
        body: 'Each variance or expiry event can have one remark attached per SKU-Facility-Date combination. Remarks are intended for ops team explanations: why did this variance happen, what was the root cause, what action was taken.'
      },
      {
        title: 'Locking',
        body: 'Once a remark is submitted ("Save & Lock"), it is stored permanently in the User_Remarks sheet. It appears in place of the "+ Remark" button in the Variance Tracker — the remark text is shown directly on the row.'
      },
    ]) +

    // Processing
    _logicSection('Data Processing Pipeline', '#0F2035', [
      {
        title: 'Step 1 — Gmail Fetch (2:00 AM)',
        body: 'The system searches Gmail for emails from noreply@e.unicommerce.com with subject "Inventory Adjustment History". The CloudFront CSV URL is extracted from the email body. The CSV is downloaded.'
      },
      {
        title: 'Step 2 — Parse & Filter',
        body: 'CSV is parsed. TRANSFER rows are excluded. Only rows with Created date = yesterday are processed. Rows are grouped by Date + Facility + Username + SKU.'
      },
      {
        title: 'Step 3 — Write to Sheets',
        body: 'Processed_Data: one row per SKU group. Variance_Tracker: only rows with variance or expiry impact. Batch_Expiry: only groups with both ADD and REMOVE. Dashboard_KPI: aggregated daily and MTD metrics.'
      },
      {
        title: 'Step 4 — Email Report (8:30 AM)',
        body: 'Daily summary email is sent to configured recipients. Subject line shows the data date (yesterday). "Published" line shows the send date (today).'
      },
      {
        title: 'Deduplication',
        body: 'Each CSV URL is tracked in the Config sheet. If the same URL is processed again, it is skipped. If data already exists in Processed_Data for a given date, that date is skipped during recovery runs.'
      },
    ]);
}

function _logicSection(title, color, items) {
  var cards = items.map(function(item) {
    return '<div style="border:1px solid var(--border);border-radius:var(--r-md);padding:16px 18px;background:var(--surface);">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<div style="width:3px;height:16px;background:' + color + ';border-radius:2px;flex-shrink:0;"></div>' +
        '<p style="font-size:13px;font-weight:600;color:var(--text-primary);margin:0;">' + item.title + '</p>' +
      '</div>' +
      '<p style="font-size:13px;color:var(--text-secondary);line-height:1.65;margin:0;">' + item.body + '</p>' +
    '</div>';
  }).join('');

  return '<div class="card section-row">' +
    '<div class="card-header" style="border-left:4px solid ' + color + ';">' +
      '<span class="card-title" style="font-size:14px;">' + title + '</span>' +
    '</div>' +
    '<div style="padding:16px 18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px;">' +
      cards +
    '</div>' +
  '</div>';
}
