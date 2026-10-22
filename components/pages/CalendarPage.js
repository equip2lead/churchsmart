"use client";
// CalendarPage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits } from '../../lib/featureGating';
import { Modal, FormInput, Button, PageHeader, LoadingSpinner, ConfirmDialog, StatCard, StatusBadge } from '../cs-ui';
import UpgradePrompt from '../UpgradePrompt';

function CalendarPage() {
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [services, setServices] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // month | week
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterLocation, setFilterLocation] = useState('all');

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

  // Navigation
  const goToToday = () => { setCurrentDate(new Date()); setSelectedDay(new Date()); };
  const navigate = (dir) => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setCurrentDate(d);
  };

  // Calendar helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Build calendar grid
  const calendarDays = [];
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    calendarDays.push({ day: prevMonthDays - i, month: month - 1, year, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ day: d, month, year, isCurrentMonth: true });
  }
  const remaining = 42 - calendarDays.length;
  for (let d = 1; d <= remaining; d++) {
    calendarDays.push({ day: d, month: month + 1, year, isCurrentMonth: false });
  }

  // Week view days
  const getWeekDays = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  // Map events to dates
  const getDateStr = (y, m, d) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  // Get recurring service entries for a given date
  const getServicesForDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][date.getDay()];
    return (services || []).filter(s => s.is_active && s.day_of_week === dayOfWeek).map(s => ({
      ...s, title: s.name, event_type: 'SERVICE', event_date: dateStr,
      _isService: true
    }));
  };

  // Get events for a specific date
  const getEventsForDate = (dateStr) => {
    const eventItems = (events || []).filter(e => e.event_date === dateStr);
    const serviceItems = getServicesForDate(dateStr);
    let all = [...serviceItems, ...eventItems];
    if (filterLocation !== 'all') all = all.filter(e => e.location_id === filterLocation);
    return all;
  };

  // Get attendance record for a date
  const getAttendanceForDate = (dateStr) => {
    return (attendance || []).filter(a => a.service_date === dateStr);
  };

  const getLocationName = (locId) => {
    const loc = locations.find(l => l.id === locId);
    return loc?.name || '';
  };

  // Event type styling
  const eventTypeConfig = {
    'SERVICE': { icon: '⛪', color: '#6366f1', bg: '#eef2ff' },
    'CONFERENCE': { icon: '🎤', color: '#f59e0b', bg: '#fef3c7' },
    'PRAYER': { icon: '🙏', color: '#ec4899', bg: '#fce7f3' },
    'MEETING': { icon: '👥', color: '#10b981', bg: '#d1fae5' },
    'OUTREACH': { icon: '🌍', color: '#3b82f6', bg: '#dbeafe' },
    'YOUTH': { icon: '🎉', color: '#8b5cf6', bg: '#ede9fe' },
    'GENERAL': { icon: '📅', color: '#6b7280', bg: '#f3f4f6' },
    'WORKSHOP': { icon: '📚', color: '#14b8a6', bg: '#ccfbf1' }
  };

  const getEventStyle = (type) => eventTypeConfig[type] || eventTypeConfig['GENERAL'];

  // Quick add event
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
    if (event._isService) return; // Don't edit services from calendar
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
    if (!eventForm.title || !eventForm.event_date) { toast.warning('Event title and date are required'); return; }
    setSaving(true);
    try {
      const cleanedForm = { ...eventForm, location_id: eventForm.location_id || null, start_time: eventForm.start_time || null, end_time: eventForm.end_time || null };
      if (editingEvent) {
        await supabaseUpdate('events', editingEvent.id, cleanedForm);
        logActivity({
          action: 'event_updated',
          entity_type: 'event',
          entity_id: editingEvent.id,
          entity_name: cleanedForm.title || null,
          details: null
        });
        toast.success(t('savedSuccessfully'));
      } else {
        const result = await supabaseInsert('events', cleanedForm);
        const realRow = Array.isArray(result) ? result[0] : result;
        logActivity({
          action: 'event_created',
          entity_type: 'event',
          entity_id: realRow?.id || null,
          entity_name: cleanedForm.title || null,
          details: null
        });
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
      logActivity({
        action: 'event_deleted',
        entity_type: 'event',
        entity_id: eventId,
        entity_name: target?.title || null,
        details: null
      });
      toast.success(t('deletedSuccessfully'));
      setSelectedDay(selectedDay); // refresh
      fetchCalendarData();
    } catch (error) { toast.error(error.message); }
  };

  // Selected day info
  const selectedDateStr = selectedDay ? selectedDay.toISOString().split('T')[0] : todayStr;
  const selectedEvents = getEventsForDate(selectedDateStr);
  const selectedAttendance = getAttendanceForDate(selectedDateStr);

  // Stats
  const thisMonthEvents = events.filter(e => {
    const d = new Date(e.event_date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const upcomingCount = events.filter(e => new Date(e.event_date) >= today).length;

  if (loading) return React.createElement(LoadingSpinner);

  return (
    <div>
      <PageHeader
        title={`🗓️ ${t('calendar')}`}
        subtitle={`${monthNames[month]} ${year} • ${thisMonthEvents.length} events this month`}
        actions={
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {locations.length > 1 && (
              <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', backgroundColor: 'white' }}>
                <option value="all">All Locations</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
            <Button variant="secondary" onClick={goToToday}>{t('today')}</Button>
            <Button onClick={() => openNewEvent(selectedDateStr)}>➕ Add Event</Button>
          </div>
        }
      />

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <StatCard label="This Month" value={thisMonthEvents.length} icon="📅" />
        <StatCard label="Upcoming" value={upcomingCount} icon="🔜" color="#10b981" />
        <StatCard label="Services" value={services.filter(s => s.is_active).length} icon="⛪" color="#6366f1" />
        <StatCard label="Locations" value={locations.length} icon="📍" color="#f59e0b" />
      </div>

      {/* View Toggle & Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => navigate(-1)} style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '16px' }}>◀</button>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1f2937', minWidth: '200px', textAlign: 'center' }}>
            {monthNames[month]} {year}
          </h2>
          <button onClick={() => navigate(1)} style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', fontSize: '16px' }}>▶</button>
        </div>
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f3f4f6', borderRadius: '10px', padding: '4px' }}>
          {['month', 'week'].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              style={{ padding: '6px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: viewMode === mode ? '600' : '400', backgroundColor: viewMode === mode ? 'white' : 'transparent', color: viewMode === mode ? '#6366f1' : '#6b7280', boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {mode === 'month' ? t('month') : t('week')}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
        {/* Calendar Grid */}
        <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {/* Day Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e5e7eb' }}>
            {dayNames.map(d => (
              <div key={d} style={{ padding: '12px 8px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
            ))}
          </div>

          {viewMode === 'month' ? (
            /* Month View */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {calendarDays.map((cell, idx) => {
                const dateStr = getDateStr(cell.year, cell.month, cell.day);
                const dayEvents = getEventsForDate(dateStr);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDateStr;
                const hasAttendance = getAttendanceForDate(dateStr).length > 0;

                return (
                  <div key={idx} onClick={() => { setSelectedDay(new Date(cell.year, cell.month, cell.day)); }}
                    style={{ minHeight: '90px', padding: '6px', borderRight: (idx + 1) % 7 !== 0 ? '1px solid #f3f4f6' : 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', backgroundColor: isSelected ? '#f0f0ff' : isToday ? '#fffbeb' : 'white', transition: 'background-color 0.15s', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: isToday ? '700' : '500', color: !cell.isCurrentMonth ? '#d1d5db' : isToday ? '#f59e0b' : '#374151', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backgroundColor: isToday ? '#fef3c7' : 'transparent' }}>
                        {cell.day}
                      </span>
                      {hasAttendance && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} title="Attendance recorded" />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {dayEvents.slice(0, 3).map((ev, i) => {
                        const style = getEventStyle(ev.event_type);
                        return (
                          <div key={i} onClick={(e) => { e.stopPropagation(); openEditEvent(ev); }}
                            style={{ padding: '2px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: '500', backgroundColor: style.bg, color: style.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: ev._isService ? 'default' : 'pointer', borderLeft: `3px solid ${style.color}` }}>
                            {style.icon} {ev.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span style={{ fontSize: '10px', color: '#6b7280', paddingLeft: '4px' }}>+{dayEvents.length - 3} more</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Week View */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {getWeekDays().map((date, idx) => {
                const dateStr = date.toISOString().split('T')[0];
                const dayEvents = getEventsForDate(dateStr);
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDateStr;

                return (
                  <div key={idx} onClick={() => setSelectedDay(new Date(date))}
                    style={{ minHeight: '300px', padding: '8px', borderRight: idx < 6 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer', backgroundColor: isSelected ? '#f0f0ff' : isToday ? '#fffbeb' : 'white' }}>
                    <div style={{ textAlign: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase' }}>{dayNames[idx]}</div>
                      <div style={{ fontSize: '20px', fontWeight: isToday ? '700' : '500', color: isToday ? '#f59e0b' : '#374151', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backgroundColor: isToday ? '#fef3c7' : 'transparent', margin: '4px auto' }}>{date.getDate()}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {dayEvents.map((ev, i) => {
                        const style = getEventStyle(ev.event_type);
                        return (
                          <div key={i} onClick={(e) => { e.stopPropagation(); openEditEvent(ev); }}
                            style={{ padding: '6px 8px', borderRadius: '6px', fontSize: '11px', backgroundColor: style.bg, color: style.color, borderLeft: `3px solid ${style.color}`, cursor: ev._isService ? 'default' : 'pointer' }}>
                            <div style={{ fontWeight: '600' }}>{style.icon} {ev.title}</div>
                            {ev.start_time && <div style={{ fontSize: '10px', opacity: 0.8, marginTop: '2px' }}>{ev.start_time?.slice(0, 5)} - {ev.end_time?.slice(0, 5)}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Panel - Day Detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Selected Day */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>
                  {selectedDay ? selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Today'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>
                  {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button onClick={() => openNewEvent(selectedDateStr)} style={{ padding: '6px 12px', border: 'none', backgroundColor: '#6366f1', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>+ Add</button>
            </div>

            {selectedEvents.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af' }}>
                <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>📅</span>
                <p style={{ margin: 0, fontSize: '13px' }}>{t('noEventsToday')}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedEvents.map((ev, i) => {
                  const style = getEventStyle(ev.event_type);
                  return (
                    <div key={i} style={{ padding: '12px', borderRadius: '10px', backgroundColor: style.bg, border: `1px solid ${style.color}20`, position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <span style={{ fontSize: '20px' }}>{style.icon}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>{ev.title}</p>
                          {ev.start_time && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>🕐 {ev.start_time?.slice(0, 5)} – {ev.end_time?.slice(0, 5)}</p>}
                          {ev.location_id && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6b7280' }}>📍 {getLocationName(ev.location_id)}</p>}
                          {ev.description && <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#6b7280' }}>{ev.description}</p>}
                          <span style={{ display: 'inline-block', marginTop: '6px', padding: '2px 8px', backgroundColor: `${style.color}15`, color: style.color, borderRadius: '9999px', fontSize: '10px', fontWeight: '500' }}>{ev._isService ? 'Recurring Service' : ev.event_type}</span>
                        </div>
                      </div>
                      {!ev._isService && (
                        <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
                          <button onClick={() => openEditEvent(ev)} style={{ padding: '3px 6px', border: 'none', background: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>✏️</button>
                          <button onClick={() => handleDeleteEvent(ev.id)} style={{ padding: '3px 6px', border: 'none', background: '#fef2f2', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#dc2626' }}>🗑️</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Attendance for selected day */}
          {selectedAttendance.length > 0 && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '20px' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>📊 Attendance</h4>
              {selectedAttendance.map((record, i) => {
                const serviceName = services.find(s => s.id === record.service_id)?.name || 'Service';
                return (
                  <div key={i} style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '8px', marginBottom: '8px' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>⛪ {serviceName}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px', fontSize: '12px' }}>
                      <div><span style={{ color: '#6b7280' }}>Men:</span> <strong>{record.men_count || 0}</strong></div>
                      <div><span style={{ color: '#6b7280' }}>Women:</span> <strong>{record.women_count || 0}</strong></div>
                      <div><span style={{ color: '#6b7280' }}>Children:</span> <strong>{record.children_count || 0}</strong></div>
                    </div>
                    <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ fontWeight: '700', color: '#6366f1' }}>Total: {record.total_count || 0}</span>
                      {record.total_offering > 0 && <span style={{ color: '#10b981', fontWeight: '600' }}>Offering: XAF {(record.total_offering || 0).toLocaleString()}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Event Type Legend */}
          <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '16px' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '600', color: '#6b7280' }}>Legend</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(eventTypeConfig).map(([type, cfg]) => (
                <span key={type} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', fontSize: '11px', backgroundColor: cfg.bg, color: cfg.color, borderRadius: '6px', fontWeight: '500' }}>
                  {cfg.icon} {type}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive: stack on mobile */}
      <style>{`
        @media (max-width: 900px) {
          .calendar-page-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Add/Edit Event Modal */}
      <Modal isOpen={showEventModal} onClose={() => setShowEventModal(false)} title={editingEvent ? '✏️ Edit Event' : '➕ New Event'} width="550px">
        <FormInput label="Event Title *" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} required placeholder="e.g., Youth Conference 2026" />
        <FormInput label="Description" type="textarea" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} placeholder="Event description..." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Event Date *" type="date" value={eventForm.event_date} onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })} required />
          <FormInput label="Event Type" type="select" value={eventForm.event_type} onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })} options={[
            { value: 'GENERAL', label: '📅 General' }, { value: 'CONFERENCE', label: '🎤 Conference' },
            { value: 'PRAYER', label: '🙏 Prayer' }, { value: 'MEETING', label: '👥 Meeting' },
            { value: 'OUTREACH', label: '🌍 Outreach' }, { value: 'YOUTH', label: '🎉 Youth' },
            { value: 'WORKSHOP', label: '📚 Workshop' }
          ]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Start Time" type="time" value={eventForm.start_time} onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })} />
          <FormInput label="End Time" type="time" value={eventForm.end_time} onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })} />
        </div>
        <FormInput label="📍 Location" type="select" value={eventForm.location_id} onChange={(e) => setEventForm({ ...eventForm, location_id: e.target.value })} options={[{ value: '', label: 'Select location...' }, ...locations.map(l => ({ value: l.id, label: `${l.is_main_campus ? '🏛️' : '🏢'} ${l.name}` }))]} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
          <Button variant="secondary" onClick={() => setShowEventModal(false)}>{t('cancel')}</Button>
          <Button onClick={handleSaveEvent} disabled={saving}>{saving ? '⏳ Saving...' : '💾 Save Event'}</Button>
        </div>
      </Modal>
    </div>
  );
}

// ==========================================
// SERVICES & EVENTS PAGE
// ==========================================

export default CalendarPage;
