import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { LayoutDashboard, Home, Users, MapPin, Plus, Clock, User, Star, Sparkles, Menu, X, RotateCw, Calendar } from 'lucide-react';

const App = () => {
  const [view, setView] = useState('dashboard');
  const [filterArea, setFilterArea] = useState('all');
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [newUnit, setNewUnit] = useState({
    name: '',
    area: 'Shah Alam',
    status: 'Ready',
    priority: 'Normal',
    checkout_time: '12:00 PM',
    ical_url: '',
    bookings: []
  });

  useEffect(() => {
    fetchProperties();
    const subscription = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, fetchProperties)
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  async function fetchProperties() {
    const { data, error } = await supabase.from('properties').select('*').order('created_at', { ascending: false });
    if (data) setProperties(data);
    setLoading(false);
  }

  async function handleAddUnit(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('properties').insert([newUnit]);

    if (error) {
      alert('Error adding unit: ' + error.message);
    } else {
      setShowModal(false);
      setNewUnit({ name: '', area: 'Shah Alam', status: 'Ready', priority: 'Normal', checkout_time: '12:00 PM' });
      await fetchProperties();
    }
    setLoading(false);
  }

  async function handleUpdateUnit(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase
      .from('properties')
      .update({
        name: editingUnit.name,
        area: editingUnit.area,
        priority: editingUnit.priority,
        checkout_time: editingUnit.checkout_time,
        status: editingUnit.status,
        ical_url: editingUnit.ical_url
      })
      .eq('id', editingUnit.id);

    if (error) {
      alert('Error updating unit: ' + error.message);
    } else {
      setShowEditModal(false);
      setEditingUnit(null);
      await fetchProperties();
    }
    setLoading(false);
  }

  async function handleDeleteUnit() {
    if (!window.confirm('Are you sure you want to delete this unit?')) return;

    setLoading(true);
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', editingUnit.id);

    if (error) {
      alert('Error deleting unit: ' + error.message);
    } else {
      setShowEditModal(false);
      setEditingUnit(null);
      await fetchProperties();
    }
    setLoading(false);
  }

  const filteredProperties = filterArea === 'all'
    ? properties
    : properties.filter(p => p.area === filterArea);

  async function syncAirbnb(unit) {
    if (!unit.ical_url) {
      alert('Please add an Airbnb iCal link first.');
      return;
    }

    setLoading(true);
    try {
      // Use internal Cloudflare function to bypass CORS
      const proxyUrl = `/fetch-ical?url=${encodeURIComponent(unit.ical_url)}`;
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Proxy error: ${response.status} - ${errText}`);
      }

      const data = await response.text();

      // Simple iCal parser for DTSTART and DTEND
      const events = data.split('BEGIN:VEVENT');
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      let bookings = [];
      let latestCheckout = null;

      events.forEach(event => {
        const dtStartMatch = event.match(/DTSTART;VALUE=DATE:(\d{8})/);
        const dtEndMatch = event.match(/DTEND;VALUE=DATE:(\d{8})/);
        const summaryMatch = event.match(/SUMMARY:(.*)/);

        if (dtStartMatch && dtEndMatch) {
          const startStr = dtStartMatch[1];
          const endStr = dtEndMatch[1];

          const startDate = new Date(parseInt(startStr.substring(0, 4)), parseInt(startStr.substring(4, 6)) - 1, parseInt(startStr.substring(6, 8)));
          const endDate = new Date(parseInt(endStr.substring(0, 4)), parseInt(endStr.substring(4, 6)) - 1, parseInt(endStr.substring(6, 8)));
          const summary = summaryMatch ? summaryMatch[1].trim() : 'Reserved';
          // We only care about actual reservations (Reserved) and future stays
          if (summary === 'Reserved' && endDate >= now) {
            bookings.push({
              start: startDate.toISOString(),
              end: endDate.toISOString(),
              summary: 'Guest Booking'
            });

            // Find the closest upcoming checkout
            if (!latestCheckout || (endDate > now && endDate < latestCheckout)) {
              latestCheckout = endDate;
            }
          }
        }
      });

      // Sort bookings by start date
      bookings.sort((a, b) => new Date(a.start) - new Date(b.start));

      const updateData = { bookings };

      if (latestCheckout) {
        const formattedDate = latestCheckout.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        updateData.checkout_time = `12:00 PM (${formattedDate})`;
      }

      const { error } = await supabase
        .from('properties')
        .update(updateData)
        .eq('id', unit.id);

      if (error) throw error;
      alert(`Synced successfully! ${bookings.length} upcoming bookings found.`);
      await fetchProperties();
    } catch (err) {
      console.error('Sync error:', err);
      alert(`Sync Error: ${err.message || 'Unknown error'}. Please ensure the iCal link is correct.`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Mobile Sidebar (Drawer) */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
        <aside className={`absolute inset-y-0 left-0 w-64 bg-white shadow-2xl p-6 flex flex-col transition-transform duration-300 ease-in-out transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-airbnb" />
              <h1 className="text-xl font-extrabold tracking-tight">OPS AIRBNB</h1>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-slate-600">
              <Plus className="rotate-45" size={24} />
            </button>
          </div>
          <nav className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 px-3 tracking-widest">Main</div>
            <button
              onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${view === 'dashboard' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutDashboard size={20} />
              <span className="font-semibold text-sm">Dashboard</span>
            </button>
            <button
              onClick={() => { setView('calendar'); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${view === 'calendar' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Calendar size={20} />
              <span className="font-semibold text-sm">Calendar</span>
            </button>
            <div className="pt-6 text-[10px] uppercase font-bold text-slate-400 mb-2 px-3 tracking-widest">Areas</div>
            {['all', 'Shah Alam', 'Puchong'].map(area => (
              <button
                key={area}
                onClick={() => { setFilterArea(area); setView('dashboard'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${filterArea === area && view === 'dashboard' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <MapPin size={20} />
                <span className="font-semibold text-sm">{area === 'all' ? 'All Areas' : area}</span>
              </button>
            ))}
          </nav>
        </aside>
      </div>

      {/* Desktop Sidebar (Fixed) */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 p-6 flex-col overflow-y-auto z-30">
        <div className="flex items-center gap-3 mb-10">
          <Sparkles className="w-8 h-8 text-airbnb" />
          <h1 className="text-xl font-extrabold tracking-tight">OPS AIRBNB</h1>
        </div>
        <nav className="space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 px-3 tracking-widest">Main</div>
          <button
            onClick={() => setView('dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${view === 'dashboard' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-semibold text-sm">Dashboard</span>
          </button>
          <button
            onClick={() => { setView('calendar'); setFilterArea('all'); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${view === 'calendar' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Calendar size={20} />
            <span className="font-semibold text-sm">Calendar</span>
          </button>
          <div className="pt-6 text-[10px] uppercase font-bold text-slate-400 mb-2 px-3 tracking-widest">Areas</div>
          {['all', 'Shah Alam', 'Puchong'].map(area => (
            <button
              key={area}
              onClick={() => { setFilterArea(area); setView('dashboard'); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${filterArea === area && view === 'dashboard' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <MapPin size={20} />
              <span className="font-semibold text-sm">{area === 'all' ? 'All Areas' : area}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="md:pl-64 min-h-screen">
        <div className="max-w-7xl mx-auto w-full p-4 md:p-8">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 md:mb-10">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Menu size={24} />
              </button>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                  {view === 'dashboard' ? 'Operations Dashboard' : 'Team Hub'}
                </h2>
                <p className="text-slate-500 mt-0.5 md:mt-1 text-sm md:text-base font-medium italic">Viewing focus: {filterArea}</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="w-full md:w-auto flex items-center justify-center gap-2 bg-airbnb text-white px-5 py-3 md:py-2.5 rounded-xl font-bold hover:bg-airbnb-dark transition-all shadow-lg shadow-airbnb/10"
            >
              <Plus size={20} />
              <span>New Task</span>
            </button>
          </header>

          {view === 'calendar' ? (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Upcoming Schedule</h2>
                  <p className="text-sm text-slate-500">Consolidated bookings across all {properties.length} units</p>
                </div>
                <button
                  onClick={() => properties.forEach(p => p.ical_url && syncAirbnb(p))}
                  className="flex items-center gap-2 text-airbnb hover:text-airbnb-dark font-bold text-sm bg-white border border-airbnb/20 px-4 py-2 rounded-xl"
                >
                  <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
                  <span>Sync All</span>
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {(() => {
                  const allBookings = properties.flatMap(p =>
                    (p.bookings || []).map(b => ({ ...b, propertyName: p.name, propertyArea: p.area }))
                  ).sort((a, b) => new Date(a.end) - new Date(b.end)); // Sort by checkout date

                  if (allBookings.length === 0) {
                    return (
                      <div className="p-20 text-center">
                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Calendar size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">No Cleanings Scheduled</h3>
                        <p className="text-slate-500">Sync your Airbnb calendars to see when guests are leaving.</p>
                      </div>
                    );
                  }

                  return allBookings.map((booking, idx) => {
                    const start = new Date(booking.start);
                    const end = new Date(booking.end);
                    const isToday = new Date().toDateString() === end.toDateString(); // Cleaning happens on checkout day!

                    return (
                      <div key={idx} className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors ${isToday ? 'bg-airbnb/5 border-l-4 border-l-airbnb' : ''}`}>
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border ${isToday ? 'bg-airbnb border-airbnb text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                            <span className="text-[10px] font-bold uppercase leading-none mb-0.5">{end.toLocaleDateString('en-GB', { month: 'short' })}</span>
                            <span className="text-lg font-black leading-none">{end.getDate()}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-slate-900">{booking.propertyName}</h4>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold uppercase tracking-wider">{booking.propertyArea}</span>
                              {isToday && <span className="px-2 py-0.5 bg-airbnb text-white rounded-md text-[10px] font-black uppercase tracking-wider animate-pulse">Checkout Today</span>}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-500">
                              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                                <Sparkles size={14} className="text-airbnb" />
                                Cleaning Required
                              </span>
                              <span className="w-1 h-1 bg-slate-300 rounded-full" />
                              <span className="font-medium">Stay: {start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - {end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button className="flex-1 md:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition-all">
                            Assign Cleaner
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-airbnb"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {filteredProperties.map(unit => (
                <div key={unit.id} className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:shadow-2xl hover:shadow-slate-200 transition-all group shrink-0">
                  <div className={`h-1.5 w-full ${unit.priority === 'High' ? 'bg-rose-500' : 'bg-airbnb'}`} />
                  <div className="p-5 md:p-6">
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-2.5 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${unit.area === 'Shah Alam' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-sky-50 text-sky-600 border border-sky-100'}`}>
                        {unit.area}
                      </span>
                      <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2.5 py-0.5 md:px-3 md:py-1 rounded-full uppercase tracking-wider border border-amber-100">
                        {unit.status}
                      </span>
                    </div>
                    <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-4 group-hover:text-airbnb transition-colors truncate">{unit.name}</h3>

                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-slate-500">
                        <Clock size={16} className="text-airbnb/60 shrink-0" />
                        <span className="text-sm font-medium">Checkout: <strong className="text-slate-700">{unit.checkout_time}</strong></span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-500">
                        <User size={16} className="text-airbnb/60 shrink-0" />
                        <span className="text-sm font-medium">Assignee: <strong className="text-slate-700">Unassigned</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2 group-hover:bg-airbnb/5 transition-colors">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Priority: {unit.priority}</span>
                    <div className="flex items-center gap-2">
                      {unit.ical_url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            syncAirbnb(unit);
                          }}
                          className="flex items-center gap-1.5 px-2 py-1.5 text-airbnb hover:bg-airbnb/10 rounded-lg transition-colors border border-airbnb/20"
                          title="Sync Airbnb Calendar"
                        >
                          <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Sync</span>
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingUnit(unit);
                          setShowEditModal(true);
                        }}
                        className="text-xs font-bold text-airbnb hover:text-airbnb-dark underline underline-offset-4 whitespace-nowrap ml-2"
                      >
                        Manage Unit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-900">Add New Unit</h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <form onSubmit={handleAddUnit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Unit Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Unit A-12-03"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-airbnb/20 focus:border-airbnb transition-all"
                    value={newUnit.name}
                    onChange={e => setNewUnit({ ...newUnit, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Area</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-airbnb/20 focus:border-airbnb transition-all"
                      value={newUnit.area}
                      onChange={e => setNewUnit({ ...newUnit, area: e.target.value })}
                    >
                      <option>Shah Alam</option>
                      <option>Puchong</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Priority</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-airbnb/20 focus:border-airbnb transition-all"
                      value={newUnit.priority}
                      onChange={e => setNewUnit({ ...newUnit, priority: e.target.value })}
                    >
                      <option>Normal</option>
                      <option>High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Airbnb iCal Link (Optional)</label>
                  <input
                    type="text"
                    placeholder="https://www.airbnb.com/calendar/ical/..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-airbnb/20 focus:border-airbnb transition-all"
                    value={newUnit.ical_url}
                    onChange={e => setNewUnit({ ...newUnit, ical_url: e.target.value })}
                  />
                </div>

                {/* Upcoming Bookings List */}
                {editingUnit.bookings && editingUnit.bookings.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Upcoming Bookings</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                      {editingUnit.bookings.slice(0, 5).map((booking, idx) => {
                        const start = new Date(booking.start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                        const end = new Date(booking.end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                        return (
                          <div key={idx} className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="font-bold text-slate-700">{booking.summary}</span>
                            <span className="text-airbnb font-medium">{start} - {end}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-airbnb text-white py-4 rounded-xl font-bold hover:bg-airbnb-dark transition-all shadow-lg shadow-airbnb/10 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Adding...' : 'Create Unit'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingUnit && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-900">Manage Unit</h3>
                <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdateUnit} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Unit Name</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-airbnb/20 focus:border-airbnb transition-all"
                    value={editingUnit.name}
                    onChange={e => setEditingUnit({ ...editingUnit, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Area</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-airbnb/20 focus:border-airbnb transition-all"
                      value={editingUnit.area}
                      onChange={e => setEditingUnit({ ...editingUnit, area: e.target.value })}
                    >
                      <option>Shah Alam</option>
                      <option>Puchong</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Priority</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-airbnb/20 focus:border-airbnb transition-all"
                      value={editingUnit.priority}
                      onChange={e => setEditingUnit({ ...editingUnit, priority: e.target.value })}
                    >
                      <option>Normal</option>
                      <option>High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Airbnb iCal Link</label>
                  <input
                    type="text"
                    placeholder="Paste iCal link here"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-airbnb/20 focus:border-airbnb transition-all"
                    value={editingUnit.ical_url || ''}
                    onChange={e => setEditingUnit({ ...editingUnit, ical_url: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Status</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-airbnb/20 focus:border-airbnb transition-all"
                      value={editingUnit.status}
                      onChange={e => setEditingUnit({ ...editingUnit, status: e.target.value })}
                    >
                      <option>Ready</option>
                      <option>Cleaning</option>
                      <option>Maintenance</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Checkout Time</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-airbnb/20 focus:border-airbnb transition-all"
                      value={editingUnit.checkout_time}
                      onChange={e => setEditingUnit({ ...editingUnit, checkout_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleDeleteUnit}
                    disabled={loading}
                    className="flex-1 bg-rose-50 text-rose-600 py-4 rounded-xl font-bold hover:bg-rose-100 transition-all disabled:opacity-50"
                  >
                    Delete
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-[2] bg-airbnb text-white py-4 rounded-xl font-bold hover:bg-airbnb-dark transition-all shadow-lg shadow-airbnb/10 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Update Unit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
