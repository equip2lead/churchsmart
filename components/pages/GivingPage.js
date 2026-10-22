"use client";
// GivingPage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity, sanitizeInput, sanitizeObject, timeAgoShort, momoDeadline, momoExpired, MOMO_POLL_MS } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits, PLAN_PRICING, STRIPE_PRICE_IDS, isPlaceholderPriceId, getPlanOrder, comparePlans } from '../../lib/featureGating';
import { listCountries, detectOperator, findOperator, localAmount, toMsisdn } from '../../lib/pawapay';
import { Modal, FormInput, Button, DataTable, PageHeader, SearchBar, LoadingSpinner, ConfirmDialog, StatusBadge, exportToCSV, MemberProfile, StatCard } from '../cs-ui';
import UpgradePrompt from '../UpgradePrompt';

function GivingPage({ plan, onNavigate }) {
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('income');
  const [donations, setDonations] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [members, setMembers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [chartView, setChartView] = useState('monthly');
  const [filterLocation, setFilterLocation] = useState('all');

  const [donationForm, setDonationForm] = useState({ member_id: '', amount: '', donation_date: new Date().toISOString().split('T')[0], category_type: 'TITHE', payment_method: 'CASH', notes: '', location_id: '' });
  const [expenseForm, setExpenseForm] = useState({ category: '', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0], payment_method: 'CASH', vendor_name: '', receipt_number: '', approved_by: '', notes: '', location_id: '' });

  // Church-defined expense categories, replacing the old hardcoded list. Only
  // active rows are loaded: a deactivated category disappears from the picker
  // but stays readable on the expenses that already reference it, because
  // expenses.category stores the category NAME (NOT NULL varchar, no FK).
  const [expenseCategoryRows, setExpenseCategoryRows] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [savingCategory, setSavingCategory] = useState(false);

  const categories = ['TITHE', 'OFFERING', 'THANKSGIVING', 'MISSIONS', 'BUILDING', 'SPECIAL', 'DEVELOPMENT', 'PROJECTS', 'OTHER'];
  const paymentMethods = ['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CHECK', 'OTHER'];
  const paymentMethodLabelKeys = { CASH: 'cash', MOBILE_MONEY: 'mobileMoney', BANK_TRANSFER: 'bankTransfer', CHECK: 'check' };

  // expense_categories writes are admin-only at the RLS layer, so the inline
  // create is only offered to users who could actually complete it.
  const canManageCategories = user?.role === 'ADMIN' || !!user?.is_super_admin;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [donationsData, expensesData, membersData, locData, expCatData] = await Promise.all([
        supabaseQuery('donations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'donation_date.desc' }),
        supabaseQuery('expenses', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'expense_date.desc' }),
        supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('expense_categories', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }, { column: 'is_active', operator: 'eq', value: true }], order: 'name.asc' })
      ]);
      setDonations(donationsData || []);
      setExpenses(expensesData || []);
      setMembers(membersData || []);
      setLocations(locData || []);
      setExpenseCategoryRows(expCatData || []);
    } catch (error) {
      console.error('Giving fetch error:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const getLocationName = (locationId) => { const loc = locations.find(l => l.id === locationId); return loc ? loc.name : '—'; };

  // Filtered data
  const filteredDonations = filterLocation === 'all' ? donations : donations.filter(d => d.location_id === filterLocation);
  const filteredExpenses = filterLocation === 'all' ? expenses : expenses.filter(e => e.location_id === filterLocation);

  // Categories sorted alphabetically for the picker. localeCompare so accented
  // names order correctly for French-language churches.
  const sortedExpenseCategories = expenseCategoryRows
    .slice()
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Expenses recorded before custom categories existed carry legacy uppercase
  // codes ('UTILITIES', 'SUPPLIES', ...) that match no category row. Keep the
  // row's own value as an extra option while editing, otherwise opening and
  // saving such an expense would silently relabel it.
  const expenseCategoryOptions = sortedExpenseCategories.map(c => ({ value: c.name, label: c.name }));
  if (expenseForm.category && !expenseCategoryOptions.some(o => o.value === expenseForm.category)) {
    expenseCategoryOptions.push({ value: expenseForm.category, label: `${expenseForm.category} (legacy)` });
  }
  const selectedExpenseCategory = sortedExpenseCategories.find(c => c.name === expenseForm.category);

  // The report pairs income and expenses under one label, but the two are now
  // separate vocabularies: donation categories stay hardcoded while expense
  // categories are church-defined. Iterate the union, or church spending would
  // never appear in the breakdown even though it lands in the TOTAL row.
  // Legacy expense values are picked up from the rows themselves.
  const breakdownCategories = [];
  categories.forEach(c => { if (!breakdownCategories.includes(c)) breakdownCategories.push(c); });
  sortedExpenseCategories.forEach(c => { if (c.name && !breakdownCategories.includes(c.name)) breakdownCategories.push(c.name); });
  filteredExpenses.forEach(e => { if (e.category && !breakdownCategories.includes(e.category)) breakdownCategories.push(e.category); });

  // Calculations
  const totalIncome = filteredDonations.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const netBalance = totalIncome - totalExpenses;

  // Category breakdown for pie chart
  const categoryTotals = categories.map(cat => ({
    category: cat,
    amount: filteredDonations.filter(d => d.category_type === cat).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0)
  })).filter(c => c.amount > 0);

  const categoryColors = {
    'TITHE': '#6366f1', 'OFFERING': '#f59e0b', 'THANKSGIVING': '#10b981', 'MISSIONS': '#ec4899',
    'BUILDING': '#8b5cf6', 'SPECIAL': '#14b8a6', 'DEVELOPMENT': '#f97316', 'PROJECTS': '#06b6d4', 'OTHER': '#6b7280'
  };

  // Monthly trends data
  const getMonthlyData = () => {
    const months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = date.toISOString().slice(0, 7);
      const monthIncome = filteredDonations
        .filter(d => d.donation_date?.startsWith(monthStr))
        .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
      months.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        amount: monthIncome
      });
    }
    return months;
  };

  const monthlyData = getMonthlyData();
  const maxMonthly = Math.max(...monthlyData.map(m => m.amount), 1);

  // Form handlers
  const resetDonationForm = () => { const mainCampus = locations.find(l => l.is_main_campus); setDonationForm({ member_id: '', amount: '', donation_date: new Date().toISOString().split('T')[0], category_type: 'TITHE', payment_method: 'CASH', notes: '', location_id: mainCampus?.id || '' }); setEditingItem(null); };
  const resetExpenseForm = () => { const mainCampus = locations.find(l => l.is_main_campus); setExpenseForm({ category: '', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0], payment_method: 'CASH', vendor_name: '', receipt_number: '', approved_by: '', notes: '', location_id: mainCampus?.id || '' }); setEditingItem(null); };

  const openDonationModal = (donation = null) => {
    if (donation) {
      setEditingItem(donation);
      // member_id holds the dropdown selection: a member uuid, '' for Anonymous,
      // or the '__general__' sentinel for collective basket giving.
      const donorSelection = donation.member_id || (donation.donor_name === 'General' ? '__general__' : '');
      setDonationForm({ member_id: donorSelection, amount: donation.amount || '', donation_date: donation.donation_date || '', category_type: donation.category_type || 'TITHE', payment_method: donation.payment_method || 'CASH', notes: donation.notes || '', location_id: donation.location_id || '' });
    } else { resetDonationForm(); }
    setShowModal(true);
  };

  const openExpenseModal = (expense = null) => {
    if (expense) {
      setEditingItem(expense);
      setExpenseForm({ category: expense.category || '', amount: expense.amount || '', description: expense.description || '', expense_date: expense.expense_date || '', payment_method: expense.payment_method || 'CASH', vendor_name: expense.vendor_name || '', receipt_number: expense.receipt_number || '', approved_by: expense.approved_by || '', notes: expense.notes || '', location_id: expense.location_id || '' });
    } else { resetExpenseForm(); }
    setShowExpenseModal(true);
  };

  const handleSaveDonation = async () => {
    if (!donationForm.amount) { toast.warning(t('amountRequired')); return; }

    const isInsert = !editingItem;
    const formSnapshot = donationForm;
    const editingSnapshot = editingItem;
    const listSnapshot = donations;
    // donationForm.member_id is the dropdown holding state — '__general__' is a
    // UI sentinel and must not be written to the uuid column. Derive the real
    // member_id and a denormalized donor_name based on the selection.
    const selection = donationForm.member_id;
    let derivedMemberId = null;
    let donorName = 'Anonymous';
    if (selection === '__general__') {
      donorName = 'General';
    } else if (selection) {
      derivedMemberId = selection;
      const m = members.find(x => x.id === selection);
      if (m) donorName = `${m.first_name} ${m.last_name}`;
    }
    const data = {
      ...donationForm,
      amount: parseFloat(donationForm.amount),
      member_id: derivedMemberId,
      donor_name: donorName,
      location_id: donationForm.location_id || null,
      donation_date: donationForm.donation_date || null
    };
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (isInsert) {
      setDonations([{ id: tempId, ...data }, ...donations]);
    } else {
      setDonations(donations.map(d => d.id === editingItem.id ? { ...d, ...data } : d));
    }
    setShowModal(false);
    resetDonationForm();
    toast.success(isInsert ? `💰 ${t('donationRecorded')}` : t('savedSuccessfully'));

    try {
      if (isInsert) {
        const result = await supabaseInsert('donations', data);
        const realRow = Array.isArray(result) ? result[0] : result;
        if (realRow?.id) {
          setDonations(prev => prev.map(d => d.id === tempId ? realRow : d));
        }
        logActivity({
          action: 'donation_created',
          entity_type: 'donation',
          entity_id: realRow?.id || null,
          entity_name: donorName,
          details: { amount: data.amount, category: data.category_type }
        });
      } else {
        await supabaseUpdate('donations', editingItem.id, data);
        logActivity({
          action: 'donation_updated',
          entity_type: 'donation',
          entity_id: editingItem.id,
          entity_name: donorName,
          details: { amount: data.amount, category: data.category_type }
        });
      }
      fetchData(true).catch(err => console.error('Refetch failed', err));
    } catch (error) {
      setDonations(listSnapshot);
      setDonationForm(formSnapshot);
      if (editingSnapshot) setEditingItem(editingSnapshot);
      setShowModal(true);
      toast.error(t('saveFailed'));
    }
  };

  // Picking a category surfaces its description on the expense: it fills the
  // free-text Description when that field is still blank, but never overwrites
  // what the user already typed (or an existing expense's own description).
  const handleExpenseCategoryChange = (e) => {
    const name = e.target.value;
    const picked = sortedExpenseCategories.find(c => c.name === name);
    setExpenseForm(prev => ({
      ...prev,
      category: name,
      description: prev.description || picked?.description || ''
    }));
  };

  const handleSaveNewCategory = async () => {
    const name = (categoryForm.name || '').trim();
    if (!name) { toast.warning(t('categoryName')); return; }
    // The DB constraint is UNIQUE (church_id, name) and case-sensitive, so
    // check case-insensitively here to keep 'Rent' and 'rent' from coexisting.
    if (expenseCategoryRows.some(c => (c.name || '').toLowerCase() === name.toLowerCase())) {
      toast.warning(t('categoryExists'));
      return;
    }
    setSavingCategory(true);
    try {
      const result = await supabaseInsert('expense_categories', { name, description: (categoryForm.description || '').trim() || null, is_active: true });
      const realRow = Array.isArray(result) ? result[0] : result;
      if (realRow?.id) {
        setExpenseCategoryRows(prev => [...prev, realRow]);
        setExpenseForm(prev => ({ ...prev, category: realRow.name, description: prev.description || realRow.description || '' }));
      }
      logActivity({ action: 'expense_category_created', entity_type: 'expense_category', entity_id: realRow?.id || null, entity_name: name, details: null });
      setShowCategoryModal(false);
      setCategoryForm({ name: '', description: '' });
      toast.success(t('categoryCreated'));
    } catch (error) {
      // 23505 = unique_violation, i.e. the name exists but is deactivated (so
      // absent from expenseCategoryRows) or another admin just created it.
      toast.error(/23505|duplicate key/i.test(error.message || '') ? t('categoryExists') : error.message);
    }
    setSavingCategory(false);
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.category) { toast.warning(t('categoryRequired')); return; }
    if (!expenseForm.amount || !expenseForm.description) { toast.warning(t('amountDescRequired')); return; }

    const isInsert = !editingItem;
    const formSnapshot = expenseForm;
    const editingSnapshot = editingItem;
    const listSnapshot = expenses;
    const data = {
      ...expenseForm,
      amount: parseFloat(expenseForm.amount),
      location_id: expenseForm.location_id || null,
      expense_date: expenseForm.expense_date || null
    };
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (isInsert) {
      setExpenses([{ id: tempId, ...data }, ...expenses]);
    } else {
      setExpenses(expenses.map(e => e.id === editingItem.id ? { ...e, ...data } : e));
    }
    setShowExpenseModal(false);
    resetExpenseForm();
    toast.success(t('savedSuccessfully'));

    const expenseEntityName = ((data.description || '').slice(0, 80) || data.vendor_name || 'Expense');
    try {
      if (isInsert) {
        const result = await supabaseInsert('expenses', data);
        const realRow = Array.isArray(result) ? result[0] : result;
        if (realRow?.id) {
          setExpenses(prev => prev.map(e => e.id === tempId ? realRow : e));
        }
        logActivity({
          action: 'expense_created',
          entity_type: 'expense',
          entity_id: realRow?.id || null,
          entity_name: expenseEntityName,
          details: { amount: data.amount, category: data.category }
        });
      } else {
        await supabaseUpdate('expenses', editingItem.id, data);
        logActivity({
          action: 'expense_updated',
          entity_type: 'expense',
          entity_id: editingItem.id,
          entity_name: expenseEntityName,
          details: { amount: data.amount, category: data.category }
        });
      }
      fetchData(true).catch(err => console.error('Refetch failed', err));
    } catch (error) {
      setExpenses(listSnapshot);
      setExpenseForm(formSnapshot);
      if (editingSnapshot) setEditingItem(editingSnapshot);
      setShowExpenseModal(true);
      toast.error(t('saveFailed'));
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const target = deleteConfirm;
    await supabaseDelete(target.table, target.id);
    if (target.table === 'donations') {
      logActivity({
        action: 'donation_deleted',
        entity_type: 'donation',
        entity_id: target.id,
        entity_name: target.donor_name || null,
        details: { amount: target.amount, category: target.category_type }
      });
    } else if (target.table === 'expenses') {
      logActivity({
        action: 'expense_deleted',
        entity_type: 'expense',
        entity_id: target.id,
        entity_name: ((target.description || '').slice(0, 80) || target.vendor_name || 'Expense'),
        details: { amount: target.amount, category: target.category }
      });
    }
    setDeleteConfirm(null); fetchData();
  };

  // Accepts a donation row (not a memberId) so it can prefer the denormalized
  // donor_name written at save time, falling back to a member lookup for old
  // rows that pre-date donor_name being persisted.
  const getMemberName = (donation) => {
    if (donation?.member_id) {
      const member = members.find(m => m.id === donation.member_id);
      if (member) return `${member.first_name} ${member.last_name}`;
    }
    return donation?.donor_name || 'Anonymous';
  };

  // Dynamic currency from church settings
  const [churchCurrency, setChurchCurrency] = useState('XAF');
  useEffect(() => {
    const fetchCurrency = async () => {
      const ch = await supabaseQuery('churches', { filters: [{ column: 'id', operator: 'eq', value: CHURCH_ID }], single: true });
      if (ch?.currency) setChurchCurrency(ch.currency);
    };
    if (CHURCH_ID) fetchCurrency();
  }, [CHURCH_ID]);

  const formatCurrency = (amount) => `${churchCurrency} ${(parseFloat(amount) || 0).toLocaleString()}`;

  // Pie chart SVG
  const PieChart = ({ data, size = 200 }) => {
    const total = data.reduce((sum, d) => sum + d.amount, 0);
    if (total === 0) return <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>No data</div>;
    
    let currentAngle = 0;
    const paths = data.map((item, i) => {
      const percentage = item.amount / total;
      const angle = percentage * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const startRad = (startAngle - 90) * Math.PI / 180;
      const endRad = (endAngle - 90) * Math.PI / 180;
      const largeArc = angle > 180 ? 1 : 0;

      const x1 = 100 + 80 * Math.cos(startRad);
      const y1 = 100 + 80 * Math.sin(startRad);
      const x2 = 100 + 80 * Math.cos(endRad);
      const y2 = 100 + 80 * Math.sin(endRad);

      const pathData = `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`;
      
      return <path key={i} d={pathData} fill={categoryColors[item.category] || '#6b7280'} stroke="white" strokeWidth="2" />;
    });

    return (
      <svg width={size} height={size} viewBox="0 0 200 200">
        {paths}
        <circle cx="100" cy="100" r="40" fill="white" />
        <text x="100" y="95" textAnchor="middle" fontSize="12" fill="#6b7280">Total</text>
        <text x="100" y="115" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#374151">{(total / 1000000).toFixed(1)}M</text>
      </svg>
    );
  };

  return (
    <div>
      <PageHeader
        title={`💰 ${t('giving')}`}
        subtitle={t('trackFinances')}
        actions={
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="secondary" onClick={() => {
              const data = activeTab === 'income' ? (donations || []) : (expenses || []);
              const cols = activeTab === 'income' ? [
                { label: 'Date', key: 'donation_date' },
                { label: 'Donor', key: 'donor_name' },
                { label: 'Amount', key: 'amount' },
                { label: 'Category', key: 'category' },
                { label: 'Method', key: 'payment_method' },
              ] : [
                { label: 'Date', key: 'expense_date' },
                { label: 'Description', key: 'description' },
                { label: 'Amount', key: 'amount' },
                { label: 'Category', key: 'category' },
              ];
              const ok = exportToCSV(data, cols, activeTab === 'income' ? 'donations' : 'expenses');
              if (ok) toast.success(t('csvExportedSuccess')); else toast.warning(t('noRecordsToExport'));
            }}>📥 {t('exportCSV')}</Button>
            {activeTab === 'income' && <Button variant="secondary" onClick={() => { const bd={}; (donations||[]).forEach(d => { const n=d.donor_name||'Anonymous'; if(!bd[n])bd[n]=[]; bd[n].push(d); }); const rows=Object.entries(bd).map(([n,ds])=>({donor:n,total:ds.reduce((s,d)=>s+(parseFloat(d.amount)||0),0),count:ds.length,first:ds[ds.length-1]?.donation_date||'',last:ds[0]?.donation_date||''})); const ok = exportToCSV(rows,[{label:'Donor',key:'donor'},{label:'Total',key:'total'},{label:'Count',key:'count'},{label:'First',key:'first'},{label:'Last',key:'last'}],'giving-statements'); if (ok) toast.success(t('givingStatement')+' exported!'); else toast.warning(t('noRecordsToExport')); }}>📊 {t('givingStatement')}</Button>}
            {activeTab === 'income' && <Button onClick={() => openDonationModal()}>➕ Add Donation</Button>}
            {activeTab === 'expenses' && <Button onClick={() => openExpenseModal()}>➕ Add Expense</Button>}
          </div>
        }
      />

      {/* Tab Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setActiveTab('income')} style={{ padding: '12px 24px', border: activeTab === 'income' ? '2px solid #10b981' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: activeTab === 'income' ? '#d1fae5' : 'white', color: activeTab === 'income' ? '#10b981' : '#6b7280', fontWeight: activeTab === 'income' ? '600' : '400', cursor: 'pointer' }}>💵 Income</button>
          <button onClick={() => setActiveTab('expenses')} style={{ padding: '12px 24px', border: activeTab === 'expenses' ? '2px solid #ef4444' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: activeTab === 'expenses' ? '#fef2f2' : 'white', color: activeTab === 'expenses' ? '#ef4444' : '#6b7280', fontWeight: activeTab === 'expenses' ? '600' : '400', cursor: 'pointer' }}>📤 Expenses</button>
          <button onClick={() => setActiveTab('report')} style={{ padding: '12px 24px', border: activeTab === 'report' ? '2px solid #6366f1' : '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: activeTab === 'report' ? '#eef2ff' : 'white', color: activeTab === 'report' ? '#6366f1' : '#6b7280', fontWeight: activeTab === 'report' ? '600' : '400', cursor: 'pointer' }}>📊 Report</button>
        </div>
        <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={{ padding: '10px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}>
          <option value="all">All Locations</option>
          {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
        </select>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Income" value={formatCurrency(totalIncome)} icon="💵" color="#10b981" />
        <StatCard label="Total Expenses" value={formatCurrency(totalExpenses)} icon="📤" color="#ef4444" />
        <StatCard label="Net Balance" value={formatCurrency(netBalance)} icon="💰" color={netBalance >= 0 ? '#10b981' : '#ef4444'} />
        <StatCard label="This Month" value={formatCurrency(filteredDonations.filter(d => d.donation_date?.startsWith(new Date().toISOString().slice(0, 7))).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0))} icon="📅" color="#6366f1" />
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* INCOME TAB */}
          {activeTab === 'income' && (
            <>
              {/* Charts Section */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', marginBottom: '24px' }}>
                {/* Pie Chart */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: '600' }}>📊 Giving by Category</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <PieChart data={categoryTotals} size={180} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {categoryTotals.map((cat, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: categoryColors[cat.category] }} />
                          <span style={{ fontSize: '13px', color: '#374151' }}>{cat.category}</span>
                          <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: 'auto' }}>{((cat.amount / totalIncome) * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Line Chart - Monthly Trends */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>📈 Giving Trends</h3>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>Last 6 months</span>
                  </div>
                  <div style={{ position: 'relative', height: '150px' }}>
                    {/* Y-axis labels */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 20, width: '50px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px', color: '#6b7280' }}>
                      <span>{(maxMonthly / 1000000).toFixed(1)}M</span>
                      <span>{(maxMonthly / 2000000).toFixed(1)}M</span>
                      <span>0</span>
                    </div>
                    {/* Chart area */}
                    <div style={{ marginLeft: '55px', height: '130px', display: 'flex', alignItems: 'flex-end', gap: '8px', borderBottom: '1px solid #e5e7eb' }}>
                      {monthlyData.map((month, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '100%', maxWidth: '40px', backgroundColor: '#6366f1', borderRadius: '4px 4px 0 0', height: `${Math.max((month.amount / maxMonthly) * 110, 4)}px`, transition: 'height 0.3s' }} />
                        </div>
                      ))}
                    </div>
                    {/* X-axis labels */}
                    <div style={{ marginLeft: '55px', display: 'flex', gap: '8px', marginTop: '8px' }}>
                      {monthlyData.map((month, i) => (
                        <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: '#6b7280' }}>{month.month}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Donations Table */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>💵 Recent Donations</h3>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>{filteredDonations.length} records</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Donor</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Category</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Location</th>
                        <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Amount</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Method</th>
                        <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDonations.slice(0, 10).map((donation, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px 16px', fontSize: '14px' }}>{donation.donation_date}</td>
                          <td style={{ padding: '12px 16px', fontWeight: '500' }}>{getMemberName(donation)}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ padding: '4px 10px', backgroundColor: `${categoryColors[donation.category]}20`, color: categoryColors[donation.category], borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>{donation.category}</span>
                          </td>
                          <td style={{ padding: '12px 16px' }}><span style={{ padding: '2px 8px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '12px' }}>📍 {getLocationName(donation.location_id)}</span></td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#10b981' }}>{formatCurrency(donation.amount)}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{donation.payment_method}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <button onClick={() => openDonationModal(donation)} style={{ padding: '4px 8px', border: 'none', background: '#f3f4f6', borderRadius: '4px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' }}>✏️</button>
                            <button onClick={() => setDeleteConfirm({ ...donation, table: 'donations' })} style={{ padding: '4px 8px', border: 'none', background: '#fef2f2', borderRadius: '4px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* EXPENSES TAB */}
          {activeTab === 'expenses' && !canAccessFeature(plan, 'expenses') && (
            <UpgradePrompt feature="expenses" featureLabel="Expense Tracking" onNavigate={onNavigate} />
          )}
          {activeTab === 'expenses' && canAccessFeature(plan, 'expenses') && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📤 Expenses</h3>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>{filteredExpenses.length} records</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Description</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Category</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Location</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Amount</th>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Vendor</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((expense, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px', fontSize: '14px' }}>{expense.expense_date}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '500' }}>{expense.description}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '4px 10px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '9999px', fontSize: '12px' }}>{expense.category}</span>
                        </td>
                        <td style={{ padding: '12px 16px' }}><span style={{ padding: '2px 8px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '12px' }}>📍 {getLocationName(expense.location_id)}</span></td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: '#ef4444' }}>{formatCurrency(expense.amount)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{expense.vendor_name || '—'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button onClick={() => openExpenseModal(expense)} style={{ padding: '4px 8px', border: 'none', background: '#f3f4f6', borderRadius: '4px', cursor: 'pointer', marginRight: '4px', fontSize: '12px' }}>✏️</button>
                          <button onClick={() => setDeleteConfirm({ ...expense, table: 'expenses' })} style={{ padding: '4px 8px', border: 'none', background: '#fef2f2', borderRadius: '4px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                    {filteredExpenses.length === 0 && <tr><td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>No expenses recorded</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REPORT TAB */}
          {activeTab === 'report' && (
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <div style={{ backgroundColor: '#d1fae5', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#166534' }}>Total Income</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#166534' }}>{formatCurrency(totalIncome)}</p>
                </div>
                <div style={{ backgroundColor: '#fef2f2', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#991b1b' }}>Total Expenses</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#991b1b' }}>{formatCurrency(totalExpenses)}</p>
                </div>
                <div style={{ backgroundColor: netBalance >= 0 ? '#dbeafe' : '#fef2f2', borderRadius: '16px', padding: '24px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: netBalance >= 0 ? '#1e40af' : '#991b1b' }}>Net Balance</p>
                  <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: netBalance >= 0 ? '#1e40af' : '#991b1b' }}>{formatCurrency(netBalance)}</p>
                </div>
              </div>

              {/* Category Breakdown Table */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📊 Category Breakdown</h3>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Category</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Income</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Expenses</th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownCategories.map((cat, i) => {
                      const income = filteredDonations.filter(d => d.category_type === cat).reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
                      const expense = filteredExpenses.filter(e => e.category === cat).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
                      const net = income - expense;
                      if (income === 0 && expense === 0) return null;
                      return (
                        <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '500' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: categoryColors[cat] || '#6b7280' }} />
                              {cat}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#10b981' }}>{formatCurrency(income)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ef4444' }}>{formatCurrency(expense)}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: net >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(net)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderTop: '2px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '700' }}>TOTAL</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>{formatCurrency(totalIncome)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#ef4444' }}>{formatCurrency(totalExpenses)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: netBalance >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(netBalance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Export Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="secondary">🖨️ Print Report</Button>
                <Button variant="secondary">📄 Export PDF</Button>
                <Button variant="secondary">📊 Export Excel</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Donation Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetDonationForm(); }} title={editingItem ? '✏️ Edit Donation' : '➕ Add Donation'}>
        <FormInput label="Donor" type="select" value={donationForm.member_id} onChange={(e) => setDonationForm({ ...donationForm, member_id: e.target.value })} options={[{ value: '', label: 'Anonymous' }, { value: '__general__', label: t('generalDonor') }, ...members.map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))]} />
        <FormInput label="Amount (XAF) *" type="number" value={donationForm.amount} onChange={(e) => setDonationForm({ ...donationForm, amount: e.target.value })} required placeholder="50000" />
        <FormInput label="Date" type="date" value={donationForm.donation_date} onChange={(e) => setDonationForm({ ...donationForm, donation_date: e.target.value })} />
        <FormInput label="Category" type="select" value={donationForm.category_type} onChange={(e) => setDonationForm({ ...donationForm, category_type: e.target.value })} options={categories.map(c => ({ value: c, label: c }))} />
        <FormInput label="Payment Method" type="select" value={donationForm.payment_method} onChange={(e) => setDonationForm({ ...donationForm, payment_method: e.target.value })} options={paymentMethods.map(m => ({ value: m, label: m.replace('_', ' ') }))} />
        <FormInput label="📍 Location" type="select" value={donationForm.location_id} onChange={(e) => setDonationForm({ ...donationForm, location_id: e.target.value })} options={[{ value: '', label: 'Select location...' }, ...locations.map(l => ({ value: l.id, label: l.is_main_campus ? `🏛️ ${l.name} (Main)` : `🏢 ${l.name}` }))]} />
        <FormInput label="Notes" type="textarea" value={donationForm.notes} onChange={(e) => setDonationForm({ ...donationForm, notes: e.target.value })} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetDonationForm(); }}>Cancel</Button>
          <Button onClick={handleSaveDonation} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button>
        </div>
      </Modal>

      {/* Expense Modal */}
      <Modal isOpen={showExpenseModal} onClose={() => { setShowExpenseModal(false); resetExpenseForm(); }} title={editingItem ? '✏️ Edit Expense' : '➕ Add Expense'}>
        {/* Category picker + inline create. Hand-built rather than FormInput so
            the "Add Category" button can sit beside the select. */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
            {t('category')} <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={expenseForm.category} onChange={handleExpenseCategoryChange} style={{ flex: 1, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '16px', outline: 'none', boxSizing: 'border-box', minHeight: '44px' }}>
              <option value="">Select...</option>
              {expenseCategoryOptions.map((opt, i) => <option key={i} value={opt.value}>{opt.label}</option>)}
            </select>
            {canManageCategories && (
              <button type="button" onClick={() => { setCategoryForm({ name: '', description: '' }); setShowCategoryModal(true); }} style={{ flexShrink: 0, padding: '0 14px', minHeight: '44px', border: '1px dashed #6366f1', borderRadius: '10px', backgroundColor: '#eef2ff', color: '#6366f1', fontWeight: '600', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>➕ {t('addCategory')}</button>
            )}
          </div>
          {selectedExpenseCategory?.description && (
            <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#6b7280' }}>💡 {selectedExpenseCategory.description}</p>
          )}
        </div>
        <FormInput label="Amount (XAF) *" type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required placeholder="25000" />
        <FormInput label="Description *" value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} required placeholder="Biscuits for Sunday school" />
        <FormInput label="Date" type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} />
        <FormInput label={t('paymentMethod')} type="select" value={expenseForm.payment_method} onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value })} options={paymentMethods.map(m => ({ value: m, label: paymentMethodLabelKeys[m] ? t(paymentMethodLabelKeys[m]) : m.replace('_', ' ') }))} />
        <FormInput label={`${t('vendor')} / ${t('paidTo')}`} value={expenseForm.vendor_name} onChange={(e) => setExpenseForm({ ...expenseForm, vendor_name: e.target.value })} placeholder="e.g., Brother Luke, Supermarket" />
        <FormInput label={t('receiptNumber')} value={expenseForm.receipt_number} onChange={(e) => setExpenseForm({ ...expenseForm, receipt_number: e.target.value })} placeholder="e.g., REC-00142" />
        <FormInput label={t('approvedBy')} value={expenseForm.approved_by} onChange={(e) => setExpenseForm({ ...expenseForm, approved_by: e.target.value })} placeholder="e.g., Pastor Daniel" />
        <FormInput label="📍 Location" type="select" value={expenseForm.location_id} onChange={(e) => setExpenseForm({ ...expenseForm, location_id: e.target.value })} options={[{ value: '', label: 'Select location...' }, ...locations.map(l => ({ value: l.id, label: l.is_main_campus ? `🏛️ ${l.name} (Main)` : `🏢 ${l.name}` }))]} />
        <FormInput label="Notes" type="textarea" value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowExpenseModal(false); resetExpenseForm(); }}>Cancel</Button>
          <Button onClick={handleSaveExpense} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button>
        </div>
      </Modal>

      {/* Inline category create, opened from the expense form. Rendered after
          the expense modal so it layers above it. */}
      <Modal isOpen={showCategoryModal} onClose={() => { setShowCategoryModal(false); setCategoryForm({ name: '', description: '' }); }} title={`➕ ${t('addCategory')}`} width="420px">
        <FormInput label={`${t('categoryName')} *`} value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required placeholder="e.g., Sunday School" />
        <FormInput label={t('description')} type="textarea" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} placeholder="What this category covers" />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowCategoryModal(false); setCategoryForm({ name: '', description: '' }); }}>{t('cancel')}</Button>
          <Button onClick={handleSaveNewCategory} disabled={savingCategory}>{savingCategory ? '⏳' : `💾 ${t('save')}`}</Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleDelete} title="🗑️ Delete" message="Are you sure you want to delete this record?" />
    </div>
  );
}
// ==========================================
// SALVATIONS PAGE
// ==========================================

export default GivingPage;
