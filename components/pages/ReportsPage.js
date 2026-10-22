"use client";
// ReportsPage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits } from '../../lib/featureGating';
import { PageHeader, LoadingSpinner, Button, exportToCSV, StatCard, DataTable } from '../cs-ui';
import UpgradePrompt from '../UpgradePrompt';

function ReportsPage({ plan, onNavigate }) {
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeReport, setActiveReport] = useState('overview');
  const [dateRange, setDateRange] = useState('month');
  const [filterLocation, setFilterLocation] = useState('all');
  const [locations, setLocations] = useState([]);
  const [data, setData] = useState({
    members: [], visitors: [], donations: [], expenses: [], 
    salvations: [], attendance: [], volunteers: [], groups: []
  });

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [members, visitors, donations, expenses, salvations, attendance, volunteers, groups, locationsData] = await Promise.all([
        supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('visitors', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('donations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('expenses', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('salvations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('attendance_records', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('volunteers', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('groups', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
      ]);
      setData({
        members: members || [], visitors: visitors || [], donations: donations || [],
        expenses: expenses || [], salvations: salvations || [], attendance: attendance || [],
        volunteers: volunteers || [], groups: groups || []
      });
      setLocations(locationsData || []);
    } catch (error) {
      console.error('Reports fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocationName = (locationId) => {
    const location = locations.find(l => l.id === locationId);
    return location ? location.name : 'Unknown';
  };

  // Apply location filter to any dataset
  const filterByLocation = (items) => {
    if (filterLocation === 'all') return items;
    return items.filter(item => item.location_id === filterLocation);
  };

  // Date filtering
  const getDateFilter = () => {
    const today = new Date();
    let startDate;
    switch (dateRange) {
      case 'week': startDate = new Date(today.setDate(today.getDate() - 7)); break;
      case 'month': startDate = new Date(today.setMonth(today.getMonth() - 1)); break;
      case 'quarter': startDate = new Date(today.setMonth(today.getMonth() - 3)); break;
      case 'year': startDate = new Date(today.setFullYear(today.getFullYear() - 1)); break;
      default: startDate = new Date(0);
    }
    return startDate.toISOString().split('T')[0];
  };

  const filterByDate = (items, dateField) => {
    const startDate = getDateFilter();
    return items.filter(item => item[dateField] >= startDate);
  };

  // Calculations - apply both location and date filters
  const filteredDonations = filterByDate(filterByLocation(data.donations), 'donation_date');
  const filteredExpenses = filterByDate(filterByLocation(data.expenses), 'expense_date');
  const filteredSalvations = filterByDate(filterByLocation(data.salvations), 'salvation_date');
  const filteredVisitors = filterByDate(filterByLocation(data.visitors), 'visit_date');
  const filteredAttendance = filterByDate(filterByLocation(data.attendance), 'service_date');
  const filteredMembers = filterByLocation(data.members);
  const filteredVolunteers = filterByLocation(data.volunteers);
  const filteredGroups = filterByLocation(data.groups);

  const totalIncome = filteredDonations.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const netBalance = totalIncome - totalExpenses;
  const avgAttendance = filteredAttendance.length > 0 
    ? Math.round(filteredAttendance.reduce((sum, a) => sum + (a.total_count || 0), 0) / filteredAttendance.length)
    : 0;

  // Dynamic currency from church settings
  const [churchCurrency, setChurchCurrency] = useState('XAF');
  useEffect(() => {
    const fetchCurrency = async () => {
      const ch = await supabaseQuery('churches', { filters: [{ column: 'id', operator: 'eq', value: CHURCH_ID }], single: true });
      if (ch?.currency) setChurchCurrency(ch.currency);
    };
    if (CHURCH_ID) fetchCurrency();
  }, [CHURCH_ID]);

  const formatCurrency = (amount) => `${churchCurrency} ${(amount || 0).toLocaleString()}`;
  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  // Generate printable report
  const handlePrint = () => {
    // Add print styles dynamically
    const printStyle = document.createElement('style');
    printStyle.id = 'churchsmart-print-styles';
    printStyle.textContent = `
      @media print {
        body * { visibility: hidden; }
        #report-content, #report-content * { visibility: visible; }
        #report-content { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
        .sidebar, aside, nav, button, select { display: none !important; }
        @page { margin: 1cm; }
      }
    `;
    document.head.appendChild(printStyle);
    window.print();
    setTimeout(() => { const el = document.getElementById('churchsmart-print-styles'); if (el) el.remove(); }, 1000);
  };

  // Export CSV — context-aware based on active report tab
  const getExportData = () => {
    switch (activeReport) {
      case 'financial':
        return {
          data: [...filteredDonations.map(d => ({ Date: d.donation_date, Type: 'Income', Category: d.category, Donor: d.donor_name || '', Amount: d.amount, Method: d.payment_method || '' })),
                 ...filteredExpenses.map(e => ({ Date: e.expense_date, Type: 'Expense', Category: e.category, Description: e.description || '', Amount: e.amount, Method: '' }))].sort((a, b) => (b.Date || '').localeCompare(a.Date || '')),
          filename: 'financial-report'
        };
      case 'attendance':
        return {
          data: filteredAttendance.map(a => ({ Date: a.service_date, Men: a.men_count || 0, Women: a.women_count || 0, Children: a.children_count || 0, Total: a.total_count || 0, Offering: a.total_offering || 0 })),
          filename: 'attendance-report'
        };
      case 'membership':
        return {
          data: filteredMembers.map(m => ({ 'First Name': m.first_name, 'Last Name': m.last_name, Phone: m.phone || '', Email: m.email || '', Status: m.membership_status || '', Gender: m.gender || '', 'Membership Date': m.membership_date || '', City: m.city || '' })),
          filename: 'membership-report'
        };
      case 'salvations':
        return {
          data: filteredSalvations.map(s => ({ Name: s.full_name, Date: s.salvation_date, Phone: s.phone || '', 'Follow-up': s.followup_status || '', Notes: s.notes || '' })),
          filename: 'salvations-report'
        };
      case 'volunteers':
        return {
          data: filteredVolunteers.map(v => ({ Name: v.member_name || `${v.first_name || ''} ${v.last_name || ''}`.trim(), Ministry: v.ministry || '', Status: v.status || '', Leader: v.is_team_leader ? 'Yes' : 'No' })),
          filename: 'volunteers-report'
        };
      default: // overview — export a combined summary
        return {
          data: [...filteredDonations.map(d => ({ Date: d.donation_date, Type: 'Income', Category: d.category, Amount: d.amount })),
                 ...filteredExpenses.map(e => ({ Date: e.expense_date, Type: 'Expense', Category: e.category, Amount: e.amount }))].sort((a, b) => (b.Date || '').localeCompare(a.Date || '')),
          filename: 'church-overview-report'
        };
    }
  };

  const handleExportCSV = () => {
    const { data: exportData, filename } = getExportData();
    if (!exportData || exportData.length === 0) {
      toast.warning('No data to export for this report');
      return;
    }
    const BOM = '\uFEFF';
    const headers = Object.keys(exportData[0]);
    const headerRow = headers.map(h => `"${h}"`).join(',');
    const rows = exportData.map(row => headers.map(h => {
      let val = row[h] ?? '';
      val = String(val).replace(/"/g, '""');
      return `"${val}"`;
    }).join(','));
    const csv = BOM + [headerRow, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast.success(t('csvExportedSuccess'));
  };

  const hasBasicReports = canAccessFeature(plan, 'reports_basic');
  const hasAdvancedReports = canAccessFeature(plan, 'reports_advanced');

  const reportTypes = [
    { id: 'overview', label: '📊 Overview', icon: '📊', advanced: false },
    { id: 'financial', label: '💰 Financial', icon: '💰', advanced: true },
    { id: 'attendance', label: '👥 Attendance', icon: '👥', advanced: true },
    { id: 'membership', label: '📋 Membership', icon: '📋', advanced: false },
    { id: 'salvations', label: '❤️ Salvations', icon: '❤️', advanced: true },
    { id: 'volunteers', label: '🙋‍♂️ Volunteers', icon: '🙋‍♂️', advanced: true },
  ];

  if (!hasBasicReports) {
    return <UpgradePrompt feature="reports_basic" featureLabel="Reports & Analytics" onNavigate={onNavigate} />;
  }

  return (
    <div>
      <PageHeader
        title="📊 Reports"
        subtitle={t('generateReports')}
        actions={
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="secondary" onClick={handlePrint}>🖨️ Print</Button>
            {canAccessFeature(plan, 'data_import_export') ? <Button variant="secondary" onClick={handleExportCSV}>📥 Export CSV</Button> : <Button variant="secondary" onClick={() => onNavigate && onNavigate('settings')} style={{ opacity: 0.6 }}>🔒 Export CSV</Button>}
          </div>
        }
      />

      {/* Date Range & Location Selector */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>📅 Date Range:</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { value: 'week', label: 'Last 7 Days' },
              { value: 'month', label: 'Last 30 Days' },
              { value: 'quarter', label: 'Last 3 Months' },
              { value: 'year', label: 'Last Year' },
              { value: 'all', label: 'All Time' }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setDateRange(option.value)}
                style={{
                  padding: '8px 16px',
                  border: dateRange === option.value ? '2px solid #6366f1' : '1px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: dateRange === option.value ? '#eef2ff' : 'white',
                  color: dateRange === option.value ? '#6366f1' : '#6b7280',
                  fontWeight: dateRange === option.value ? '600' : '400',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>📍 Location:</span>
            <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}>
              <option value="all">All Locations</option>
              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.is_main_campus ? `🏛️ ${loc.name}` : loc.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {reportTypes.map(report => {
          const locked = report.advanced && !hasAdvancedReports;
          return (
            <button
              key={report.id}
              onClick={() => locked ? (onNavigate && onNavigate('settings')) : setActiveReport(report.id)}
              style={{
                padding: '10px 20px',
                border: !locked && activeReport === report.id ? '2px solid #6366f1' : '1px solid #e5e7eb',
                borderRadius: '10px',
                backgroundColor: locked ? '#f9fafb' : (activeReport === report.id ? '#eef2ff' : 'white'),
                color: locked ? '#9ca3af' : (activeReport === report.id ? '#6366f1' : '#6b7280'),
                fontWeight: !locked && activeReport === report.id ? '600' : '400',
                cursor: 'pointer',
                fontSize: '14px',
                opacity: locked ? 0.6 : 1
              }}
            >
              {locked ? '🔒 ' : ''}{report.label}
            </button>
          );
        })}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div id="report-content">
          {/* OVERVIEW REPORT */}
          {activeReport === 'overview' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ backgroundColor: '#dbeafe', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#1e40af' }}>👥 Total Members</p>
                  <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#1e40af' }}>{filteredMembers.length}</p>
                </div>
                <div style={{ backgroundColor: '#dcfce7', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#166534' }}>💰 Total Income</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#166534' }}>{formatCurrency(totalIncome)}</p>
                </div>
                <div style={{ backgroundColor: '#fef3c7', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#92400e' }}>📊 Avg Attendance</p>
                  <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#92400e' }}>{avgAttendance}</p>
                </div>
                <div style={{ backgroundColor: '#fce7f3', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#9d174d' }}>❤️ Salvations</p>
                  <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#9d174d' }}>{filteredSalvations.length}</p>
                </div>
              </div>

              {/* Quick Stats */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>📋 Quick Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280' }}>Membership</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Active Members</span><strong>{filteredMembers.filter(m => m.membership_status === 'ACTIVE').length}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>New Visitors</span><strong>{filteredVisitors.length}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Groups</span><strong>{filteredGroups.length}</strong></div>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280' }}>Financial</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Income</span><strong style={{ color: '#10b981' }}>{formatCurrency(totalIncome)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Expenses</span><strong style={{ color: '#ef4444' }}>{formatCurrency(totalExpenses)}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Net</span><strong style={{ color: netBalance >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(netBalance)}</strong></div>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280' }}>Ministry</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Volunteers</span><strong>{filteredVolunteers.length}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Active</span><strong>{filteredVolunteers.filter(v => v.status === 'ACTIVE').length}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Services Recorded</span><strong>{filteredAttendance.length}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FINANCIAL REPORT */}
          {activeReport === 'financial' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ backgroundColor: '#dcfce7', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#166534' }}>💵 Total Income</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#166534' }}>{formatCurrency(totalIncome)}</p>
                </div>
                <div style={{ backgroundColor: '#fef2f2', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#991b1b' }}>📤 Total Expenses</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#991b1b' }}>{formatCurrency(totalExpenses)}</p>
                </div>
                <div style={{ backgroundColor: netBalance >= 0 ? '#dbeafe' : '#fef2f2', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: netBalance >= 0 ? '#1e40af' : '#991b1b' }}>💰 Net Balance</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: netBalance >= 0 ? '#1e40af' : '#991b1b' }}>{formatCurrency(netBalance)}</p>
                </div>
              </div>

              {/* Income by Category */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>💵 Income by Category</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Category</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Amount</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['TITHE', 'OFFERING', 'DONATION', 'MISSIONS', 'BUILDING', 'SPECIAL', 'OTHER'].map((cat, i) => {
                      const amount = filteredDonations.filter(d => d.category === cat).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
                      if (amount === 0) return null;
                      const percentage = totalIncome > 0 ? ((amount / totalIncome) * 100).toFixed(1) : 0;
                      return (
                        <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '500' }}>{cat}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10b981', fontWeight: '600' }}>{formatCurrency(amount)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#6b7280' }}>{percentage}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Recent Transactions */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📜 Recent Transactions</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Category</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredDonations.map(d => ({ ...d, type: 'Income', date: d.donation_date })), 
                      ...filteredExpenses.map(e => ({ ...e, type: 'Expense', date: e.expense_date }))]
                      .sort((a, b) => new Date(b.date) - new Date(a.date))
                      .slice(0, 10)
                      .map((item, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px 16px', fontSize: '14px' }}>{formatDate(item.date)}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ padding: '4px 10px', backgroundColor: item.type === 'Income' ? '#dcfce7' : '#fef2f2', color: item.type === 'Income' ? '#166534' : '#991b1b', borderRadius: '9999px', fontSize: '12px' }}>
                              {item.type}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#6b7280' }}>{item.category}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: item.type === 'Income' ? '#10b981' : '#ef4444' }}>
                            {item.type === 'Income' ? '+' : '-'}{formatCurrency(item.amount)}
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ATTENDANCE REPORT */}
          {activeReport === 'attendance' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <StatCard label="Services Recorded" value={filteredAttendance.length} icon="⛪" color="#6366f1" />
                <StatCard label="Average Attendance" value={avgAttendance} icon="👥" color="#10b981" />
                <StatCard label="Total Attendance" value={filteredAttendance.reduce((sum, a) => sum + (a.total_count || 0), 0)} icon="📊" color="#f59e0b" />
                <StatCard label="First Time Visitors" value={filteredAttendance.reduce((sum, a) => sum + (a.first_timers || 0), 0)} icon="🆕" color="#8b5cf6" />
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📊 Attendance Records</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Men</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Women</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Children</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Total</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Offering</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendance.slice(0, 10).map((record, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>{formatDate(record.service_date)}</td>
                        <td style={{ padding: '12px 16px' }}>{record.men_count || 0}</td>
                        <td style={{ padding: '12px 16px' }}>{record.women_count || 0}</td>
                        <td style={{ padding: '12px 16px' }}>{record.children_count || 0}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '600', color: '#6366f1' }}>{record.total_count || 0}</td>
                        <td style={{ padding: '12px 16px', color: '#10b981' }}>{formatCurrency(record.total_offering)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MEMBERSHIP REPORT */}
          {activeReport === 'membership' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <StatCard label="Total Members" value={filteredMembers.length} icon="👥" color="#6366f1" />
                <StatCard label="Active" value={filteredMembers.filter(m => m.membership_status === 'ACTIVE').length} icon="✅" color="#10b981" />
                <StatCard label="New Visitors" value={filteredVisitors.length} icon="🚶" color="#f59e0b" />
                <StatCard label="Groups" value={filteredGroups.length} icon="👨‍👩‍👧‍👦" color="#8b5cf6" />
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📋 Members List</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Phone</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Location</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.slice(0, 15).map((member, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>{member.first_name} {member.last_name}</td>
                        <td style={{ padding: '12px 16px', color: '#6b7280' }}>{member.phone || '—'}</td>
                        <td style={{ padding: '12px 16px', color: '#6b7280' }}>{getLocationName(member.location_id)}</td>
                        <td style={{ padding: '12px 16px' }}><StatusBadge status={member.membership_status} /></td>
                        <td style={{ padding: '12px 16px', color: '#6b7280' }}>{formatDate(member.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SALVATIONS REPORT */}
          {activeReport === 'salvations' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <StatCard label="Total Salvations" value={filteredSalvations.length} icon="❤️" color="#ef4444" />
                <StatCard label="Pending Follow-up" value={filteredSalvations.filter(s => s.followup_status === 'PENDING').length} icon="⏳" color="#f59e0b" />
                <StatCard label="Completed" value={filteredSalvations.filter(s => s.followup_status === 'COMPLETED').length} icon="✅" color="#10b981" />
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>❤️ Salvation Records</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Phone</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Follow-up Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSalvations.map((salvation, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>{salvation.full_name}</td>
                        <td style={{ padding: '12px 16px', color: '#6b7280' }}>{formatDate(salvation.salvation_date)}</td>
                        <td style={{ padding: '12px 16px', color: '#6b7280' }}>{salvation.phone || '—'}</td>
                        <td style={{ padding: '12px 16px' }}><StatusBadge status={salvation.followup_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VOLUNTEERS REPORT */}
          {activeReport === 'volunteers' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <StatCard label="Total Volunteers" value={filteredVolunteers.length} icon="🙋‍♂️" color="#6366f1" />
                <StatCard label="Active" value={filteredVolunteers.filter(v => v.status === 'ACTIVE').length} icon="✅" color="#10b981" />
                <StatCard label="Team Leaders" value={filteredVolunteers.filter(v => v.is_team_leader).length} icon="⭐" color="#f59e0b" />
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>🙋‍♂️ Volunteers by Ministry</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Ministry</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Count</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Active</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Leaders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['Worship', 'Children', 'Youth', 'Ushers', 'Media', 'Security', 'Hospitality', 'Prayer'].map((ministry, i) => {
                      const ministryVolunteers = filteredVolunteers.filter(v => v.ministry === ministry);
                      if (ministryVolunteers.length === 0) return null;
                      return (
                        <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '500' }}>{ministry}</td>
                          <td style={{ padding: '12px 16px' }}>{ministryVolunteers.length}</td>
                          <td style={{ padding: '12px 16px', color: '#10b981' }}>{ministryVolunteers.filter(v => v.status === 'ACTIVE').length}</td>
                          <td style={{ padding: '12px 16px', color: '#f59e0b' }}>{ministryVolunteers.filter(v => v.is_team_leader).length}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
// ==========================================
// CALENDAR PAGE
// ==========================================

export default ReportsPage;
