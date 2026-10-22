"use client";
// AttendancePage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits } from '../../lib/featureGating';
import { Modal, FormInput, Button, DataTable, PageHeader, SearchBar, LoadingSpinner, ConfirmDialog, exportToCSV, StatCard, StatusBadge } from '../cs-ui';
import UpgradePrompt from '../UpgradePrompt';

function AttendancePage() {
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [activeView, setActiveView] = useState('charts');
  const [attendance, setAttendance] = useState([]);
  const [services, setServices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Filters
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterService, setFilterService] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('10weeks');
  
  const [form, setForm] = useState({
    service_id: '', location_id: '', service_date: new Date().toISOString().split('T')[0],
    men_count: 0, women_count: 0, children_count: 0,
    first_timers_count: 0, total_offering: 0, weather: 'SUNNY', notes: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [attendanceData, servicesData, locationsData] = await Promise.all([
        supabaseQuery('attendance_records', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'service_date.desc' }),
        supabaseQuery('services', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] })
      ]);
      setAttendance(attendanceData || []);
      setServices(servicesData || []);
      setLocations(locationsData || []);
    } catch (error) {
      console.error('Attendance fetch error:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Filter attendance data
  const getFilteredAttendance = () => {
    let filtered = [...attendance];
    
    // Filter by location
    if (filterLocation !== 'all') {
      filtered = filtered.filter(a => a.location_id === filterLocation);
    }
    
    // Filter by service
    if (filterService !== 'all') {
      filtered = filtered.filter(a => a.service_id === filterService);
    }
    
    // Filter by date range
    const now = new Date();
    let startDate;
    switch (filterDateRange) {
      case '4weeks': startDate = new Date(now.setDate(now.getDate() - 28)); break;
      case '10weeks': startDate = new Date(now.setDate(now.getDate() - 70)); break;
      case '6months': startDate = new Date(now.setMonth(now.getMonth() - 6)); break;
      case '1year': startDate = new Date(now.setFullYear(now.getFullYear() - 1)); break;
      default: startDate = new Date(now.setDate(now.getDate() - 70));
    }
    filtered = filtered.filter(a => new Date(a.service_date) >= startDate);
    
    return filtered.sort((a, b) => new Date(a.service_date) - new Date(b.service_date));
  };

  const filteredAttendance = getFilteredAttendance();

  // Calculate statistics
  const currentWeekAttendance = filteredAttendance.length > 0 ? filteredAttendance[filteredAttendance.length - 1]?.total_count || 0 : 0;
  const previousWeekAttendance = filteredAttendance.length > 1 ? filteredAttendance[filteredAttendance.length - 2]?.total_count || 0 : 0;
  const weekOverWeekChange = previousWeekAttendance > 0 ? (((currentWeekAttendance - previousWeekAttendance) / previousWeekAttendance) * 100).toFixed(1) : 0;
  
  const totalAttendance = filteredAttendance.reduce((sum, a) => sum + (a.total_count || 0), 0);
  const avgAttendance = filteredAttendance.length > 0 ? Math.round(totalAttendance / filteredAttendance.length) : 0;
  const totalFirstTimers = filteredAttendance.reduce((sum, a) => sum + (a.first_timers_count || 0), 0);
  const totalChildren = filteredAttendance.reduce((sum, a) => sum + (a.children_count || 0), 0);
  const childrenPercentage = totalAttendance > 0 ? ((totalChildren / totalAttendance) * 100).toFixed(0) : 0;

  // Get service name by ID
  const getServiceName = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return service?.name || 'Unknown';
  };

  // Get location name by ID
  const getLocationName = (locationId) => {
    const location = locations.find(l => l.id === locationId);
    return location?.name || 'Main Campus';
  };

  const resetForm = () => {
    setForm({
      service_id: services[0]?.id || '', location_id: locations.find(l => l.is_main_campus)?.id || locations[0]?.id || '',
      service_date: new Date().toISOString().split('T')[0],
      men_count: 0, women_count: 0, children_count: 0,
      first_timers_count: 0, total_offering: 0, weather: 'SUNNY', notes: ''
    });
    setEditingRecord(null);
  };

  const openModal = (record = null) => {
    if (record) {
      setEditingRecord(record);
      setForm({
        service_id: record.service_id || '',
        location_id: record.location_id || '',
        service_date: record.service_date || '',
        men_count: record.men_count || 0,
        women_count: record.women_count || 0,
        children_count: record.children_count || 0,
        first_timers_count: record.first_timers_count || 0,
        total_offering: record.total_offering || 0,
        weather: record.weather || 'SUNNY',
        notes: record.notes || ''
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.service_date) { toast.warning(t('serviceDateRequired')); return; }

    const isInsert = !editingRecord;
    const formSnapshot = form;
    const editingSnapshot = editingRecord;
    const listSnapshot = attendance;
    const data = {
      ...form,
      service_id: form.service_id || null,
      location_id: form.location_id || null,
      service_date: form.service_date || null,
      men_count: parseInt(form.men_count) || 0,
      women_count: parseInt(form.women_count) || 0,
      children_count: parseInt(form.children_count) || 0,
      first_timers_count: parseInt(form.first_timers_count) || 0,
      total_offering: parseFloat(form.total_offering) || 0
    };
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (isInsert) {
      setAttendance([{ id: tempId, ...data }, ...attendance]);
    } else {
      setAttendance(attendance.map(r => r.id === editingRecord.id ? { ...r, ...data } : r));
    }
    setShowModal(false);
    resetForm();
    toast.success(isInsert ? `✅ ${t('attendanceRecorded')}` : t('savedSuccessfully'));

    try {
      if (isInsert) {
        const result = await supabaseInsert('attendance_records', data);
        const realRow = Array.isArray(result) ? result[0] : result;
        if (realRow?.id) {
          setAttendance(prev => prev.map(r => r.id === tempId ? realRow : r));
        }
        logActivity({
          action: 'attendance_created',
          entity_type: 'attendance',
          entity_id: realRow?.id || null,
          entity_name: `${getServiceName(data.service_id)} • ${data.service_date || ''}`.trim() || null,
          details: { men: data.men_count, women: data.women_count, children: data.children_count, first_timers: data.first_timers_count }
        });
      } else {
        await supabaseUpdate('attendance_records', editingRecord.id, data);
        logActivity({
          action: 'attendance_updated',
          entity_type: 'attendance',
          entity_id: editingRecord.id,
          entity_name: `${getServiceName(data.service_id)} • ${data.service_date || ''}`.trim() || null,
          details: { men: data.men_count, women: data.women_count, children: data.children_count, first_timers: data.first_timers_count }
        });
      }
      fetchData(true).catch(err => console.error('Refetch failed', err));
    } catch (error) {
      setAttendance(listSnapshot);
      setForm(formSnapshot);
      if (editingSnapshot) setEditingRecord(editingSnapshot);
      setShowModal(true);
      toast.error(t('saveFailed'));
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const target = deleteConfirm;
    const entityName = `${getServiceName(target.service_id)} • ${target.service_date || ''}`.trim() || null;
    await supabaseDelete('attendance_records', target.id);
    logActivity({
      action: 'attendance_deleted',
      entity_type: 'attendance',
      entity_id: target.id,
      entity_name: entityName,
      details: { men: target.men_count, women: target.women_count, children: target.children_count, first_timers: target.first_timers_count }
    });
    setDeleteConfirm(null);
    fetchData();
  };

  // Simple chart using divs (bar chart visualization)
  const maxAttendance = Math.max(...filteredAttendance.map(a => a.total_count || 0), 1);

  return (
    <div>
      <PageHeader 
        title={`📊 ${t('attendance')}`}
        subtitle={t('trackAttendance')}
        actions={
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setActiveView('charts')}
              style={{
                padding: '10px 20px',
                border: activeView === 'charts' ? '2px solid #6366f1' : '1px solid #e5e7eb',
                borderRadius: '10px',
                backgroundColor: activeView === 'charts' ? '#6366f1' : 'white',
                color: activeView === 'charts' ? 'white' : '#6b7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: '500'
              }}
            >
              📈 Charts
            </button>
            <button
              onClick={() => setActiveView('details')}
              style={{
                padding: '10px 20px',
                border: activeView === 'details' ? '2px solid #6366f1' : '1px solid #e5e7eb',
                borderRadius: '10px',
                backgroundColor: activeView === 'details' ? '#6366f1' : 'white',
                color: activeView === 'details' ? 'white' : '#6b7280',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: '500'
              }}
            >
              📋 Details
            </button>
            <Button variant="secondary" onClick={() => {
              const filtered = (attendance || []).filter(r => filterLocation === 'all' || r.location_id === filterLocation);
              const ok = exportToCSV(filtered, [
                { label: 'Date', key: 'service_date' },
                { label: 'Service', accessor: r => getServiceName(r.service_id) },
                { label: 'Location', accessor: r => getLocationName(r.location_id) },
                { label: 'Men', key: 'men_count' },
                { label: 'Women', key: 'women_count' },
                { label: 'Children', key: 'children_count' },
                { label: 'First Timers', key: 'first_timers_count' },
                { label: 'Total', accessor: r => (r.men_count||0) + (r.women_count||0) + (r.children_count||0) },
              ], 'attendance');
              if (ok) toast.success(t('csvExportedSuccess')); else toast.warning(t('noRecordsToExport'));
            }}>📥 {t('exportCSV')}</Button>
            <Button onClick={() => openModal()}>➕ {t('recordAttendance')}</Button>
          </div>
        }
      />

      {/* Filters */}
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Location</label>
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}
            >
              <option value="all">All Locations</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Service</label>
            <select
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}
            >
              <option value="all">All Services</option>
              {services.map(svc => (
                <option key={svc.id} value={svc.id}>{svc.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Date Range</label>
            <select
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '14px' }}
            >
              <option value="4weeks">Last 4 Weeks</option>
              <option value="10weeks">Last 10 Weeks</option>
              <option value="6months">Last 6 Months</option>
              <option value="1year">Last Year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Current Week Attendance</p>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#111827' }}>{currentWeekAttendance}</p>
          <p style={{ fontSize: '14px', margin: 0, color: parseFloat(weekOverWeekChange) >= 0 ? '#10b981' : '#ef4444' }}>
            {parseFloat(weekOverWeekChange) >= 0 ? '+' : ''}{weekOverWeekChange}% from previous week
          </p>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Average Attendance</p>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#111827' }}>{avgAttendance}</p>
          <p style={{ fontSize: '14px', margin: 0, color: '#6b7280' }}>Over the {filterDateRange.replace('weeks', ' weeks').replace('months', ' months').replace('year', ' year')}</p>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>First Time Visitors</p>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#111827' }}>{totalFirstTimers}</p>
          <p style={{ fontSize: '14px', margin: 0, color: '#6b7280' }}>{filteredAttendance.length} total in period</p>
        </div>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 8px 0' }}>Children's Attendance</p>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#111827' }}>{totalChildren}</p>
          <p style={{ fontSize: '14px', margin: 0, color: '#6b7280' }}>{childrenPercentage}% of total attendance</p>
        </div>
      </div>

      {/* Charts View */}
      {activeView === 'charts' && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📈 Attendance Trends</h3>
            <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: '#6366f1', borderRadius: '2px' }}></span>
                Total Attendance
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: '#f59e0b', borderRadius: '2px' }}></span>
                Children
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '12px', backgroundColor: '#ec4899', borderRadius: '2px' }}></span>
                First Time Visitors
              </span>
            </div>
          </div>
          
          {/* Chart Area */}
          <div style={{ height: '300px', display: 'flex', alignItems: 'flex-end', gap: '8px', paddingBottom: '40px', position: 'relative' }}>
            {/* Y-axis labels */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: '40px', width: '50px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
              <span>{maxAttendance}</span>
              <span>{Math.round(maxAttendance * 0.75)}</span>
              <span>{Math.round(maxAttendance * 0.5)}</span>
              <span>{Math.round(maxAttendance * 0.25)}</span>
              <span>0</span>
            </div>
            
            {/* Bars */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '4px', marginLeft: '60px', height: '100%' }}>
              {filteredAttendance.slice(-12).map((record, index) => {
                const totalHeight = ((record.total_count || 0) / maxAttendance) * 100;
                const childrenHeight = ((record.children_count || 0) / maxAttendance) * 100;
                const firstTimersHeight = ((record.first_timers_count || 0) / maxAttendance) * 100;
                
                return (
                  <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '100%', display: 'flex', gap: '2px', alignItems: 'flex-end', height: '220px' }}>
                      {/* Total bar */}
                      <div
                        style={{
                          flex: 1,
                          height: `${totalHeight}%`,
                          backgroundColor: '#6366f1',
                          borderRadius: '4px 4px 0 0',
                          minHeight: '4px',
                          transition: 'height 0.3s ease'
                        }}
                        title={`Total: ${record.total_count}`}
                      />
                      {/* Children bar */}
                      <div
                        style={{
                          flex: 1,
                          height: `${childrenHeight}%`,
                          backgroundColor: '#f59e0b',
                          borderRadius: '4px 4px 0 0',
                          minHeight: record.children_count > 0 ? '4px' : '0',
                          transition: 'height 0.3s ease'
                        }}
                        title={`Children: ${record.children_count}`}
                      />
                      {/* First timers bar */}
                      <div
                        style={{
                          flex: 1,
                          height: `${firstTimersHeight}%`,
                          backgroundColor: '#ec4899',
                          borderRadius: '4px 4px 0 0',
                          minHeight: record.first_timers_count > 0 ? '4px' : '0',
                          transition: 'height 0.3s ease'
                        }}
                        title={`First Timers: ${record.first_timers_count}`}
                      />
                    </div>
                    <span style={{ fontSize: '10px', color: '#6b7280', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                      {new Date(record.service_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary below chart */}
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#6366f1', margin: 0 }}>{totalAttendance}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Total Attendance</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', margin: 0 }}>{filteredAttendance.length}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Services Recorded</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>{`XAF ${filteredAttendance.reduce((sum, a) => sum + (a.total_offering || 0), 0).toLocaleString()}`}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Total Offering</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#ec4899', margin: 0 }}>{locations.length}</p>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Locations</p>
            </div>
          </div>
        </div>
      )}

      {/* Details View */}
      {activeView === 'details' && (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📋 Attendance Records</h3>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>{filteredAttendance.length} records</span>
          </div>
          {loading ? <LoadingSpinner /> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f9fafb' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>{t('date')}</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Service</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Location</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>{t('men')}</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>{t('women')}</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>{t('children')}</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>{t('total')}</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>First Timers</th>
                    <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Offering</th>
                    <th style={{ textAlign: 'right', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendance.slice().reverse().map((record, index) => (
                    <tr key={index} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '16px', fontWeight: '500' }}>{new Date(record.service_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td>
                      <td style={{ padding: '16px', color: '#6366f1' }}>{getServiceName(record.service_id)}</td>
                      <td style={{ padding: '16px', color: '#6b7280' }}>{getLocationName(record.location_id)}</td>
                      <td style={{ padding: '16px' }}>{record.men_count}</td>
                      <td style={{ padding: '16px' }}>{record.women_count}</td>
                      <td style={{ padding: '16px' }}>{record.children_count}</td>
                      <td style={{ padding: '16px', fontWeight: 'bold', color: '#6366f1' }}>{record.total_count}</td>
                      <td style={{ padding: '16px', color: '#ec4899' }}>{record.first_timers_count}</td>
                      <td style={{ padding: '16px', color: '#10b981', fontWeight: '500' }}>XAF {(record.total_offering || 0).toLocaleString()}</td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button onClick={() => openModal(record)} style={{ padding: '6px 12px', border: 'none', background: '#f3f4f6', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️ Edit</button>
                          <button onClick={() => setDeleteConfirm(record)} style={{ padding: '6px 12px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}>🗑️ Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Record Attendance Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingRecord ? `✏️ Edit Attendance` : `➕ ${t('recordAttendance')}`} width="600px">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput 
            label="Service" 
            type="select" 
            value={form.service_id} 
            onChange={(e) => setForm({ ...form, service_id: e.target.value })}
            options={services.map(s => ({ value: s.id, label: s.name }))} 
          />
          <FormInput 
            label="Location" 
            type="select" 
            value={form.location_id} 
            onChange={(e) => setForm({ ...form, location_id: e.target.value })}
            options={locations.map(l => ({ value: l.id, label: l.name }))} 
          />
        </div>
        <FormInput label={t('date')} type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} required />
        
        <div style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>👥 Attendance Count</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <FormInput label={t('men')} type="number" value={form.men_count} onChange={(e) => setForm({ ...form, men_count: e.target.value })} />
            <FormInput label={t('women')} type="number" value={form.women_count} onChange={(e) => setForm({ ...form, women_count: e.target.value })} />
            <FormInput label={t('children')} type="number" value={form.children_count} onChange={(e) => setForm({ ...form, children_count: e.target.value })} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={t('firstTimers')} type="number" value={form.first_timers_count} onChange={(e) => setForm({ ...form, first_timers_count: e.target.value })} />
          <FormInput label={`${t('offering')} (XAF)`} type="number" value={form.total_offering} onChange={(e) => setForm({ ...form, total_offering: e.target.value })} />
        </div>
        
        <FormInput 
          label={t('weather')} 
          type="select" 
          value={form.weather} 
          onChange={(e) => setForm({ ...form, weather: e.target.value })}
          options={[{ value: 'SUNNY', label: `☀️ ${t('sunny')}` }, { value: 'CLOUDY', label: `☁️ ${t('cloudy')}` }, { value: 'RAINY', label: `🌧️ ${t('rainy')}` }]} 
        />
        
        <FormInput label="Notes" type="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any notes about this service..." />
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>{t('cancel')}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? '⏳' : `💾 ${t('save')}`}</Button>
        </div>
      </Modal>

      <ConfirmDialog 
        isOpen={!!deleteConfirm} 
        onClose={() => setDeleteConfirm(null)} 
        onConfirm={handleDelete} 
        title={`🗑️ ${t('delete')}`} 
        message="Are you sure you want to delete this attendance record?" 
      />
    </div>
  );
}
// ==========================================
// GIVING PAGE - With Charts
// ==========================================

export default AttendancePage;
