"use client";
// CalendarPage — Modern Hybrid Calendar Dashboard
// Redesigned with Month (grid + detail panel), Week (time blocks), and Agenda (timeline) views
// Color-coded event types, multiple events per day
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity, safeGetSession } from '../../lib/cs-shared';
import Papa from 'papaparse';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits } from '../../lib/featureGating';
import { Modal, FormInput, Button, PageHeader, LoadingSpinner, ConfirmDialog, StatCard, StatusBadge } from '../cs-ui';
import UpgradePrompt from '../UpgradePrompt';

// ── Event Type Color System ──────────────────────────────
const EVENT_COLORS = {
  SERVICE:    { solid: '#6366f1', light: '#eef2ff', text: '#4338ca', icon: '⛪', label: 'Service' },
  CONFERENCE: { solid: '#ec4899', light: '#fdf2f8', text: '#be185d', icon: '🎤', label: 'Conference' },
  PRAYER:     { solid: '#8b5cf6', light: '#f5f3ff', text: '#6d28d9', icon: '🙏', label: 'Prayer' },
  MEETING:    { solid: '#3b82f6', light: '#eff6ff', text: '#1d4ed8', icon: '👥', label: 'Meeting' },
  OUTREACH:   { solid: '#10b981', light: '#ecfdf5', text: '#047857', icon: '🌍', label: 'Outreach' },
  YOUTH:      { solid: '#f59e0b', light: '#fffbeb', text: '#b45309', icon: '🎉', label: 'Youth' },
  WORKSHOP:   { solid: '#ef4444', light: '#fef2f2', text: '#b91c1c', icon: '📚', label: 'Workshop' },
  GENERAL:    { solid: '#6b7280', light: '#f9fafb', text: '#374151', icon: '📅', label: 'General' },
};
const getColor = (type) => EVENT_COLORS[type] || EVENT_COLORS.GENERAL;

