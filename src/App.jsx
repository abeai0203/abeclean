import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { LayoutDashboard, Home, Users, MapPin, Plus, Clock, User, Star, Sparkles, Menu, X, RotateCw, Calendar, CheckCircle, Image, Trash2, ShieldCheck, ChevronDown } from 'lucide-react';

const App = () => {
  const [view, setView] = useState('dashboard');
  const [filterArea, setFilterArea] = useState('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [properties, setProperties] = useState([]);
  const [cleaners, setCleaners] = useState([]);
  const [cleaningTasks, setCleaningTasks] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState('admin');
  const [currentCleanerId, setCurrentCleanerId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showCleanerModal, setShowCleanerModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingCleaner, setEditingCleaner] = useState(null);

  const [newUnit, setNewUnit] = useState({
    name: '',
    area: 'Shah Alam',
    status: 'Ready',
    priority: 'Normal',
    checkout_time: '12:00 PM',
    ical_url: '',
    bookings: []
  });

  const [newCleaner, setNewCleaner] = useState({
    name: '',
    phone: '',
    role: 'cleaner',
    head_cleaner_id: ''
  });

  useEffect(() => {
    fetchData();
    const subscription = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, fetchProperties)
      .subscribe();

    return () => supabase.removeChannel(subscription);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchProperties(),
        fetchCleaners(),
        fetchCleaningTasks()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .order('priority', { ascending: false });

    if (error) console.error('Error fetching properties:', error);
    else setProperties(data || []);
  };

  const fetchCleaners = async () => {
    const { data, error } = await supabase
      .from('cleaners')
      .select('*')
      .order('name');

    if (error) console.error('Error fetching cleaners:', error);
    else setCleaners(data || []);
  };

  const fetchCleaningTasks = async () => {
    const { data, error } = await supabase
      .from('cleaning_tasks')
      .select('*, cleaners(name)');

    if (error) console.error('Error fetching tasks:', error);
    else setCleaningTasks(data || []);
  };

  async function handleAddUnit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('properties').insert([newUnit]);
      if (error) throw error;

      setShowNewTaskModal(false);
      setNewUnit({ name: '', area: 'Shah Alam', status: 'Ready', priority: 'Normal', checkout_time: '12:00 PM', ical_url: '', bookings: [] });
      fetchProperties();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateUnit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('properties')
        .update({
          name: selectedUnit.name,
          area: selectedUnit.area,
          priority: selectedUnit.priority,
          status: selectedUnit.status,
          checkout_time: selectedUnit.checkout_time,
          ical_url: selectedUnit.ical_url
        })
        .eq('id', selectedUnit.id);
      if (error) throw error;
      setShowManageModal(false);
      fetchProperties();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteUnit() {
    if (!confirm('Are you sure you want to delete this property?')) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('properties').delete().eq('id', selectedUnit.id);
      if (error) throw error;
      setShowManageModal(false);
      fetchProperties();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCleanerSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanerData = editingCleaner ? {
        name: editingCleaner.name,
        phone: editingCleaner.phone,
        role: editingCleaner.role,
        head_cleaner_id: editingCleaner.head_cleaner_id || null
      } : {
        name: newCleaner.name,
        phone: newCleaner.phone,
        role: newCleaner.role,
        head_cleaner_id: newCleaner.head_cleaner_id || null
      };

      if (editingCleaner) {
        const { error } = await supabase.from('cleaners').update(cleanerData).eq('id', editingCleaner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cleaners').insert([cleanerData]);
        if (error) throw error;
      }

      setShowCleanerModal(false);
      setNewCleaner({ name: '', phone: '', role: 'cleaner', head_cleaner_id: '' });
      setEditingCleaner(null);
      fetchCleaners();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  const openAssignModal = (booking) => {
    console.log('Opening assign modal for:', booking);
    const unit = properties.find(p => String(p.id) === String(booking.propertyId));
    setSelectedUnit(unit);
    setSelectedBooking(booking);
    setShowAssignModal(true);
  };

  async function handleAssignCleaner(cleanerId) {
    if (!selectedBooking) {
      alert('Error: No booking selected');
      return;
    }
    setLoading(true);
    try {
      // Use consistent date string format (YYYY-MM-DD)
      const end = new Date(selectedBooking.end);
      const checkoutDate = end.toISOString().split('T')[0];
      const propertyId = selectedBooking.propertyId;

      console.log('Assigning task:', { propertyId, checkoutDate, cleanerId });

      const { error } = await supabase.from('cleaning_tasks').insert([{
        property_id: propertyId,
        checkout_date: checkoutDate,
        cleaner_id: cleanerId,
        status: 'pending',
        checklist: [
          { task: 'Change bedsheet & pillow covers', done: false },
          { task: 'Clean bathroom & refill toiletries', done: false },
          { task: 'Vacuum & mop floors', done: false },
          { task: 'Check for damages/left items', done: false }
        ]
      }]);

      if (error) throw error;

      setShowAssignModal(false);
      await fetchCleaningTasks();
      alert('Cleaner assigned successfully!');
    } catch (err) {
      console.error('Assignment error:', err);
      alert('Error assigning cleaner: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTaskUpdate(taskId, updates) {
    const { error } = await supabase.from('cleaning_tasks').update(updates).eq('id', taskId);
    if (!error) {
      if (selectedTask?.id === taskId) setSelectedTask({ ...selectedTask, ...updates });
      fetchCleaningTasks();
    }
  }

  async function handleToggleChecklist(itemIdx) {
    const newChecklist = [...selectedTask.checklist];
    newChecklist[itemIdx].done = !newChecklist[itemIdx].done;

    const allDone = newChecklist.every(i => i.done);
    const updates = {
      checklist: newChecklist,
      status: allDone ? 'completed' : 'pending',
      completed_at: allDone ? new Date().toISOString() : null
    };

    handleTaskUpdate(selectedTask.id, updates);
  }

  async function handleImageUpload() {
    const dummyUrl = `https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&q=80`;
    const newImages = [...(selectedTask.proof_images || []), dummyUrl].slice(0, 3);
    handleTaskUpdate(selectedTask.id, { proof_images: newImages });
  }

  async function syncAirbnb(unit) {
    if (!unit.ical_url) {
      alert('Please add an Airbnb iCal link first.');
      return;
    }
    setLoading(true);
    try {
      const proxyUrl = `/fetch-ical?url=${encodeURIComponent(unit.ical_url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
      const data = await response.text();
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

          if (summary === 'Reserved' && endDate >= now) {
            bookings.push({ start: startDate.toISOString(), end: endDate.toISOString(), summary: 'Guest Booking' });
            if (!latestCheckout || (endDate > now && endDate < latestCheckout)) latestCheckout = endDate;
          }
        }
      });

      bookings.sort((a, b) => new Date(a.start) - new Date(b.start));
      const updateData = { bookings };
      if (latestCheckout) {
        const formattedDate = latestCheckout.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        updateData.checkout_time = `12:00 PM (${formattedDate})`;
      }

      await supabase.from('properties').update(updateData).eq('id', unit.id);
      alert(`Synced successfully! ${bookings.length} bookings found.`);
      fetchProperties();
    } catch (err) {
      alert(`Sync Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Mobile Sidebar */}
      <div className={`fixed inset-0 z-50 md:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <aside className={`absolute inset-y-0 left-0 w-64 bg-white shadow-2xl p-6 flex flex-col transition-transform duration-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-airbnb" />
              <h1 className="text-xl font-extrabold tracking-tight">OPS AIRBNB</h1>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-slate-400"><Plus className="rotate-45" size={24} /></button>
          </div>
          <nav className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 px-3 tracking-widest">Main</div>
            <button onClick={() => { setView('dashboard'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${view === 'dashboard' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}>
              <LayoutDashboard size={20} /> <span className="font-semibold text-sm">Dashboard</span>
            </button>
            <button onClick={() => { setView('calendar'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${view === 'calendar' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Calendar size={20} /> <span className="font-semibold text-sm">Calendar</span>
            </button>
            <button onClick={() => { setView('cleaners'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${view === 'cleaners' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}>
              <Users size={20} /> <span className="font-semibold text-sm">Cleaners</span>
            </button>
            <div className="pt-6 text-[10px] uppercase font-bold text-slate-400 mb-2 px-3 tracking-widest">Areas</div>
            {['all', 'Shah Alam', 'Puchong'].map(area => (
              <button key={area} onClick={() => { setFilterArea(area); setView('dashboard'); setSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${filterArea === area && view === 'dashboard' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                <MapPin size={20} /> <span className="font-semibold text-sm">{area === 'all' ? 'All Areas' : area}</span>
              </button>
            ))}
          </nav>
        </aside>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 p-6 flex-col">
        <div className="flex items-center gap-3 mb-10">
          <Sparkles className="w-8 h-8 text-airbnb" />
          <h1 className="text-xl font-extrabold tracking-tight">OPS AIRBNB</h1>
        </div>
        <nav className="space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-400 mb-2 px-3 tracking-widest">Main</div>
          <button onClick={() => { setView('dashboard'); setFilterArea('all'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${view === 'dashboard' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}>
            <LayoutDashboard size={20} /> <span className="font-semibold text-sm">Dashboard</span>
          </button>
          <button onClick={() => { setView('calendar'); setFilterArea('all'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${view === 'calendar' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Calendar size={20} /> <span className="font-semibold text-sm">Calendar</span>
          </button>
          <button onClick={() => { setView('cleaners'); setFilterArea('all'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${view === 'cleaners' ? 'bg-airbnb text-white shadow-lg shadow-airbnb/20' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Users size={20} /> <span className="font-semibold text-sm">Cleaners</span>
          </button>
          <div className="pt-6 text-[10px] uppercase font-bold text-slate-400 mb-2 px-3 tracking-widest">Areas</div>
          {['all', 'Shah Alam', 'Puchong'].map(area => (
            <button key={area} onClick={() => { setFilterArea(area); setView('dashboard'); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ${filterArea === area && view === 'dashboard' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
              <MapPin size={20} /> <span className="font-semibold text-sm">{area === 'all' ? 'All Areas' : area}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 min-h-screen">
        <div className="max-w-7xl mx-auto w-full p-4 md:p-8">
          {view === 'dashboard' && (
            <>
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-white rounded-lg"><Menu size={24} /></button>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Operations Dashboard</h2>
                    <p className="text-slate-500 text-sm font-medium">Viewing focus: <span className="text-airbnb capitalize">{filterArea}</span></p>
                  </div>
                </div>
                <button onClick={() => setShowNewTaskModal(true)} className="w-full md:w-auto bg-airbnb text-white px-6 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-airbnb/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  <Plus size={20} strokeWidth={3} /> New Task
                </button>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
                {properties.filter(p => filterArea === 'all' || p.area === filterArea).map((property) => {
                  const nextBooking = (property.bookings || [])
                    .filter(b => new Date(b.end) >= new Date())
                    .sort((a, b) => new Date(a.end) - new Date(b.end))[0];

                  const task = nextBooking ? cleaningTasks.find(t =>
                    String(t.property_id) === String(property.id) &&
                    t.checkout_date === new Date(nextBooking.end).toISOString().split('T')[0]
                  ) : null;

                  return (
                    <div key={property.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 p-8 flex flex-col h-full transform transition-all hover:shadow-2xl">
                      {/* Top Tags */}
                      <div className="flex justify-between items-center mb-6">
                        <span className="px-4 py-1.5 bg-sky-50 text-sky-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-sky-100">{property.area}</span>
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${property.status === 'Ready' ? 'bg-amber-50 text-amber-500 border-amber-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                          {property.status === 'Ready' ? 'READY' : property.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-3xl font-black text-slate-900 mb-6">{property.name}</h3>

                      {/* Details Row */}
                      <div className="space-y-4 mb-10 flex-grow">
                        <div className="flex items-center gap-4 text-slate-500">
                          <Clock className="text-airbnb" size={20} />
                          <div>
                            <span className="text-sm font-bold">Checkout: </span>
                            <span className="text-sm font-black text-slate-700">
                              {nextBooking
                                ? `${property.checkout_time || '12:00 PM'} (${new Date(nextBooking.end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})`
                                : '12:00 PM (No upcoming)'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-slate-500">
                          <User className="text-airbnb" size={20} />
                          <div>
                            <span className="text-sm font-bold">Assignee: </span>
                            <span className="text-sm font-black text-slate-700">
                              {task ? task.cleaners?.name : 'Unassigned'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">PRIORITY: {property.priority || 'NORMAL'}</span>
                        <div className="flex gap-6">
                          <button
                            onClick={() => syncAirbnb(property)}
                            disabled={loading}
                            className="flex items-center gap-2 text-xs font-black text-airbnb hover:opacity-70 transition-all uppercase tracking-widest"
                          >
                            <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
                            SYNC
                          </button>
                          <button
                            onClick={() => { setSelectedUnit(property); setShowManageModal(true); }}
                            className="text-xs font-black text-airbnb hover:opacity-70 transition-all uppercase tracking-widest"
                          >
                            Manage Unit
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {view === 'calendar' && (
            <>
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-white rounded-lg"><Menu size={24} /></button>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Cleaning Schedule</h2>
                    <p className="text-slate-500 text-sm font-medium">Consolidated across all units</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setLoading(true);
                    for (const p of properties) if (p.ical_url) await syncAirbnb(p);
                    setLoading(false);
                  }}
                  className="w-full md:w-auto border-2 border-slate-200 text-slate-700 px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:border-airbnb hover:text-airbnb transition-all"
                >
                  <RotateCw size={18} className={loading ? 'animate-spin' : ''} /> Sync All
                </button>
              </header>

              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
                {(() => {
                  const allBookings = properties.flatMap(p => (p.bookings || []).map(b => ({ ...b, propertyName: p.name, propertyArea: p.area, propertyId: p.id })))
                    .sort((a, b) => new Date(a.end) - new Date(b.end));

                  if (allBookings.length === 0) return <div className="p-20 text-center text-slate-500 font-bold">No bookings found. Sync calendars!</div>;

                  return allBookings.map((booking, idx) => {
                    const end = new Date(booking.end);
                    const isToday = new Date().toDateString() === end.toDateString();
                    const task = cleaningTasks.find(t =>
                      String(t.property_id) === String(booking.propertyId) &&
                      t.checkout_date === end.toISOString().split('T')[0]
                    );

                    return (
                      <div key={idx} className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors ${isToday ? 'bg-airbnb/5 border-l-4 border-l-airbnb' : ''}`}>
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center border ${isToday ? 'bg-airbnb border-airbnb text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
                            <span className="text-[10px] font-bold uppercase">{end.toLocaleDateString('en-GB', { month: 'short' })}</span>
                            <span className="text-lg font-black">{end.getDate()}</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">{booking.propertyName}</h4>
                            <p className="text-sm text-slate-500 mt-1">Stay: {new Date(booking.start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - {end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {task ? (
                            <button onClick={() => { setSelectedTask(task); setShowTaskModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:border-airbnb transition-all">
                              <User size={14} className="text-airbnb" />
                              <span className="text-sm font-bold text-slate-700">{task.cleaners?.name}</span>
                              {task.status === 'completed' ? <ShieldCheck size={14} className="text-green-500" /> : <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                            </button>
                          ) : (
                            <button
                              onClick={() => openAssignModal(booking)}
                              className="border-2 border-airbnb/20 text-airbnb hover:bg-airbnb hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                            >
                              Assign Cleaner
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </>
          )}

          {view === 'cleaners' && (
            <>
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-white rounded-lg"><Menu size={24} /></button>
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Cleaners</h2>
                </div>
                <button onClick={() => { setEditingCleaner(null); setShowCleanerModal(true); }} className="w-full md:w-auto bg-airbnb text-white px-6 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-airbnb/20 transition-all">
                  <Plus size={20} strokeWidth={3} /> Add Cleaner
                </button>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cleaners.map(cleaner => (
                  <div key={cleaner.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all relative overflow-hidden">
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${cleaner.role === 'head_cleaner' ? 'bg-slate-900' : 'bg-airbnb'}`}>
                        {cleaner.role === 'head_cleaner' ? <ShieldCheck size={28} /> : <User size={28} />}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 leading-tight">{cleaner.name}</h4>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{cleaner.role.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="space-y-2 pt-4 border-t border-slate-50 text-sm">
                      <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase text-[10px]">Phone</span><span className="text-slate-900 font-black">{cleaner.phone || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-400 font-bold uppercase text-[10px]">Supervisor</span><span className="text-slate-900 font-black">{cleaner.head_cleaner_id ? cleaners.find(c => c.id === cleaner.head_cleaner_id)?.name : 'Admin'}</span></div>
                    </div>
                    <div className="mt-6 flex gap-2">
                      <button onClick={() => { setEditingCleaner(cleaner); setShowCleanerModal(true); }} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase hover:bg-slate-200">Edit</button>
                      <button onClick={async () => { if (confirm('Delete cleaner?')) { await supabase.from('cleaners').delete().eq('id', cleaner.id); fetchCleaners(); } }} className="w-12 h-10 flex items-center justify-center border border-rose-100 text-rose-500 rounded-xl hover:bg-rose-50"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      {showNewTaskModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
            <h3 className="text-2xl font-bold mb-6">New Property</h3>
            <form onSubmit={handleAddUnit} className="space-y-4">
              <input type="text" required placeholder="Unit Name" className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={newUnit.name} onChange={e => setNewUnit({ ...newUnit, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={newUnit.area} onChange={e => setNewUnit({ ...newUnit, area: e.target.value })}><option>Shah Alam</option><option>Puchong</option></select>
                <select className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={newUnit.priority} onChange={e => setNewUnit({ ...newUnit, priority: e.target.value })}><option>Normal</option><option>High</option></select>
              </div>
              <input type="text" placeholder="iCal URL" className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={newUnit.ical_url} onChange={e => setNewUnit({ ...newUnit, ical_url: e.target.value })} />
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowNewTaskModal(false)} className="flex-1 bg-slate-100 py-4 rounded-xl font-bold">Cancel</button><button type="submit" disabled={loading} className="flex-1 bg-airbnb text-white py-4 rounded-xl font-bold">Add Unit</button></div>
            </form>
          </div>
        </div>
      )}

      {showManageModal && selectedUnit && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
            <h3 className="text-2xl font-bold mb-6">Manage Unit</h3>
            <form onSubmit={handleUpdateUnit} className="space-y-4">
              <input type="text" required className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={selectedUnit.name} onChange={e => setSelectedUnit({ ...selectedUnit, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={selectedUnit.area} onChange={e => setSelectedUnit({ ...selectedUnit, area: e.target.value })}><option>Shah Alam</option><option>Puchong</option></select>
                <select className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={selectedUnit.priority} onChange={e => setSelectedUnit({ ...selectedUnit, priority: e.target.value })}><option>Normal</option><option>High</option></select>
              </div>
              <select className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={selectedUnit.status} onChange={e => setSelectedUnit({ ...selectedUnit, status: e.target.value })}><option>Ready</option><option>Cleaning</option><option>Maintenance</option></select>
              <input type="text" placeholder="iCal URL" className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={selectedUnit.ical_url || ''} onChange={e => setSelectedUnit({ ...selectedUnit, ical_url: e.target.value })} />
              <div className="flex gap-3 pt-4"><button type="button" onClick={handleDeleteUnit} className="flex-1 bg-rose-50 text-rose-500 py-4 rounded-xl font-bold">Delete</button><button type="submit" className="flex-1 bg-airbnb text-white py-4 rounded-xl font-bold">Save</button></div>
              <button type="button" onClick={() => setShowManageModal(false)} className="w-full text-slate-400 font-bold py-2">Close</button>
            </form>
          </div>
        </div>
      )}

      {showCleanerModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
            <h3 className="text-2xl font-bold mb-6">{editingCleaner ? 'Edit Cleaner' : 'New Cleaner'}</h3>
            <form onSubmit={handleCleanerSubmit} className="space-y-4">
              <input type="text" required placeholder="Name" className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={editingCleaner ? editingCleaner.name : newCleaner.name} onChange={e => editingCleaner ? setEditingCleaner({ ...editingCleaner, name: e.target.value }) : setNewCleaner({ ...newCleaner, name: e.target.value })} />
              <input type="text" placeholder="Phone" className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={editingCleaner ? editingCleaner.phone : newCleaner.phone} onChange={e => editingCleaner ? setEditingCleaner({ ...editingCleaner, phone: e.target.value }) : setNewCleaner({ ...newCleaner, phone: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <select className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={editingCleaner ? editingCleaner.role : newCleaner.role} onChange={e => editingCleaner ? setEditingCleaner({ ...editingCleaner, role: e.target.value }) : setNewCleaner({ ...newCleaner, role: e.target.value })}><option value="cleaner">Cleaner</option><option value="head_cleaner">Head Cleaner</option></select>
                <select className="w-full bg-slate-50 border rounded-xl px-4 py-3" value={editingCleaner ? (editingCleaner.head_cleaner_id || '') : newCleaner.head_cleaner_id} onChange={e => editingCleaner ? setEditingCleaner({ ...editingCleaner, head_cleaner_id: e.target.value }) : setNewCleaner({ ...newCleaner, head_cleaner_id: e.target.value })}><option value="">None (Admin)</option>{cleaners.filter(c => c.role === 'head_cleaner' && c.id !== editingCleaner?.id).map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}</select>
              </div>
              <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowCleanerModal(false)} className="flex-1 bg-slate-100 py-4 rounded-xl font-bold">Cancel</button><button type="submit" className="flex-1 bg-airbnb text-white py-4 rounded-xl font-bold">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAssignModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-bold mb-2">Assign Cleaner</h3>
            <p className="text-sm text-slate-500 mb-6">
              {selectedUnit?.name || 'Unit'} - {selectedBooking?.end ? new Date(selectedBooking.end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Date'}
            </p>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {cleaners.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleAssignCleaner(c.id)}
                  className="w-full flex items-center justify-between p-4 border rounded-2xl hover:bg-airbnb/5 hover:border-airbnb transition-all text-left"
                >
                  <span className="font-bold">{c.name}</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">{c.role.replace('_', ' ')}</span>
                </button>
              ))}
              {cleaners.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-slate-500 italic mb-4">No cleaners available.</p>
                  <button onClick={() => { setView('cleaners'); setShowAssignModal(false); }} className="text-airbnb font-bold text-sm underline">Add Team Member</button>
                </div>
              )}
            </div>
            <button onClick={() => setShowAssignModal(false)} className="w-full mt-6 py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {showTaskModal && selectedTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6"><div><h3 className="text-2xl font-bold">Checklist</h3><p className="text-xs text-slate-400 uppercase font-black">{selectedTask.cleaners?.name}</p></div><button onClick={() => setShowTaskModal(false)} className="text-slate-400"><X size={24} /></button></div>
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-2xl border mb-6">
                {selectedTask.checklist?.map((item, idx) => (
                  <button key={idx} onClick={() => handleToggleChecklist(idx)} className="w-full flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${item.done ? 'bg-green-500 text-white' : 'bg-white border-2'}`}>{item.done && <CheckCircle size={14} />}</div>
                    <span className={`text-sm font-bold ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.task}</span>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-3 text-center">Proof of Cleaning</label>
                <div className="grid grid-cols-3 gap-3">
                  {selectedTask.proof_images?.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group">
                      <img src={url} className="w-full h-full object-cover" />
                      <button onClick={() => handleTaskUpdate(selectedTask.id, { proof_images: selectedTask.proof_images.filter((_, i) => i !== idx) })} className="absolute top-1 right-1 bg-white p-1 rounded-md text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                    </div>
                  ))}
                  {(selectedTask.proof_images || []).length < 3 && <button onClick={handleImageUpload} className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-slate-400 hover:border-airbnb hover:text-airbnb transition-all"><Image size={20} /><span className="text-[10px] font-bold mt-1">Upload</span></button>}
                </div>
              </div>
              {selectedTask.status === 'completed' && <div className="mt-8 p-4 bg-green-50 rounded-2xl text-green-700 text-center font-bold text-sm">Successfully Verified & Completed</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
