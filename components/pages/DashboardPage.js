"use client";
// DashboardPage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity, timeAgoShort, WHATSAPP_SETUP_GUIDE_URL } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { canAccessFeature, getPlanLimits, canAccess } from '../../lib/featureGating';
import { useCountUp, Skeleton, DashStatSkeleton, DashPanelSkeleton, DashStatCard, ChartGrid, ChartTooltip, DashLineChart, DashBarChart, compactNumber, activityMeta, InitialsAvatar, Modal, FormInput, Button, StatCard, PageHeader, LoadingSpinner, StatusBadge, DataTable } from '../cs-ui';

function DashboardPage({ onNavigate }) {
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const { isFinanceVisible } = usePermissions();
  const CHURCH_ID = user?.church_id;
  const [stats, setStats] = useState({ members: 0, visitors: 0, salvations: 0, donations: 0 });
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [upcomingItems, setUpcomingItems] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [recentVisitors, setRecentVisitors] = useState([]);
  const [recentSalvations, setRecentSalvations] = useState([]);
  const [weeklyGiving, setWeeklyGiving] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const [filterLocation, setFilterLocation] = useState('all');
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('churchsmart_onboarding_dismissed') === 'true';
    return false;
  });
  const [onboardingCounts, setOnboardingCounts] = useState({ members: 0, services: 0, donations: 0, profileComplete: false, teamMembers: 0 });
  // Headline metrics, their period-over-period trends, and the chart series.
  const [metrics, setMetrics] = useState({
    members: 0, membersThisMonth: 0, membersTrend: null,
    lastAttendance: null, attendanceRate: null, attendanceTrend: null,
    givingThisMonth: 0, givingTrend: null,
    visitorsThisMonth: 0, visitorsTrend: null,
    attendanceSeries: [], givingSeries: []
  });
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [whatsappActive, setWhatsappActive] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => { fetchData(); }, [filterLocation]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Use parallel requests with limits — don't fetch ALL records
      const [members, visitors, salvations, donations, services, events, activityLogs, locationsData, attendanceRows, whatsappCfg] = await Promise.all([
        supabaseQuery('members', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], select: 'id,first_name,last_name,date_of_birth,location_id,photo_url,created_at' }),
        // Unlimited (scoped to a few columns): the monthly visitor counts and
        // their trend need the whole set, not just the latest five.
        supabaseQuery('visitors', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], select: 'id,full_name,visit_date,location_id,followup_status', order: 'visit_date.desc' }),
        supabaseQuery('salvations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'salvation_date.desc', limit: 5 }),
        supabaseQuery('donations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], select: 'id,amount,donation_date,location_id' }),
        supabaseQuery('services', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], select: 'id,name,day_of_week,start_time,is_active' }),
        supabaseQuery('events', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], select: 'id,title,event_date,start_time,event_type', order: 'event_date.asc' }),
        supabaseQuery('activity_logs', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'created_at.desc', limit: 10 }),
        supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('attendance_records', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], select: 'id,service_date,total_count,location_id', order: 'service_date.desc', limit: 30 }),
        // api_token is never selected into the client.
        supabaseQuery('whatsapp_config', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], select: 'is_active,api_token_last4,phone_number_id', single: true })
      ]);
      setLocations(locationsData || []);

      // Apply location filter
      const filteredMembers = filterLocation === 'all' ? (members || []) : (members || []).filter(m => m.location_id === filterLocation);
      const filteredVisitors = filterLocation === 'all' ? (Array.isArray(visitors) ? visitors : []) : (Array.isArray(visitors) ? visitors : []).filter(v => v.location_id === filterLocation);
      const filteredSalvations = filterLocation === 'all' ? (Array.isArray(salvations) ? salvations : []) : (Array.isArray(salvations) ? salvations : []).filter(s => s.location_id === filterLocation);
      const filteredDonations = filterLocation === 'all' ? (Array.isArray(donations) ? donations : []) : (Array.isArray(donations) ? donations : []).filter(d => d.location_id === filterLocation);
      
      // Calculate total donations
      const totalDonations = filteredDonations.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

      // ── Headline metrics ──
      // Trends compare the current calendar month with the previous one. A
      // month with no baseline yields null, so the card hides the indicator
      // instead of implying a 0% or +100% change. (The previous dashboard
      // showed hardcoded "+5%" / "+8%" figures that were never computed.)
      const monthOf = (value) => String(value || '').slice(0, 7);
      const nowDate = new Date();
      const thisMonthKey = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`;
      const prevMonthRef = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1);
      const prevMonthKey = `${prevMonthRef.getFullYear()}-${String(prevMonthRef.getMonth() + 1).padStart(2, '0')}`;
      const pctChange = (current, previous) => (previous ? ((current - previous) / previous) * 100 : null);
      const sumAmount = (rows) => rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

      const membersThisMonth = filteredMembers.filter(m => monthOf(m.created_at) === thisMonthKey).length;
      const membersPrevMonth = filteredMembers.filter(m => monthOf(m.created_at) === prevMonthKey).length;

      const givingThisMonth = sumAmount(filteredDonations.filter(d => monthOf(d.donation_date) === thisMonthKey));
      const givingPrevMonth = sumAmount(filteredDonations.filter(d => monthOf(d.donation_date) === prevMonthKey));

      const visitorsThisMonth = filteredVisitors.filter(v => monthOf(v.visit_date) === thisMonthKey).length;
      const visitorsPrevMonth = filteredVisitors.filter(v => monthOf(v.visit_date) === prevMonthKey).length;

      // attendance_records arrives newest-first.
      const attRows = (attendanceRows || []).filter(a => filterLocation === 'all' || a.location_id === filterLocation);
      const lastAttendance = attRows[0]?.total_count ?? null;
      const prevAttendance = attRows[1]?.total_count ?? null;
      const attendanceRate = (lastAttendance != null && filteredMembers.length > 0)
        ? (lastAttendance / filteredMembers.length) * 100
        : null;

      // Reversed so the chart reads left-to-right, oldest to newest.
      const attendanceSeries = attRows.slice(0, 12).reverse().map(a => {
        const d = new Date(a.service_date);
        return {
          label: isNaN(d.getTime()) ? '' : `${d.getDate()}/${d.getMonth() + 1}`,
          fullLabel: isNaN(d.getTime()) ? String(a.service_date) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          value: Number(a.total_count) || 0
        };
      });

      const givingSeries = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        givingSeries.push({
          label: d.toLocaleDateString(undefined, { month: 'short' }),
          fullLabel: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
          value: sumAmount(filteredDonations.filter(dn => monthOf(dn.donation_date) === key))
        });
      }

      setMetrics({
        members: filteredMembers.length,
        membersThisMonth,
        membersTrend: pctChange(membersThisMonth, membersPrevMonth),
        lastAttendance,
        attendanceRate,
        attendanceTrend: pctChange(lastAttendance, prevAttendance),
        givingThisMonth,
        givingTrend: pctChange(givingThisMonth, givingPrevMonth),
        visitorsThisMonth,
        visitorsTrend: pctChange(visitorsThisMonth, visitorsPrevMonth),
        attendanceSeries,
        givingSeries
      });
      setWhatsappActive(!!(whatsappCfg?.is_active && whatsappCfg?.api_token_last4 && whatsappCfg?.phone_number_id));
      
      // Calculate weekly giving (last 7 days)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayTotal = filteredDonations
          .filter(d => d.donation_date === dateStr)
          .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
        weekData.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          amount: dayTotal,
          date: dateStr
        });
      }
      setWeeklyGiving(weekData);
      
      // Get upcoming birthdays (next 30 days)
      const birthdayMembers = filteredMembers.filter(m => {
        if (!m.date_of_birth) return false;
        const dob = new Date(m.date_of_birth);
        const thisYearBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        const nextYearBirthday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
        const diffThis = Math.ceil((thisYearBirthday - today) / (1000 * 60 * 60 * 24));
        const diffNext = Math.ceil((nextYearBirthday - today) / (1000 * 60 * 60 * 24));
        return (diffThis >= 0 && diffThis <= 7) || (diffNext >= 0 && diffNext <= 7);
      }).map(m => {
        const dob = new Date(m.date_of_birth);
        let birthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        if (birthday < today) birthday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
        const daysUntil = Math.ceil((birthday - today) / (1000 * 60 * 60 * 24));
        return { ...m, birthday, daysUntil };
      }).sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 12);

      // Calculate next occurrence for each service
      const dayMap = { 'SUNDAY': 0, 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6 };
      const upcomingServices = (services || []).filter(s => s.is_active).map(service => {
        const serviceDay = dayMap[service.day_of_week];
        const todayDay = today.getDay();
        let daysUntil = serviceDay - todayDay;
        if (daysUntil < 0) daysUntil += 7;
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + daysUntil);
        return { id: service.id, title: service.name, date: nextDate, time: service.start_time, type: 'SERVICE', icon: '⛪', color: '#6366f1', daysUntil };
      });

      // Get upcoming events
      const upcomingEvents = (events || []).filter(e => new Date(e.event_date) >= today).map(event => {
        const eventDate = new Date(event.event_date);
        const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
        const eventIcons = { 'SERVICE': '⛪', 'CONFERENCE': '🎤', 'PRAYER': '🙏', 'MEETING': '👥', 'OUTREACH': '🌍', 'YOUTH': '🎉', 'GENERAL': '📅', 'WORKSHOP': '📚' };
        const eventColors = { 'SERVICE': '#6366f1', 'CONFERENCE': '#f59e0b', 'PRAYER': '#ec4899', 'MEETING': '#10b981', 'OUTREACH': '#3b82f6', 'YOUTH': '#8b5cf6', 'GENERAL': '#6b7280', 'WORKSHOP': '#14b8a6' };
        return { id: event.id, title: event.title, date: eventDate, time: event.start_time, type: event.event_type, icon: eventIcons[event.event_type] || '📅', color: eventColors[event.event_type] || '#6b7280', daysUntil, isEvent: true };
      });

      const combined = [...upcomingServices, ...upcomingEvents].sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 6);

      setStats({ members: members?.length || 0, visitors: (visitors || []).length, salvations: (salvations || []).length, donations: totalDonations });
      // Onboarding: also check church profile completeness and team size
      const [churchProfile, teamUsers] = await Promise.all([
        supabaseQuery('churches', { filters: [{ column: 'id', operator: 'eq', value: CHURCH_ID }], single: true }),
        supabaseQuery('church_users', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
      ]);
      const newCounts = {
        members: members?.length || 0,
        services: (services || []).length,
        donations: (donations || []).length,
        profileComplete: !!(churchProfile?.pastor_name && churchProfile?.city),
        teamMembers: (teamUsers || []).length
      };
      setOnboardingCounts(newCounts);
      // Show celebration if all onboarding steps are done and user hasn't seen it
      if (newCounts.members > 0 && newCounts.services > 0 && newCounts.donations > 0 && newCounts.profileComplete && newCounts.teamMembers > 1) {
        if (!localStorage.getItem('churchsmart_celebration_shown')) {
          setShowCelebration(true);
          localStorage.setItem('churchsmart_celebration_shown', 'true');
          setTimeout(() => setShowCelebration(false), 4000);
        }
      }
      setUpcomingBirthdays(birthdayMembers);
      setUpcomingItems(combined);
      setRecentActivity(activityLogs || []);
      setRecentVisitors(filteredVisitors.slice(0, 5));
      setUpcomingEvents(upcomingEvents.slice(0, 3));
      setRecentSalvations(filteredSalvations);
    } catch (error) { console.error('Dashboard fetch error:', error); }
    finally { setLoading(false); }
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

  const formatCurrency = (amount) => `${churchCurrency} ${(amount || 0).toLocaleString()}`;
  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  const formatTime = (timeStr) => timeStr ? timeStr.slice(0, 5) : '';
  const timeAgo = (dateStr) => {
    const diff = (new Date() - new Date(dateStr)) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };
  const getDaysLabel = (days) => {
    if (days === 0) return { label: 'Today', color: '#dc2626', bg: '#fef2f2' };
    if (days === 1) return { label: 'Tomorrow', color: '#f59e0b', bg: '#fef3c7' };
    if (days <= 3) return { label: `In ${days} days`, color: '#f59e0b', bg: '#fef3c7' };
    return { label: `In ${days} days`, color: '#6b7280', bg: '#f3f4f6' };
  };

  // Calculate weekly total for chart
  const weeklyTotal = weeklyGiving.reduce((sum, d) => sum + d.amount, 0);
  const maxDayAmount = Math.max(...weeklyGiving.map(d => d.amount), 1);

  return (
    <div>
      {/* Onboarding completion celebration */}
      {showCelebration && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', animation: 'cs-fade-in 0.3s' }}>
          <div style={{ textAlign: 'center', backgroundColor: 'white', borderRadius: '24px', padding: '48px', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <p style={{ fontSize: '64px', margin: '0 0 16px' }}>🎉</p>
            <h2 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>{t('allSetup')}</h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginTop: '16px' }}>
              {[...Array(12)].map((_, i) => (
                <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][i % 6], animation: `cs-confetti 0.6s ease-out ${i * 0.05}s both` }} />
              ))}
            </div>
          </div>
          <style dangerouslySetInnerHTML={{ __html: '@keyframes cs-fade-in{from{opacity:0}to{opacity:1}} @keyframes cs-confetti{0%{transform:translateY(0) scale(0)}50%{transform:translateY(-20px) scale(1.5)}100%{transform:translateY(0) scale(1)}}' }} />
        </div>
      )}
      <PageHeader
        title={`📊 ${t('dashboard')}`}
        subtitle={(() => {
          const hour = new Date().getHours();
          const greeting = hour < 12 ? t('goodMorning') : hour < 17 ? t('goodAfternoon') : t('goodEvening');
          const name = user?.name?.split(' ')[0] || '';
          return `${greeting}${name ? ', ' + name : ''} 👋 ${t('churchOverview')}`;
        })()}
        actions={<Button onClick={fetchData} variant="secondary">🔄 Refresh</Button>}
      />

      {/* Location Filter */}
      {locations.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={{ padding: '10px 20px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', color: '#4b5563', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500' }}>
            <option value="all">📍 {t('allLocations')}</option>
            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.is_main_campus ? `⭐ ${loc.name}` : loc.name}</option>)}
          </select>
        </div>
      )}

      {/* Skeleton mirrors the real layout so the page does not jump when data
          lands, rather than a spinner that discards the structure. */}
      {loading ? (
        <>
          <div className="cs-dash-stats" style={{ marginBottom: '16px' }}>
            {[0, 1, 2, 3].map(i => <DashStatSkeleton key={i} />)}
          </div>
          <div className="cs-dash-two" style={{ marginBottom: '16px' }}>
            <DashPanelSkeleton />
            <DashPanelSkeleton />
          </div>
          <div className="cs-dash-two" style={{ marginBottom: '16px' }}>
            <DashPanelSkeleton height="180px" />
            <DashPanelSkeleton height="180px" />
          </div>
          <DashPanelSkeleton height="92px" />
        </>
      ) : (
        <>
          {/* Onboarding Checklist */}
          {(() => {
            const steps = [
              { done: true, label: t('createChurch') },
              { done: onboardingCounts.profileComplete, label: t('updateProfile'), tab: 'settings' },
              { done: onboardingCounts.members > 0, label: t('addFirstMembers'), tab: 'members' },
              { done: onboardingCounts.teamMembers > 1, label: t('inviteTeam'), tab: 'settings' },
              { done: onboardingCounts.services > 0, label: t('setupService'), tab: 'services' },
              { done: onboardingCounts.donations > 0, label: t('recordFirstDonation'), tab: 'giving' },
            ];
            const allDone = steps.every(s => s.done);
            if (onboardingDismissed || allDone) return null;
            return (
              <div style={{ backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '16px', padding: '24px', marginBottom: '24px', position: 'relative' }}>
                <button onClick={() => { setOnboardingDismissed(true); localStorage.setItem('churchsmart_onboarding_dismissed', 'true'); }} style={{ position: 'absolute', top: '12px', right: '12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', color: '#6b7280' }} title="Dismiss">✕</button>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#312e81' }}>{t('gettingStarted')}</h3>
                <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#4338ca' }}>{t('completeSteps')} ({steps.filter(s => s.done).length}/{steps.length})</p>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '18px' }}>{step.done ? '✅' : '☐'}</span>
                      <span style={{ color: step.done ? '#166534' : '#374151', fontWeight: '500' }}>{step.label}</span>
                      {!step.done && step.tab && <button onClick={() => { const e = document.querySelector(`[data-tab="${step.tab}"]`); if (e) e.click(); }} style={{ padding: '2px 10px', fontSize: '12px', border: '1px solid #c7d2fe', borderRadius: '6px', backgroundColor: 'white', color: '#4f46e5', cursor: 'pointer' }}>{t('go')}</button>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ─────────── ROW 1 · Headline stats ─────────── */}
          <div className="cs-dash-stats" style={{ marginBottom: '16px' }}>
            <DashStatCard
              icon="👥"
              color="#6366f1"
              label={t('totalMembers')}
              value={metrics.members}
              sublabel={metrics.membersThisMonth > 0 ? `+${metrics.membersThisMonth} ${t('this_month')}` : null}
              trend={metrics.membersTrend}
              trendLabel={t('vs_last_month')}
            />
            <DashStatCard
              icon="⛪"
              color="#0ea5e9"
              label={t('attendance')}
              value={metrics.lastAttendance ?? 0}
              sublabel={metrics.attendanceRate != null
                ? `${Math.round(metrics.attendanceRate)}% ${t('of_members')}`
                : t('last_service')}
              trend={metrics.attendanceTrend}
              trendLabel={t('last_service')}
            />
            {isFinanceVisible && (
              <DashStatCard
                icon="💰"
                color="#10b981"
                label={t('giving_this_month')}
                value={metrics.givingThisMonth}
                display={(v) => formatCurrency(Math.round(v))}
                trend={metrics.givingTrend}
                trendLabel={t('vs_last_month')}
              />
            )}
            <DashStatCard
              icon="👋"
              color="#f59e0b"
              label={t('new_visitors')}
              value={metrics.visitorsThisMonth}
              sublabel={t('this_month')}
              trend={metrics.visitorsTrend}
              trendLabel={t('vs_last_month')}
            />
          </div>

          {/* ─────────── ROW 2 · Trends ─────────── */}
          <div className="cs-dash-two" style={{ marginBottom: '16px' }}>
            <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#111827' }}>📈 {t('attendance_trend')}</h3>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>{t('last_12_services')}</span>
              </div>
              <DashLineChart
                points={metrics.attendanceSeries}
                color="#6366f1"
                formatValue={(v) => String(Math.round(v))}
                emptyLabel={t('not_enough_data')}
              />
            </div>

            {isFinanceVisible && (
              <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#111827' }}>💹 {t('giving_trend')}</h3>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{t('last_6_months')}</span>
                </div>
                <DashBarChart
                  bars={metrics.givingSeries}
                  color="#10b981"
                  /* Axis labels are compacted (12k) so they fit; the tooltip
                     carries the exact figure. */
                  formatValue={(v) => compactNumber(v)}
                  emptyLabel={t('not_enough_data')}
                />
              </div>
            )}
          </div>

          {/* ─────────── ROW 3 · Activity + events & actions ─────────── */}
          <div className="cs-dash-two" style={{ marginBottom: '16px' }}>
            {/* Recent activity */}
            <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#111827' }}>🔔 {t('recent_activity')}</h3>
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('settings')}
                  style={{ border: 'none', background: 'none', padding: 0, color: '#6366f1', fontSize: '12px', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {t('view_all')}
                </button>
              </div>

              {recentActivity.length === 0 ? (
                <p style={{ margin: 0, padding: '32px 0', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>{t('no_recent_activity')}</p>
              ) : (
                <div style={{ display: 'grid', gap: '2px' }}>
                  {recentActivity.map((log, i) => {
                    const meta = activityMeta(log);
                    return (
                      <div key={log.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '9px 0', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
                        <span style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', backgroundColor: `${meta.color}14` }}>
                          {meta.icon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: '1.45' }}>{meta.text}</p>
                          <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>{timeAgo(log.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming events + quick actions */}
            <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: '600', color: '#111827' }}>📅 {t('upcomingEvents')}</h3>
                {upcomingEvents.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#9ca3af' }}>{t('no_upcoming_events')}</p>
                    <button
                      type="button"
                      onClick={() => onNavigate && onNavigate('services')}
                      style={{ border: 'none', background: 'none', padding: 0, color: '#6366f1', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {t('create_event')} →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {upcomingEvents.map((item, i) => {
                      const dayInfo = getDaysLabel(item.daysUntil);
                      return (
                        <div key={item.id || i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', backgroundColor: '#f9fafb', borderRadius: '10px', borderLeft: `3px solid ${item.color}` }}>
                          <span style={{ fontSize: '18px' }}>{item.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#6b7280' }}>
                              {formatDate(item.date)}{item.time ? ` · ${formatTime(item.time)}` : ''}
                            </p>
                          </div>
                          <span style={{ flexShrink: 0, padding: '3px 9px', backgroundColor: dayInfo.bg, color: dayInfo.color, borderRadius: '9999px', fontSize: '10px', fontWeight: '600', whiteSpace: 'nowrap' }}>{dayInfo.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600', color: '#111827' }}>⚡ {t('quickActions')}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    { icon: '👥', label: t('addMember'), tab: 'members' },
                    { icon: '📅', label: t('record_attendance'), tab: 'attendance' },
                    ...(isFinanceVisible ? [{ icon: '💰', label: t('record_offering'), tab: 'giving' }] : []),
                    { icon: '💬', label: t('send_message'), tab: 'messaging' }
                  ].map(action => (
                    <button
                      key={action.tab}
                      type="button"
                      onClick={() => onNavigate && onNavigate(action.tab)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9999px', border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#374151', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      <span>{action.icon}</span>{action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ─────────── ROW 4 · Birthdays ─────────── */}
          <div className="cs-dash-card" style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#111827' }}>🎂 {t('upcomingBirthdays')}</h3>
              {whatsappActive ? (
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#166534', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '9999px' }}>
                  {t('auto_greetings_enabled')} ✅
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('settings')}
                  style={{ border: 'none', background: 'none', padding: 0, color: '#6366f1', fontSize: '12px', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {t('enable_whatsapp_greetings')} →
                </button>
              )}
            </div>

            {upcomingBirthdays.length === 0 ? (
              <p style={{ margin: 0, padding: '20px 0', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>{t('no_upcoming_birthdays')}</p>
            ) : (
              <div className="cs-birthday-strip">
                {upcomingBirthdays.map((m, i) => (
                  <div key={m.id || i} style={{ width: '104px', textAlign: 'center', padding: '12px 8px', borderRadius: '12px', backgroundColor: m.daysUntil === 0 ? '#fef3c7' : '#f9fafb' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                      <InitialsAvatar name={`${m.first_name || ''} ${m.last_name || ''}`} color={m.daysUntil === 0 ? '#f59e0b' : '#6366f1'} />
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.first_name} {(m.last_name || '').charAt(0)}{m.last_name ? '.' : ''}
                    </p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#6b7280' }}>
                      {m.birthday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '10px', fontWeight: '600', color: m.daysUntil === 0 ? '#b45309' : '#9ca3af' }}>
                      {getDaysLabel(m.daysUntil).label}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
// ==========================================
// MEMBERS PAGE - With Location Support
// ==========================================

export default DashboardPage;
