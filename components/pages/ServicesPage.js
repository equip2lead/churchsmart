"use client";
// ServicesPage — extracted from app/page.js for code splitting
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase, supabaseQuery, supabaseInsert, supabaseUpdate, supabaseDelete, logActivity } from '../../lib/cs-shared';
import { useLanguage, useToast, useAuth, usePermissions } from '../../lib/cs-contexts';
import { canAccessFeature, canAccess, getPlanLimits } from '../../lib/featureGating';
import { Modal, FormInput, Button, DataTable, PageHeader, SearchBar, LoadingSpinner, ConfirmDialog, StatusBadge, exportToCSV, StatCard } from '../cs-ui';
import UpgradePrompt from '../UpgradePrompt';

function ServicesPage() {
  const { t } = useLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const CHURCH_ID = user?.church_id;
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('services');
  const [services, setServices] = useState([]);
  const [events, setEvents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterLocation, setFilterLocation] = useState('all');

  const [serviceForm, setServiceForm] = useState({ 
    name: '', description: '', location_id: '', day_of_week: 'SUNDAY', 
    start_time: '09:00', end_time: '11:00', is_active: true 
  });

  const [eventForm, setEventForm] = useState({
    title: '', description: '', event_date: '', start_time: '09:00', 
    end_time: '12:00', location_id: '', event_type: 'GENERAL', 
    is_recurring: false, recurrence_pattern: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [servicesData, eventsData, locationsData, attendanceData] = await Promise.all([
        supabaseQuery('services', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('events', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'event_date.asc' }),
        supabaseQuery('church_locations', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }] }),
        supabaseQuery('attendance_records', { filters: [{ column: 'church_id', operator: 'eq', value: CHURCH_ID }], order: 'service_date.desc', limit: 10 })
      ]);
      setServices(servicesData || []);
      setEvents(eventsData || []);
      setLocations(locationsData || []);
      setAttendance(attendanceData || []);
    } catch (error) {
      console.error('Services fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset forms
  const resetServiceForm = () => {
    setServiceForm({ name: '', description: '', location_id: locations[0]?.id || '', day_of_week: 'SUNDAY', start_time: '09:00', end_time: '11:00', is_active: true });
    setEditingService(null);
  };

  const resetEventForm = () => {
    setEventForm({ title: '', description: '', event_date: '', start_time: '09:00', end_time: '12:00', location_id: locations[0]?.id || '', event_type: 'GENERAL', is_recurring: false, recurrence_pattern: '' });
    setEditingEvent(null);
  };

  // Open modals
  const openServiceModal = (service = null) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        name: service.name || '', description: service.description || '',
        location_id: service.location_id || '', day_of_week: service.day_of_week || 'SUNDAY',
        start_time: service.start_time || '09:00', end_time: service.end_time || '11:00',
        is_active: service.is_active ?? true
      });
    } else { resetServiceForm(); }
    setShowServiceModal(true);
  };

  const openEventModal = (event = null) => {
    if (event) {
      setEditingEvent(event);
      setEventForm({
        title: event.title || '', description: event.description || '',
        event_date: event.event_date || '', start_time: event.start_time || '09:00',
        end_time: event.end_time || '12:00', location_id: event.location_id || '',
        event_type: event.event_type || 'GENERAL', is_recurring: event.is_recurring || false,
        recurrence_pattern: event.recurrence_pattern || ''
      });
    } else { resetEventForm(); }
    setShowEventModal(true);
  };

  // Save handlers
  const handleSaveService = async () => {
    if (!serviceForm.name) { toast.warning('Service name is required'); return; }
    setSaving(true);
    try {
      const cleanedForm = { ...serviceForm, location_id: serviceForm.location_id || null, start_time: serviceForm.start_time || null, end_time: serviceForm.end_time || null };
      if (editingService) {
        await supabaseUpdate('services', editingService.id, cleanedForm);
        logActivity({
          action: 'service_updated',
          entity_type: 'service',
          entity_id: editingService.id,
          entity_name: cleanedForm.name || null,
          details: null
        });
      } else {
        const result = await supabaseInsert('services', cleanedForm);
        const realRow = Array.isArray(result) ? result[0] : result;
        logActivity({
          action: 'service_created',
          entity_type: 'service',
          entity_id: realRow?.id || null,
          entity_name: cleanedForm.name || null,
          details: null
        });
      }
      setShowServiceModal(false);
      resetServiceForm();
      fetchData();
    } catch (error) { toast.error(error.message); }
    setSaving(false);
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
      }
      setShowEventModal(false);
      resetEventForm();
      fetchData();
    } catch (error) { toast.error(error.message); }
    setSaving(false);
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const target = deleteConfirm;
      if (target.type === 'service') {
        await supabaseDelete('services', target.id);
        logActivity({
          action: 'service_deleted',
          entity_type: 'service',
          entity_id: target.id,
          entity_name: target.name || null,
          details: null
        });
      } else {
        await supabaseDelete('events', target.id);
        logActivity({
          action: 'event_deleted',
          entity_type: 'event',
          entity_id: target.id,
          entity_name: target.title || null,
          details: null
        });
      }
      setDeleteConfirm(null);
      fetchData();
    } catch (error) { toast.error(error.message); }
  };

  // Helper functions
  const getLocationName = (locationId) => {
    const location = locations.find(l => l.id === locationId);
    return location?.name || 'Main Campus';
  };

  const getServiceName = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    return service?.name || 'Unknown';
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timeStr) => timeStr ? timeStr.slice(0, 5) : '';

  const isUpcoming = (dateStr) => new Date(dateStr) >= new Date();
  const isPast = (dateStr) => new Date(dateStr) < new Date();

  // Filter services by location
  const filteredServices = filterLocation === 'all' ? services : services.filter(s => s.location_id === filterLocation);

  // Separate upcoming and past events
  const upcomingEvents = events.filter(e => isUpcoming(e.event_date));
  const pastEvents = events.filter(e => isPast(e.event_date));

  const eventTypeIcons = {
    'SERVICE': '⛪', 'CONFERENCE': '🎤', 'PRAYER': '🙏', 'MEETING': '👥',
    'OUTREACH': '🌍', 'YOUTH': '🎉', 'GENERAL': '📅', 'WORKSHOP': '📚'
  };

  const eventTypeColors = {
    'SERVICE': '#6366f1', 'CONFERENCE': '#f59e0b', 'PRAYER': '#ec4899', 'MEETING': '#10b981',
    'OUTREACH': '#3b82f6', 'YOUTH': '#8b5cf6', 'GENERAL': '#6b7280', 'WORKSHOP': '#14b8a6'
  };

  return (
    <div>
      <PageHeader
        title="⛪ Services & Events"
        subtitle={`${services.length} services • ${upcomingEvents.length} upcoming events`}
        actions={
          <div style={{ display: 'flex', gap: '12px' }}>
            {activeTab === 'services' ? (
              <Button onClick={() => openServiceModal()}>➕ Add Service</Button>
            ) : (
              <Button onClick={() => openEventModal()}>➕ Add Event</Button>
            )}
          </div>
        }
      />

      {/* Tab Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button
          onClick={() => setActiveTab('services')}
          style={{
            padding: '12px 24px',
            border: activeTab === 'services' ? '2px solid #6366f1' : '1px solid #e5e7eb',
            borderRadius: '10px',
            backgroundColor: activeTab === 'services' ? '#eef2ff' : 'white',
            color: activeTab === 'services' ? '#6366f1' : '#6b7280',
            fontWeight: activeTab === 'services' ? '600' : '400',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🕐 Services ({services.length})
        </button>
        <button
          onClick={() => setActiveTab('events')}
          style={{
            padding: '12px 24px',
            border: activeTab === 'events' ? '2px solid #f59e0b' : '1px solid #e5e7eb',
            borderRadius: '10px',
            backgroundColor: activeTab === 'events' ? '#fef3c7' : 'white',
            color: activeTab === 'events' ? '#f59e0b' : '#6b7280',
            fontWeight: activeTab === 'events' ? '600' : '400',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🎉 Events ({events.length})
        </button>
        <button
          onClick={() => setActiveTab('attendance')}
          style={{
            padding: '12px 24px',
            border: activeTab === 'attendance' ? '2px solid #10b981' : '1px solid #e5e7eb',
            borderRadius: '10px',
            backgroundColor: activeTab === 'attendance' ? '#d1fae5' : 'white',
            color: activeTab === 'attendance' ? '#10b981' : '#6b7280',
            fontWeight: activeTab === 'attendance' ? '600' : '400',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          📊 Recent Attendance
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard label="Total Services" value={services.length} icon="⛪" />
        <StatCard label="Active Services" value={services.filter(s => s.is_active).length} icon="✅" color="#10b981" />
        <StatCard label="Upcoming Events" value={upcomingEvents.length} icon="📅" color="#f59e0b" />
        <StatCard label="Locations" value={locations.length} icon="📍" color="#6366f1" />
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* SERVICES TAB */}
          {activeTab === 'services' && (
            <>
              {/* Service Times Table */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', marginBottom: '24px' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>🕐 Service Times</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ fontSize: '14px', color: '#6b7280' }}>Filter:</label>
                    <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px' }}>
                      <option value="all">All Locations</option>
                      {locations.map(loc => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
                    </select>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f9fafb' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Service</th>
                        <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Location</th>
                        <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Day</th>
                        <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Time</th>
                        <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Status</th>
                        <th style={{ textAlign: 'right', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredServices.map((service, index) => (
                        <tr key={index} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', backgroundColor: '#e0e7ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>⛪</div>
                              <div>
                                <p style={{ margin: 0, fontWeight: '500' }}>{service.name}</p>
                                {service.description && <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6b7280' }}>{service.description}</p>}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span style={{ padding: '4px 12px', backgroundColor: '#e0e7ff', color: '#4338ca', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>
                              📍 {getLocationName(service.location_id)}
                            </span>
                          </td>
                          <td style={{ padding: '16px', color: '#374151', fontWeight: '500' }}>{service.day_of_week}</td>
                          <td style={{ padding: '16px', color: '#6b7280' }}>{formatTime(service.start_time)} - {formatTime(service.end_time)}</td>
                          <td style={{ padding: '16px' }}>
                            {service.is_active 
                              ? <span style={{ padding: '4px 12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '9999px', fontSize: '12px' }}>✅ Active</span>
                              : <span style={{ padding: '4px 12px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '9999px', fontSize: '12px' }}>❌ Inactive</span>
                            }
                          </td>
                          <td style={{ padding: '16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button onClick={() => openServiceModal(service)} style={{ padding: '6px 12px', border: 'none', background: '#f3f4f6', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✏️ Edit</button>
                              <button onClick={() => setDeleteConfirm({ ...service, type: 'service' })} style={{ padding: '6px 12px', border: 'none', background: '#fef2f2', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}>🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredServices.length === 0 && (
                        <tr><td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>No services found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Locations Overview */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>📍 Services by Location</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {locations.map((location, index) => {
                    const locationServices = services.filter(s => s.location_id === location.id);
                    return (
                      <div key={index} style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                          <span style={{ fontSize: '24px' }}>{location.is_main_campus ? '🏛️' : '🏢'}</span>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{location.name}</h4>
                            {location.is_main_campus && <span style={{ fontSize: '11px', color: '#6366f1' }}>Main Campus</span>}
                          </div>
                        </div>
                        <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#6b7280' }}>
                          ⛪ {locationServices.length} services • ✅ {locationServices.filter(s => s.is_active).length} active
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {locationServices.map((svc, i) => (
                            <span key={i} style={{ padding: '4px 8px', backgroundColor: 'white', borderRadius: '6px', fontSize: '11px', color: '#374151', border: '1px solid #e5e7eb' }}>
                              {svc.day_of_week} {formatTime(svc.start_time)}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* EVENTS TAB */}
          {activeTab === 'events' && (
            <>
              {/* Upcoming Events */}
              <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden', marginBottom: '24px' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>🎉 Upcoming Events</h3>
                  <span style={{ padding: '4px 12px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '9999px', fontSize: '12px' }}>{upcomingEvents.length} upcoming</span>
                </div>
                {upcomingEvents.length === 0 ? (
                  <div style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>
                    <span style={{ fontSize: '48px' }}>📅</span>
                    <p>No upcoming events. Create one!</p>
                  </div>
                ) : (
                  <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                    {upcomingEvents.map((event, index) => {
                      const daysUntil = Math.ceil((new Date(event.event_date) - new Date()) / (1000 * 60 * 60 * 24));
                      return (
                        <div key={index} style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '12px', border: `2px solid ${eventTypeColors[event.event_type] || '#e5e7eb'}20`, position: 'relative' }}>
                          <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '4px' }}>
                            <button onClick={() => openEventModal(event)} style={{ padding: '4px 8px', border: 'none', background: '#f3f4f6', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✏️</button>
                            <button onClick={() => setDeleteConfirm({ ...event, type: 'event' })} style={{ padding: '4px 8px', border: 'none', background: '#fef2f2', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#dc2626' }}>🗑️</button>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ width: '50px', height: '50px', backgroundColor: `${eventTypeColors[event.event_type] || '#6b7280'}20`, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                              {eventTypeIcons[event.event_type] || '📅'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '600' }}>{event.title}</h4>
                              <span style={{ padding: '2px 8px', backgroundColor: `${eventTypeColors[event.event_type] || '#6b7280'}20`, color: eventTypeColors[event.event_type] || '#6b7280', borderRadius: '9999px', fontSize: '11px', fontWeight: '500' }}>
                                {event.event_type}
                              </span>
                            </div>
                          </div>
                          {event.description && <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#6b7280' }}>{event.description}</p>}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: '#374151' }}>
                            <span>📅 {formatDate(event.event_date)}</span>
                            {event.start_time && <span>🕐 {formatTime(event.start_time)} - {formatTime(event.end_time)}</span>}
                            {event.location_id && <span>📍 {getLocationName(event.location_id)}</span>}
                          </div>
                          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                            <span style={{ padding: '4px 12px', backgroundColor: daysUntil <= 3 ? '#fef3c7' : '#dbeafe', color: daysUntil <= 3 ? '#92400e' : '#1e40af', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>
                              {daysUntil === 0 ? '🎉 Today!' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Past Events */}
              {pastEvents.length > 0 && (
                <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                  <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#6b7280' }}>📜 Past Events</h3>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ backgroundColor: '#f9fafb' }}>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Event</th>
                          <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Type</th>
                          <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                          <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pastEvents.slice(0, 5).map((event, index) => (
                          <tr key={index} style={{ borderTop: '1px solid #e5e7eb', opacity: 0.7 }}>
                            <td style={{ padding: '12px 16px', fontWeight: '500' }}>{event.title}</td>
                            <td style={{ padding: '12px 16px' }}><span style={{ fontSize: '12px' }}>{eventTypeIcons[event.event_type]} {event.event_type}</span></td>
                            <td style={{ padding: '12px 16px', color: '#6b7280' }}>{formatDate(event.event_date)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <button onClick={() => setDeleteConfirm({ ...event, type: 'event' })} style={{ padding: '4px 8px', border: 'none', background: '#fef2f2', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: '#dc2626' }}>🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ATTENDANCE TAB */}
          {activeTab === 'attendance' && (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📊 Recent Attendance Records</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Service</th>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Location</th>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Men</th>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Women</th>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Children</th>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Total</th>
                      <th style={{ textAlign: 'left', padding: '16px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Offering</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((record, index) => (
                      <tr key={index} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '16px', fontWeight: '500' }}>{formatDate(record.service_date)}</td>
                        <td style={{ padding: '16px', color: '#6366f1' }}>{getServiceName(record.service_id)}</td>
                        <td style={{ padding: '16px' }}><span style={{ padding: '2px 8px', backgroundColor: '#f3f4f6', borderRadius: '6px', fontSize: '12px' }}>{getLocationName(record.location_id)}</span></td>
                        <td style={{ padding: '16px' }}>{record.men_count}</td>
                        <td style={{ padding: '16px' }}>{record.women_count}</td>
                        <td style={{ padding: '16px' }}>{record.children_count}</td>
                        <td style={{ padding: '16px', fontWeight: 'bold', color: '#6366f1' }}>{record.total_count}</td>
                        <td style={{ padding: '16px', color: '#10b981', fontWeight: '500' }}>XAF {(record.total_offering || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    {attendance.length === 0 && (
                      <tr><td colSpan="8" style={{ padding: '48px', textAlign: 'center', color: '#6b7280' }}>No attendance records yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Service Modal */}
      <Modal isOpen={showServiceModal} onClose={() => { setShowServiceModal(false); resetServiceForm(); }} title={editingService ? '✏️ Edit Service' : '➕ Add Service'}>
        <FormInput label="Service Name *" value={serviceForm.name} onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} required placeholder="e.g., Sunday First Service" />
        <FormInput label="Description" type="textarea" value={serviceForm.description} onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} placeholder="Brief description..." />
        <FormInput label="📍 Location" type="select" value={serviceForm.location_id} onChange={(e) => setServiceForm({ ...serviceForm, location_id: e.target.value })} options={locations.map(l => ({ value: l.id, label: `${l.is_main_campus ? '🏛️' : '🏢'} ${l.name}` }))} />
        <FormInput label="Day of Week" type="select" value={serviceForm.day_of_week} onChange={(e) => setServiceForm({ ...serviceForm, day_of_week: e.target.value })} options={[{ value: 'SUNDAY', label: 'Sunday' }, { value: 'MONDAY', label: 'Monday' }, { value: 'TUESDAY', label: 'Tuesday' }, { value: 'WEDNESDAY', label: 'Wednesday' }, { value: 'THURSDAY', label: 'Thursday' }, { value: 'FRIDAY', label: 'Friday' }, { value: 'SATURDAY', label: 'Saturday' }]} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Start Time" type="time" value={serviceForm.start_time} onChange={(e) => setServiceForm({ ...serviceForm, start_time: e.target.value })} />
          <FormInput label="End Time" type="time" value={serviceForm.end_time} onChange={(e) => setServiceForm({ ...serviceForm, end_time: e.target.value })} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <input type="checkbox" checked={serviceForm.is_active} onChange={(e) => setServiceForm({ ...serviceForm, is_active: e.target.checked })} />
          <span>✅ Active</span>
        </label>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowServiceModal(false); resetServiceForm(); }}>{t('cancel')}</Button>
          <Button onClick={handleSaveService} disabled={saving}>{saving ? '⏳' : '💾 Save'}</Button>
        </div>
      </Modal>

      {/* Add/Edit Event Modal */}
      <Modal isOpen={showEventModal} onClose={() => { setShowEventModal(false); resetEventForm(); }} title={editingEvent ? '✏️ Edit Event' : '➕ Add Event'} width="600px">
        <FormInput label="Event Title *" value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} required placeholder="e.g., Youth Conference 2026" />
        <FormInput label="Description" type="textarea" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} placeholder="What is this event about?" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Event Date *" type="date" value={eventForm.event_date} onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })} required />
          <FormInput label="Event Type" type="select" value={eventForm.event_type} onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })} options={[{ value: 'GENERAL', label: '📅 General' }, { value: 'CONFERENCE', label: '🎤 Conference' }, { value: 'PRAYER', label: '🙏 Prayer' }, { value: 'MEETING', label: '👥 Meeting' }, { value: 'OUTREACH', label: '🌍 Outreach' }, { value: 'YOUTH', label: '🎉 Youth' }, { value: 'WORKSHOP', label: '📚 Workshop' }]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <FormInput label="Start Time" type="time" value={eventForm.start_time} onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })} />
          <FormInput label="End Time" type="time" value={eventForm.end_time} onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })} />
        </div>
        <FormInput label="📍 Location" type="select" value={eventForm.location_id} onChange={(e) => setEventForm({ ...eventForm, location_id: e.target.value })} options={[{ value: '', label: 'Select location...' }, ...locations.map(l => ({ value: l.id, label: `${l.is_main_campus ? '🏛️' : '🏢'} ${l.name}` }))]} />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => { setShowEventModal(false); resetEventForm(); }}>{t('cancel')}</Button>
          <Button onClick={handleSaveEvent} disabled={saving}>{saving ? '⏳' : '💾 Save Event'}</Button>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title={`🗑️ Delete ${deleteConfirm?.type === 'service' ? 'Service' : 'Event'}`}
        message={`Are you sure you want to delete "${deleteConfirm?.name || deleteConfirm?.title}"?`}
      />
    </div>
  );
}

// ==========================================
// SUPER ADMIN PAGE
// ==========================================

export default ServicesPage;
