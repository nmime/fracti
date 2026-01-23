import { generateExpenseReport, type ExpenseReportRow } from './analytics'
import { getAllSettlements, getGroup, getGroupMembers } from './dynamodb'

/**
 * Export functionality for CSV and PDF generation
 */

/**
 * Generate CSV content from expense data
 */
export function generateExpenseCSV(expenses: ExpenseReportRow[]): string {
  const headers = [
    'Date',
    'Description',
    'Amount',
    'Currency',
    'Paid By',
    'Category',
    'Split With',
    'Your Share',
  ]

  const rows = expenses.map((e) => [
    e.date,
    `"${e.description.replace(/"/g, '""')}"`, // Escape quotes in CSV
    e.amount.toFixed(2),
    e.currency,
    `"${e.payer.replace(/"/g, '""')}"`,
    e.category,
    `"${e.splitWith.replace(/"/g, '""')}"`,
    e.yourShare.toFixed(2),
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

/**
 * Generate settlement CSV
 */
export async function generateSettlementCSV(groupId: string): Promise<string> {
  const settlements = await getAllSettlements(groupId)

  const headers = [
    'Date',
    'From',
    'To',
    'Amount',
    'Currency',
    'Status',
    'Transaction Hash',
    'Completed At',
  ]

  const rows = settlements.map((s) => [
    new Date(s.createdAt).toISOString().split('T')[0],
    `"${s.fromUserName.replace(/"/g, '""')}"`,
    `"${s.toUserName.replace(/"/g, '""')}"`,
    s.amount.toFixed(2),
    s.currency ?? 'TON',
    s.status,
    s.txHash ?? '',
    s.completedAt ? new Date(s.completedAt).toISOString().split('T')[0] : '',
  ])

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

/**
 * Generate full group report CSV
 */
export async function generateGroupReportCSV(
  groupId: string,
  startDate?: string,
  endDate?: string
): Promise<string> {
  const [group, members, expenses, settlements] = await Promise.all([
    getGroup(groupId),
    getGroupMembers(groupId),
    generateExpenseReport(groupId, undefined, startDate, endDate),
    getAllSettlements(groupId),
  ])

  let csv = ''

  // Group info section
  csv += '=== GROUP REPORT ===\n'
  csv += `Group Name,${group?.title ?? 'Unknown'}\n`
  csv += `Generated,${new Date().toISOString()}\n`
  csv += `Period,${startDate ?? 'All time'} to ${endDate ?? 'Present'}\n`
  csv += `Members,${members.length}\n`
  csv += '\n'

  // Summary section
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalSettled = settlements
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + s.amount, 0)

  csv += '=== SUMMARY ===\n'
  csv += `Total Expenses,${totalExpenses.toFixed(2)}\n`
  csv += `Total Settled,${totalSettled.toFixed(2)}\n`
  csv += `Expense Count,${expenses.length}\n`
  csv += `Settlement Count,${settlements.length}\n`
  csv += '\n'

  // Member balances section
  csv += '=== MEMBER BALANCES ===\n'
  csv += 'Name,Total Paid,Total Owed,Net Balance\n'

  const memberBalances = new Map<string, { paid: number; owed: number }>()
  for (const member of members) {
    memberBalances.set(member.id, { paid: 0, owed: 0 })
  }

  for (const expense of expenses) {
    // Find the member ID by name (simplified - in real app would use ID)
    for (const [id, data] of memberBalances.entries()) {
      const member = members.find((m) => m.id === id)
      if (member?.name === expense.payer) {
        memberBalances.set(id, { ...data, paid: data.paid + expense.amount })
      }
    }
  }

  for (const member of members) {
    const data = memberBalances.get(member.id) ?? { paid: 0, owed: 0 }
    const net = data.paid - data.owed
    csv += `"${member.name}",${data.paid.toFixed(2)},${data.owed.toFixed(2)},${net.toFixed(2)}\n`
  }
  csv += '\n'

  // Expenses section
  csv += '=== EXPENSES ===\n'
  csv += generateExpenseCSV(expenses)
  csv += '\n\n'

  // Settlements section
  csv += '=== SETTLEMENTS ===\n'
  csv += await generateSettlementCSV(groupId)

  return csv
}

/**
 * Generate HTML report (can be converted to PDF client-side)
 */
export async function generateHTMLReport(
  groupId: string,
  startDate?: string,
  endDate?: string
): Promise<string> {
  const [group, members, expenses, settlements] = await Promise.all([
    getGroup(groupId),
    getGroupMembers(groupId),
    generateExpenseReport(groupId, undefined, startDate, endDate),
    getAllSettlements(groupId),
  ])

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const totalSettled = settlements
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + s.amount, 0)

  const currency = group?.currency ?? 'TON'

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Expense Report - ${group?.title ?? 'Group'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1 { color: #1a1a1a; border-bottom: 2px solid #007AFF; padding-bottom: 10px; }
    h2 { color: #444; margin-top: 30px; }
    .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
    .summary-card {
      background: #f5f5f7;
      padding: 15px;
      border-radius: 10px;
    }
    .summary-card .label { font-size: 12px; color: #666; text-transform: uppercase; }
    .summary-card .value { font-size: 24px; font-weight: bold; color: #1a1a1a; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e5e5; }
    th { background: #f5f5f7; font-weight: 600; }
    .amount { text-align: right; font-family: monospace; }
    .status-completed { color: #34c759; }
    .status-pending { color: #ff9500; }
    .footer { margin-top: 40px; font-size: 12px; color: #888; text-align: center; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>💰 Expense Report</h1>
  <p><strong>Group:</strong> ${group?.title ?? 'Unknown'}</p>
  <p><strong>Period:</strong> ${startDate ?? 'All time'} to ${endDate ?? 'Present'}</p>
  <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>

  <div class="summary">
    <div class="summary-card">
      <div class="label">Total Expenses</div>
      <div class="value">${totalExpenses.toFixed(2)} ${currency}</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Settled</div>
      <div class="value">${totalSettled.toFixed(2)} ${currency}</div>
    </div>
    <div class="summary-card">
      <div class="label">Expense Count</div>
      <div class="value">${expenses.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">Members</div>
      <div class="value">${members.length}</div>
    </div>
  </div>

  <h2>📊 Expenses</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Description</th>
        <th>Paid By</th>
        <th>Category</th>
        <th class="amount">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${expenses.map((e) => `
        <tr>
          <td>${e.date}</td>
          <td>${escapeHtml(e.description)}</td>
          <td>${escapeHtml(e.payer)}</td>
          <td>${e.category}</td>
          <td class="amount">${e.amount.toFixed(2)} ${e.currency}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>💸 Settlements</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>From</th>
        <th>To</th>
        <th class="amount">Amount</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${settlements.map((s) => `
        <tr>
          <td>${new Date(s.createdAt).toLocaleDateString()}</td>
          <td>${escapeHtml(s.fromUserName)}</td>
          <td>${escapeHtml(s.toUserName)}</td>
          <td class="amount">${s.amount.toFixed(2)} ${s.currency ?? currency}</td>
          <td class="status-${s.status}">${s.status}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>Generated by Fracti • ${new Date().toISOString()}</p>
  </div>

  <script class="no-print">
    // Enable print functionality
    window.printReport = () => window.print();
  </script>
</body>
</html>
`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