function CalendarPage() {
  const { t, language } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [services, setServices] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // month | week | agenda
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // Bulk upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadPreview, setUploadPreview] = useState([]);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [eventForm, setEventForm] = useState({
    title: '', description: '', event_date: '', start_time: '09:00',
    end_time: '12:00', location_id: '', event_type: 'GENERAL',
    is_recurring: false, recurrence_pattern: ''
  });

  useEffect(() => { fetchCalendarData(); }, []);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const [eventsData, servicesData, locationsData, attendanceData] = await Promise.all([
        supabaseQuery('events', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'event_date.asc' }),
        supabaseQuery('services', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('attendance_records', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'service_date.desc' })
      ]);
      setEvents(eventsData || []);
      setServices(servicesData || []);
      setLocations(locationsData || []);
      setAttendance(attendanceData || []);
    } catch (error) {
      console.error('Calendar fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Navigation ─────────────────────────────────────────
  const goToToday = () => { setCurrentDate(new Date()); setSelectedDay(new Date()); };
  const navigate = (dir) => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
    else if (viewMode === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  // ── Calendar helpers ───────────────────────────────────
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = language === 'fr'
    ? ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
    : ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayNames = language === 'fr'
    ? ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
    : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const dayNamesFull = language === 'fr'
    ? ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
    : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Build month grid
  const calendarDays = useMemo(() => {
    const days = [];
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, month: month - 1, year, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, month, year, isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, month: month + 1, year, isCurrentMonth: false });
    }
    return days;
  }, [year, month, daysInMonth, firstDayOfMonth]);

  // Week view days
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  // Date string helper
  const getDateStr = (y, m, d) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  // Get recurring service entries for a given date
  const getServicesForDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'][date.getDay()];
    return (services || []).filter(s => s.is_active && s.day_of_week === dayOfWeek).map(s => ({
      ...s, title: s.name, event_type: 'SERVICE', event_date: dateStr, _isService: true
    }));
  };

  // Get events for a specific date with filters
  const getEventsForDate = useCallback((dateStr) => {
    const eventItems = (events || []).filter(e => e.event_date === dateStr);
    const serviceItems = getServicesForDate(dateStr);
    let all = [...serviceItems, ...eventItems];
    if (filterLocation !== 'all') all = all.filter(e => e.location_id === filterLocation);
    if (filterType !== 'all') all = all.filter(e => e.event_type === filterType);
    // Sort by start_time
    all.sort((a, b) => (a.start_time || '00:00').localeCompare(b.start_time || '00:00'));
    return all;
  }, [events, services, filterLocation, filterType]);

  const getAttendanceForDate = (dateStr) => (attendance || []).filter(a => a.service_date === dateStr);
  const getLocationName = (locId) => locations.find(l => l.id === locId)?.name || '';

  // ── Event CRUD ─────────────────────────────────────────
  const openNewEvent = (dateStr) => {
    setEditingEvent(null);
    setEventForm({
      title: '', description: '', event_date: dateStr || '', start_time: '09:00',
      end_time: '12:00', location_id: locations[0]?.id || '', event_type: 'GENERAL',
      is_recurring: false, recurrence_pattern: ''
    });
    setShowEventModal(true);
  };

  const openEditEvent = (event) => {
    if (event._isService) return;
    setEditingEvent(event);
    setEventForm({
      title: event.title || '', description: event.description || '',
      event_date: event.event_date || '', start_time: event.start_time || '09:00',
      end_time: event.end_time || '12:00', location_id: event.location_id || '',
      event_type: event.event_type || 'GENERAL', is_recurring: event.is_recurring || false,
      recurrence_pattern: event.recurrence_pattern || ''
    });
    setShowEventModal(true);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.title || !eventForm.event_date) {
      toast.warning(language === 'fr' ? 'Le titre et la date sont requis' : 'Event title and date are required');
      return;
    }
    setSaving(true);
    try {
      const cleanedForm = { ...eventForm, location_id: eventForm.location_id || null, start_time: eventForm.start_time || null, end_time: eventForm.end_time || null };
      if (editingEvent) {
        await supabaseUpdate('events', editingEvent.id, cleanedForm);
        logActivity({ action: 'event_updated', entity_type: 'event', entity_id: editingEvent.id, entity_name: cleanedForm.title || null, details: null });
        toast.success(t('savedSuccessfully'));
      } else {
        const result = await supabaseInsert('events', cleanedForm);
        const realRow = Array.isArray(result) ? result[0] : result;
        logActivity({ action: 'event_created', entity_type: 'event', entity_id: realRow?.id || null, entity_name: cleanedForm.title || null, details: null });
        toast.success(t('savedSuccessfully'));
      }
      setShowEventModal(false);
      fetchCalendarData();
    } catch (error) { toast.error(error.message); }
    setSaving(false);
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      const target = (events || []).find(e => e.id === eventId);
      await supabaseDelete('events', eventId);
      logActivity({ action: 'event_deleted', entity_type: 'event', entity_id: eventId, entity_name: target?.title || null, details: null });
      toast.success(t('deletedSuccessfully'));
      fetchCalendarData();
    } catch (error) { toast.error(error.message); }
  };

  // ── Bulk Upload ────────────────────────────────────────
  const VALID_EVENT_TYPES = ['SERVICE','CONFERENCE','PRAYER','MEETING','OUTREACH','YOUTH','GENERAL','WORKSHOP'];

  const downloadCSVTemplate = () => {
    const header = 'title,event_date,start_time,end_time,event_type,description,location\n';
    const examples = [
      'Sunday Worship,2026-01-04,09:00,12:00,SERVICE,Regular Sunday service,Main Campus',
      'Youth Conference,2026-02-14,08:00,17:00,CONFERENCE,Annual youth gathering,',
      'Prayer Night,2026-01-09,18:00,20:00,PRAYER,Friday prayer meeting,',
      'Leaders Meeting,2026-01-20,14:00,16:00,MEETING,Monthly leaders sync,',
      'Community Outreach,2026-03-15,07:00,13:00,OUTREACH,Neighborhood evangelism,'
    ].join('\n');
    const blob = new Blob([header + examples], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'churchsmart-program-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (results) => {
        const errors = [];
        const rows = [];
        (results.data || []).forEach((row, idx) => {
          const lineNum = idx + 2;
          const title = (row.title || '').trim();
          const eventDate = (row.event_date || row.date || '').trim();
          const startTime = (row.start_time || '').trim();
          const endTime = (row.end_time || '').trim();
          const eventType = (row.event_type || row.type || 'GENERAL').trim().toUpperCase();
          const description = (row.description || '').trim();
          const locationName = (row.location || '').trim();
          if (!title) { errors.push(`Row ${lineNum}: Missing title`); return; }
          if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) { errors.push(`Row ${lineNum}: Invalid date "${eventDate}" — use YYYY-MM-DD`); return; }
          if (isNaN(new Date(eventDate).getTime())) { errors.push(`Row ${lineNum}: Invalid date "${eventDate}"`); return; }
          if (!VALID_EVENT_TYPES.includes(eventType)) { errors.push(`Row ${lineNum}: Unknown type "${eventType}" — use ${VALID_EVENT_TYPES.join(', ')}`); return; }
          let locationId = null;
          if (locationName) {
            const match = locations.find(l => l.name.toLowerCase() === locationName.toLowerCase());
            if (match) locationId = match.id;
          }
          rows.push({ title, event_date: eventDate, start_time: startTime || null, end_time: endTime || null, event_type: eventType, description: description || null, location_id: locationId, _locationName: locationName || null, _line: lineNum });
        });
        setUploadErrors(errors);
        setUploadPreview(rows);
        setShowUploadModal(true);
      },
      error: (err) => toast.error('CSV parse error: ' + (err.message || 'Unknown error'))
    });
  };

  const handleBulkInsert = async () => {
    if (uploadPreview.length === 0) return;
    setUploading(true);
    try {
      let inserted = 0;
      for (let i = 0; i < uploadPreview.length; i += 50) {
        const batch = uploadPreview.slice(i, i + 50).map(row => ({
          church_id: CHURCH_ID, title: row.title, event_date: row.event_date,
          start_time: row.start_time, end_time: row.end_time, event_type: row.event_type,
          description: row.description, location_id: row.location_id, created_by: user?.email || null
        }));
        await supabaseInsert('events', batch);
        inserted += batch.length;
      }
      logActivity({ action: 'events_bulk_uploaded', entity_type: 'event', entity_id: null, entity_name: `${inserted} events uploaded`, details: null });
      toast.success(language === 'fr' ? `${inserted} événements importés !` : `${inserted} events imported!`);
      setShowUploadModal(false);
      setUploadPreview([]);
      setUploadErrors([]);
      fetchCalendarData();
    } catch (err) { toast.error(err.message || 'Bulk insert failed'); }
    finally { setUploading(false); }
  };

  // ── Computed data ──────────────────────────────────────
  const selectedDateStr = selectedDay ? selectedDay.toISOString().split('T')[0] : todayStr;
  const selectedEvents = getEventsForDate(selectedDateStr);
  const selectedAttendance = getAttendanceForDate(selectedDateStr);
  const thisMonthEvents = events.filter(e => { const d = new Date(e.event_date); return d.getMonth() === month && d.getFullYear() === year; });
  const upcomingCount = events.filter(e => new Date(e.event_date) >= today).length;

  // Agenda: get events for the visible month grouped by date
  const agendaEvents = useMemo(() => {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const days = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dStr = d.toISOString().split('T')[0];
      const dayEv = getEventsForDate(dStr);
      if (dayEv.length > 0) days.push({ date: dStr, dayObj: new Date(d), events: dayEv });
    }
    return days;
  }, [year, month, events, services, filterLocation, filterType]);

  // Format time for display
  const fmtTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    if (language === 'fr') return `${String(h).padStart(2,'0')}h${String(m).padStart(2,'0')}`;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
  };

  if (loading) return React.createElement(LoadingSpinner);

  // ══════════════════════════════════════════════════════
  //  SHARED STYLES
  // ══════════════════════════════════════════════════════
  const S = {
    card: { backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' },
    viewBtn: (active) => ({
      padding: '7px 18px', border: 'none', borderRadius: '10px', cursor: 'pointer',
      fontSize: '13px', fontWeight: active ? '600' : '400', fontFamily: 'inherit',
      backgroundColor: active ? '#6366f1' : 'transparent',
      color: active ? 'white' : '#6b7280',
      transition: 'all 0.2s',
    }),
    navBtn: { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: 'white', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s', fontFamily: 'inherit' },
    dayHeader: { padding: '12px 4px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' },
  };

  // ══════════════════════════════════════════════════════
  //  EVENT DOT — small color indicator on month grid
  // ══════════════════════════════════════════════════════
  const EventDot = ({ type }) => {
    const c = getColor(type);
    return React.createElement('span', { style: { width: '7px', height: '7px', borderRadius: '50%', backgroundColor: c.solid, display: 'inline-block', flexShrink: 0 } });
  };

  // ══════════════════════════════════════════════════════
  //  EVENT PILL — compact event in grid
  // ══════════════════════════════════════════════════════
  const EventPill = ({ ev, compact }) => {
    const c = getColor(ev.event_type);
    return (
      <div
        onClick={(e) => { e.stopPropagation(); openEditEvent(ev); }}
        style={{
          padding: compact ? '1px 6px' : '2px 8px',
          borderRadius: '6px', fontSize: compact ? '10px' : '11px', fontWeight: '500',
          backgroundColor: c.light, color: c.text,
          borderLeft: `3px solid ${c.solid}`,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          cursor: ev._isService ? 'default' : 'pointer',
          transition: 'transform 0.1s',
          lineHeight: '1.4',
        }}
        title={`${ev.title}${ev.start_time ? ` · ${fmtTime(ev.start_time)}` : ''}`}
      >
        {ev.title}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════
  //  EVENT DETAIL CARD — right panel / agenda item
  // ══════════════════════════════════════════════════════
  const EventDetailCard = ({ ev, showDate }) => {
    const c = getColor(ev.event_type);
    return (
      <div style={{
        padding: '14px 16px', borderRadius: '12px', backgroundColor: 'white',
        border: `1px solid #e5e7eb`, position: 'relative',
        borderLeft: `4px solid ${c.solid}`,
        transition: 'box-shadow 0.2s',
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px', backgroundColor: c.light,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0
          }}>{c.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>{ev.title}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
              {ev.start_time && (
                <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  🕐 {fmtTime(ev.start_time)}{ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}
                </span>
              )}
              {ev.location_id && (
                <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  📍 {getLocationName(ev.location_id)}
                </span>
              )}
            </div>
            {showDate && (
              <span style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px', display: 'block' }}>{ev.event_date}</span>
            )}
            {ev.description && (
              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#6b7280', lineHeight: '1.5' }}>{ev.description}</p>
            )}
            <span style={{
              display: 'inline-block', marginTop: '8px', padding: '2px 10px',
              backgroundColor: c.light, color: c.text, borderRadius: '20px',
              fontSize: '10px', fontWeight: '600', letterSpacing: '0.03em'
            }}>
              {ev._isService ? (language === 'fr' ? 'Service récurrent' : 'Recurring Service') : c.label}
            </span>
          </div>
        </div>
        {!ev._isService && (
          <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '4px' }}>
            <button onClick={() => openEditEvent(ev)} style={{
              padding: '4px 8px', border: '1px solid #e5e7eb', background: 'white',
              borderRadius: '6px', cursor: 'pointer', fontSize: '12px', transition: 'background 0.15s'
            }} title={language === 'fr' ? 'Modifier' : 'Edit'}>✏️</button>
            <button onClick={() => handleDeleteEvent(ev.id)} style={{
              padding: '4px 8px', border: '1px solid #fecaca', background: '#fef2f2',
              borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#dc2626', transition: 'background 0.15s'
            }} title={language === 'fr' ? 'Supprimer' : 'Delete'}>🗑️</button>
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════
  //  DETAIL PANEL — right side of month view
  // ══════════════════════════════════════════════════════
  const renderDetailPanel = () => {
    const selDate = selectedDay || today;
    const dayName = dayNamesFull[selDate.getDay()];
    const dayNum = selDate.getDate();
    const monthName = monthNames[selDate.getMonth()];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Day header */}
        <div style={{ ...S.card, padding: '24px' }}>
          <div style={{ marginBottom: '20px' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{dayName}</p>
            <p style={{ margin: '2px 0 0', fontSize: '28px', fontWeight: '700', color: '#1f2937', lineHeight: '1.1' }}>{dayNum}</p>
            <p style={{ margin: '2px 0 0', fontSize: '14px', color: '#6b7280' }}>{monthName} {selDate.getFullYear()}</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
              {selectedEvents.length} {selectedEvents.length === 1
                ? (language === 'fr' ? 'événement' : 'event')
                : (language === 'fr' ? 'événements' : 'events')}
            </span>
            <button onClick={() => openNewEvent(selectedDateStr)} style={{
              padding: '7px 16px', border: 'none', backgroundColor: '#6366f1', color: 'white',
              borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: '4px', transition: 'opacity 0.15s'
            }}>
              + {language === 'fr' ? 'Ajouter' : 'Add'}
            </button>
          </div>

          {selectedEvents.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '8px', opacity: 0.4 }}>📅</span>
              <p style={{ margin: 0, fontSize: '14px', color: '#9ca3af' }}>
                {language === 'fr' ? 'Aucun événement' : 'No events'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#d1d5db' }}>
                {language === 'fr' ? 'Cliquez + pour ajouter' : 'Click + to add one'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedEvents.map((ev, i) => <EventDetailCard key={i} ev={ev} />)}
            </div>
          )}
        </div>

        {/* Attendance section */}
        {selectedAttendance.length > 0 && (
          <div style={{ ...S.card, padding: '20px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>📊 {language === 'fr' ? 'Fréquentation' : 'Attendance'}</h4>
            {selectedAttendance.map((record, i) => {
              const serviceName = services.find(s => s.id === record.service_id)?.name || 'Service';
              return (
                <div key={i} style={{ padding: '12px', backgroundColor: '#fafbff', borderRadius: '10px', marginBottom: '8px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>⛪ {serviceName}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px', fontSize: '12px' }}>
                    <div><span style={{ color: '#6b7280' }}>{language === 'fr' ? 'Hommes' : 'Men'}:</span> <strong>{record.men_count || 0}</strong></div>
                    <div><span style={{ color: '#6b7280' }}>{language === 'fr' ? 'Femmes' : 'Women'}:</span> <strong>{record.women_count || 0}</strong></div>
                    <div><span style={{ color: '#6b7280' }}>{language === 'fr' ? 'Enfants' : 'Children'}:</span> <strong>{record.children_count || 0}</strong></div>
                  </div>
                  <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ fontWeight: '700', color: '#6366f1' }}>Total: {record.total_count || 0}</span>
                    {record.total_offering > 0 && <span style={{ color: '#10b981', fontWeight: '600' }}>XAF {(record.total_offering || 0).toLocaleString()}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div style={{ ...S.card, padding: '16px' }}>
          <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {language === 'fr' ? 'Légende' : 'Legend'}
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {Object.entries(EVENT_COLORS).map(([type, cfg]) => (
              <span key={type}
                onClick={() => setFilterType(filterType === type ? 'all' : type)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '4px 10px', fontSize: '11px', fontWeight: '500',
                  backgroundColor: filterType === type ? cfg.solid : cfg.light,
                  color: filterType === type ? 'white' : cfg.text,
                  borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
                  border: filterType === type ? `1px solid ${cfg.solid}` : '1px solid transparent',
                }}>
                {cfg.icon} {cfg.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════
  //  MONTH VIEW — grid with colored event pills
  // ══════════════════════════════════════════════════════
  const renderMonthView = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>
      <div style={S.card}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f3f4f6' }}>
          {dayNames.map(d => <div key={d} style={S.dayHeader}>{d}</div>)}
        </div>
        {/* Grid cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {calendarDays.map((cell, idx) => {
            const dateStr = getDateStr(cell.year, cell.month, cell.day);
            const dayEvents = getEventsForDate(dateStr);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDateStr;
            const hasAttendance = getAttendanceForDate(dateStr).length > 0;

            return (
              <div key={idx}
                onClick={() => setSelectedDay(new Date(cell.year, cell.month, cell.day))}
                style={{
                  minHeight: '88px', padding: '4px 5px',
                  borderRight: (idx + 1) % 7 !== 0 ? '1px solid #f3f4f6' : 'none',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? '#f0f0ff' : 'white',
                  transition: 'background-color 0.12s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: isToday ? '700' : '500',
                    color: !cell.isCurrentMonth ? '#d1d5db' : isToday ? 'white' : '#374151',
                    width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '8px',
                    backgroundColor: isToday ? '#6366f1' : 'transparent',
                  }}>{cell.day}</span>
                  <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                    {hasAttendance && <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10b981' }} />}
                    {dayEvents.length > 3 && (
                      <span style={{ fontSize: '9px', color: '#9ca3af', fontWeight: '600' }}>+{dayEvents.length - 3}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {dayEvents.slice(0, 3).map((ev, i) => <EventPill key={i} ev={ev} compact />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Detail Panel */}
      {renderDetailPanel()}
      {/* Mobile stack */}
      <style>{`@media(max-width:900px){div[style*="grid-template-columns: 1fr 320px"]{grid-template-columns:1fr !important;}}`}</style>
    </div>
  );

  // ══════════════════════════════════════════════════════
  //  WEEK VIEW — time-block columns
  // ══════════════════════════════════════════════════════
  const renderWeekView = () => {
    const hours = Array.from({ length: 15 }, (_, i) => i + 6); // 6 AM to 8 PM

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>
        <div style={{ ...S.card, overflowX: 'auto' }}>
          <div style={{ minWidth: '600px' }}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid #f0f0f5' }}>
              <div style={{ padding: '12px 4px' }}></div>
              {weekDays.map((date, idx) => {
                const dStr = date.toISOString().split('T')[0];
                const isToday = dStr === todayStr;
                const isSelected = dStr === selectedDateStr;
                return (
                  <div key={idx}
                    onClick={() => setSelectedDay(new Date(date))}
                    style={{
                      textAlign: 'center', padding: '12px 4px', cursor: 'pointer',
                      borderLeft: '1px solid #f3f4f6',
                      backgroundColor: isSelected ? '#f0f0ff' : 'transparent',
                      transition: 'background 0.12s',
                    }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.06em' }}>{dayNames[idx]}</div>
                    <div style={{
                      fontSize: '20px', fontWeight: isToday ? '700' : '500',
                      color: isToday ? 'white' : '#374151',
                      width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '12px', backgroundColor: isToday ? '#6366f1' : 'transparent',
                      margin: '4px auto 0',
                    }}>{date.getDate()}</div>
                  </div>
                );
              })}
            </div>
            {/* Time grid */}
            <div style={{ position: 'relative' }}>
              {hours.map((hour) => (
                <div key={hour} style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', minHeight: '52px', borderBottom: '1px solid #f0f0f5' }}>
                  <div style={{ padding: '4px 8px 0', textAlign: 'right', fontSize: '11px', color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtTime(`${String(hour).padStart(2,'0')}:00`)}
                  </div>
                  {weekDays.map((date, dayIdx) => {
                    const dStr = date.toISOString().split('T')[0];
                    const dayEvents = getEventsForDate(dStr);
                    // Find events that start in this hour
                    const hourEvents = dayEvents.filter(ev => {
                      if (!ev.start_time) return hour === 6; // events without time show at 6 AM
                      const h = parseInt(ev.start_time.split(':')[0], 10);
                      return h === hour;
                    });
                    return (
                      <div key={dayIdx} style={{ borderLeft: '1px solid #f3f4f6', padding: '2px', position: 'relative' }}>
                        {hourEvents.map((ev, i) => {
                          const c = getColor(ev.event_type);
                          // Calculate height based on duration
                          let heightBlocks = 1;
                          if (ev.start_time && ev.end_time) {
                            const [sh, sm] = ev.start_time.split(':').map(Number);
                            const [eh, em] = ev.end_time.split(':').map(Number);
                            heightBlocks = Math.max(1, Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60));
                          }
                          return (
                            <div key={i}
                              onClick={() => { setSelectedDay(new Date(date)); openEditEvent(ev); }}
                              style={{
                                backgroundColor: c.solid, color: 'white',
                                borderRadius: '6px', padding: '4px 6px',
                                fontSize: '10px', fontWeight: '500',
                                marginBottom: '2px', cursor: ev._isService ? 'default' : 'pointer',
                                minHeight: `${heightBlocks * 48 - 4}px`,
                                overflow: 'hidden', lineHeight: '1.3',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                              }}
                              title={ev.title}>
                              <div style={{ fontWeight: '600' }}>{ev.title}</div>
                              {ev.start_time && (
                                <div style={{ fontSize: '9px', opacity: 0.85, marginTop: '1px' }}>
                                  {fmtTime(ev.start_time)}{ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        {renderDetailPanel()}
        <style>{`@media(max-width:900px){div[style*="grid-template-columns: 1fr 320px"]{grid-template-columns:1fr !important;}}`}</style>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════
  //  AGENDA VIEW — scrollable timeline
  // ══════════════════════════════════════════════════════
  const renderAgendaView = () => {
    // Filter to upcoming events from today forward
    const futureAgenda = agendaEvents.filter(d => d.date >= todayStr);
    const pastAgenda = agendaEvents.filter(d => d.date < todayStr);

    return (
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Upcoming */}
        <div style={{ ...S.card, padding: '24px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: '700', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' }}></span>
            {language === 'fr' ? 'À venir' : 'Upcoming'} — {monthNames[month]}
          </h3>

          {futureAgenda.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '8px', opacity: 0.4 }}>📅</span>
              <p style={{ margin: 0, fontSize: '14px' }}>
                {language === 'fr' ? 'Aucun événement à venir ce mois-ci' : 'No upcoming events this month'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {futureAgenda.map((day) => {
                const d = day.dayObj;
                const isToday = day.date === todayStr;
                return (
                  <div key={day.date}>
                    {/* Date label */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px',
                      position: 'sticky', top: 0, backgroundColor: 'white', paddingTop: '4px', paddingBottom: '4px', zIndex: 1,
                    }}>
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '12px',
                        backgroundColor: isToday ? '#6366f1' : '#f3f4f6',
                        color: isToday ? 'white' : '#374151',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <span style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', lineHeight: 1, opacity: isToday ? 0.9 : 0.6 }}>
                          {dayNames[d.getDay()]}
                        </span>
                        <span style={{ fontSize: '18px', fontWeight: '700', lineHeight: 1.1 }}>{d.getDate()}</span>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                          {dayNamesFull[d.getDay()]}, {monthNames[d.getMonth()]} {d.getDate()}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9ca3af' }}>
                          {day.events.length} {day.events.length === 1 ? (language === 'fr' ? 'événement' : 'event') : (language === 'fr' ? 'événements' : 'events')}
                        </p>
                      </div>
                      {isToday && (
                        <span style={{ fontSize: '10px', fontWeight: '600', backgroundColor: '#ecfdf5', color: '#059669', padding: '3px 10px', borderRadius: '20px', letterSpacing: '0.04em' }}>
                          {language === 'fr' ? "AUJOURD'HUI" : 'TODAY'}
                        </span>
                      )}
                    </div>
                    {/* Events for this day */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '60px' }}>
                      {day.events.map((ev, i) => <EventDetailCard key={i} ev={ev} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Past events this month */}
        {pastAgenda.length > 0 && (
          <div style={{ ...S.card, padding: '24px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: '600', color: '#9ca3af' }}>
              {language === 'fr' ? 'Événements passés' : 'Past Events'} ({pastAgenda.reduce((sum, d) => sum + d.events.length, 0)})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.6 }}>
              {pastAgenda.slice(-5).map((day) => (
                day.events.map((ev, i) => (
                  <div key={`${day.date}-${i}`} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '8px', backgroundColor: '#f9fafb',
                    fontSize: '13px',
                  }}>
                    <span style={{ color: '#9ca3af', fontSize: '12px', minWidth: '70px' }}>{day.date.slice(5)}</span>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getColor(ev.event_type).solid, flexShrink: 0 }}></span>
                    <span style={{ flex: 1, color: '#6b7280' }}>{ev.title}</span>
                    {ev.start_time && <span style={{ fontSize: '11px', color: '#9ca3af' }}>{fmtTime(ev.start_time)}</span>}
                  </div>
                ))
              ))}
            </div>
          </div>
        )}

        {/* Legend for filtering on agenda view */}
        <div style={{ ...S.card, padding: '16px', marginTop: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {Object.entries(EVENT_COLORS).map(([type, cfg]) => (
              <span key={type}
                onClick={() => setFilterType(filterType === type ? 'all' : type)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '4px 10px', fontSize: '11px', fontWeight: '500',
                  backgroundColor: filterType === type ? cfg.solid : cfg.light,
                  color: filterType === type ? 'white' : cfg.text,
                  borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {cfg.icon} {cfg.label}
              </span>
            ))}
            {filterType !== 'all' && (
              <span onClick={() => setFilterType('all')} style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '4px 10px', fontSize: '11px', fontWeight: '500',
                backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '8px', cursor: 'pointer',
              }}>✕ {language === 'fr' ? 'Tout afficher' : 'Clear filter'}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════
  //  MAIN RENDER
  // ══════════════════════════════════════════════════════
  return (
    <div>
      <PageHeader
        title={`🗓️ ${t('calendar')}`}
        subtitle={`${monthNames[month]} ${year} · ${thisMonthEvents.length} ${language === 'fr' ? 'événements' : 'events'}`}
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {locations.length > 1 && (
              <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={{
                padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '10px',
                fontSize: '13px', backgroundColor: 'white', fontFamily: 'inherit', cursor: 'pointer',
              }}>
                <option value="all">{language === 'fr' ? 'Tous les lieux' : 'All Locations'}</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
              📤 {language === 'fr' ? 'Importer' : 'Upload'}
            </Button>
            <Button onClick={() => openNewEvent(selectedDateStr)}>
              + {language === 'fr' ? 'Événement' : 'Event'}
            </Button>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} style={{ display: 'none' }} />
          </div>
        }
      />

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard label={language === 'fr' ? 'Ce mois' : 'This Month'} value={thisMonthEvents.length} icon="📅" />
        <StatCard label={language === 'fr' ? 'À venir' : 'Upcoming'} value={upcomingCount} icon="🔜" color="#10b981" />
        <StatCard label="Services" value={services.filter(s => s.is_active).length} icon="⛪" color="#6366f1" />
        <StatCard label={language === 'fr' ? 'Lieux' : 'Locations'} value={locations.length} icon="📍" color="#f59e0b" />
      </div>

      {/* Navigation & View Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate(-1)} style={S.navBtn}>◀</button>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1f2937', minWidth: '200px', textAlign: 'center' }}>
            {monthNames[month]} {year}
          </h2>
          <button onClick={() => navigate(1)} style={S.navBtn}>▶</button>
          <button onClick={goToToday} style={{
            padding: '7px 16px', border: '1px solid #e5e7eb', borderRadius: '10px',
            backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '500',
            color: '#6366f1', fontFamily: 'inherit', transition: 'border-color 0.15s',
          }}>{language === 'fr' ? "Aujourd'hui" : 'Today'}</button>
        </div>

        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f3f4f6', borderRadius: '12px', padding: '4px' }}>
          {[
            { key: 'month', label: language === 'fr' ? 'Mois' : 'Month' },
            { key: 'week',  label: language === 'fr' ? 'Semaine' : 'Week' },
            { key: 'agenda', label: 'Agenda' },
          ].map(v => (
            <button key={v.key} onClick={() => setViewMode(v.key)} style={S.viewBtn(viewMode === v.key)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Views */}
      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'week' && renderWeekView()}
      {viewMode === 'agenda' && renderAgendaView()}

      {/* Add/Edit Event Modal */}
      <Modal isOpen={showEventModal} onClose={() => setShowEventModal(false)}
        title={editingEvent ? (language === 'fr' ? '✏️ Modifier' : '✏️ Edit Event') : (language === 'fr' ? '➕ Nouvel Événement' : '➕ New Event')} width="550px">
        <FormInput label={`${language === 'fr' ? 'Titre' : 'Event Title'} *`}
          value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
          required placeholder={language === 'fr' ? 'ex: Conférence Jeunesse 2026' : 'e.g., Youth Conference 2026'} />
        <FormInput label="Description" type="textarea" value={eventForm.description}
          onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
          placeholder={language === 'fr' ? 'Description de l\'événement...' : 'Event description...'} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Date *" type="date" value={eventForm.event_date}
            onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })} required />
          <FormInput label="Type" type="select" value={eventForm.event_type}
            onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
            options={Object.entries(EVENT_COLORS).filter(([k]) => k !== 'SERVICE').map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label={language === 'fr' ? 'Heure de début' : 'Start Time'} type="time"
            value={eventForm.start_time} onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })} />
          <FormInput label={language === 'fr' ? 'Heure de fin' : 'End Time'} type="time"
            value={eventForm.end_time} onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })} />
        </div>
        <FormInput label={`📍 ${language === 'fr' ? 'Lieu' : 'Location'}`} type="select"
          value={eventForm.location_id} onChange={(e) => setEventForm({ ...eventForm, location_id: e.target.value })}
          options={[{ value: '', label: language === 'fr' ? 'Sélectionner...' : 'Select location...' },
            ...locations.map(l => ({ value: l.id, label: `${l.is_main_campus ? '🏛️' : '🏢'} ${l.name}` }))]} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
          <Button variant="secondary" onClick={() => setShowEventModal(false)}>{t('cancel')}</Button>
          <Button onClick={handleSaveEvent} disabled={saving}>
            {saving ? '⏳...' : `💾 ${language === 'fr' ? 'Enregistrer' : 'Save Event'}`}
          </Button>
        </div>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => { setShowUploadModal(false); setUploadPreview([]); setUploadErrors([]); }}
        title={`📤 ${language === 'fr' ? 'Importer le Programme' : 'Import Church Program'}`} width="750px">
        {uploadErrors.length > 0 && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
            <p style={{ margin: '0 0 8px', fontWeight: '600', color: '#dc2626', fontSize: '14px' }}>⚠️ {uploadErrors.length} {language === 'fr' ? 'erreurs' : 'errors'}:</p>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#991b1b', maxHeight: '120px', overflowY: 'auto' }}>
              {uploadErrors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}
        {uploadPreview.length > 0 ? (
          <>
            <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#374151' }}>
                <strong>{uploadPreview.length}</strong> {language === 'fr' ? 'événements prêts' : 'events ready'}
              </p>
              <button onClick={downloadCSVTemplate} style={{ padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '12px', color: '#6b7280', fontFamily: 'inherit' }}>
                📥 {language === 'fr' ? 'Modèle' : 'Template'}
              </button>
            </div>
            <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #f0f0f5', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ backgroundColor: '#fafbff', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.06em' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.06em' }}>{language === 'fr' ? 'Titre' : 'Title'}</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.06em' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.06em' }}>{language === 'fr' ? 'Heure' : 'Time'}</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.06em' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.06em' }}>{language === 'fr' ? 'Lieu' : 'Location'}</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadPreview.map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f0f0f5', transition: 'background-color 0.15s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafbff'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '8px 12px', color: '#9ca3af' }}>{i + 1}</td>
                      <td style={{ padding: '8px 12px', fontWeight: '500' }}>{row.title}</td>
                      <td style={{ padding: '8px 12px' }}>{row.event_date}</td>
                      <td style={{ padding: '8px 12px' }}>{row.start_time ? `${row.start_time}${row.end_time ? ' – ' + row.end_time : ''}` : '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ padding: '2px 8px', backgroundColor: getColor(row.event_type).light, color: getColor(row.event_type).text, borderRadius: '6px', fontSize: '11px', fontWeight: '500' }}>
                          {getColor(row.event_type).icon} {row.event_type}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: row.location_id ? '#374151' : '#9ca3af' }}>
                        {row.location_id ? locations.find(l => l.id === row.location_id)?.name : (row._locationName || '—')}
                        {row._locationName && !row.location_id && <span style={{ fontSize: '11px', color: '#f59e0b' }}> ⚠️</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
            <p style={{ margin: '0 0 16px', fontSize: '14px' }}>
              {language === 'fr' ? 'Aucun événement valide trouvé.' : 'No valid events found.'}
            </p>
            <button onClick={downloadCSVTemplate} style={{ padding: '10px 20px', border: '1px solid #e5e7eb', borderRadius: '10px', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', color: '#4338ca', fontWeight: '500', fontFamily: 'inherit' }}>
              📥 {language === 'fr' ? 'Télécharger le modèle' : 'Download Template'}
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="secondary" onClick={() => { setShowUploadModal(false); setUploadPreview([]); setUploadErrors([]); }}>
            {language === 'fr' ? 'Annuler' : 'Cancel'}
          </Button>
          {uploadPreview.length > 0 && (
            <Button onClick={handleBulkInsert} disabled={uploading}>
              {uploading
                ? `⏳ ${language === 'fr' ? 'Importation...' : 'Importing...'}`
                : `📤 ${language === 'fr' ? `Importer ${uploadPreview.length}` : `Import ${uploadPreview.length} Events`}`}
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default CalendarPage;
