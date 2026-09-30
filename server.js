// ============================================================
// Feedback Hub Admin Panel — Node.js + Express
// ============================================================
// 1. npm install
// 2. Skopiuj .env.example -> .env i wypełnij dane
// 3. npm start
// 4. Otwórz http://localhost:3000
// ============================================================

require('dotenv').config();

// Fix: Node.js 20 nie ma natywnego WebSocket
global.WebSocket = require('ws');
const express = require('express');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Supabase (service role = pełen dostęp do danych) ──
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ── Middleware ──
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'zmien-to-w-produkcji!',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24h
}));

// ── Dane pomocnicze ──
const TYPE_LABELS = {
  bug: '🐛 Błąd techniczny',
  feature_request: '💡 Propozycja zmiany',
  content_error: '📝 Błąd w treści',
  other: '📋 Inne'
};

const STATUS_LABELS = {
  new: '⏳ Nowe',
  in_progress: '🔄 W trakcie',
  resolved: '✅ Rozwiązane',
  rejected: '❌ Odrzucone',
  closed: '🔒 Zamknięte'
};

const STATUS_COLORS = {
  new: '#f59e0b',
  in_progress: '#3b82f6',
  resolved: '#10b981',
  rejected: '#ef4444',
  closed: '#6b7280'
};

const PRIORITY_LABELS = {
  low: 'Niski',
  medium: 'Średni',
  high: 'Wysoki',
  critical: 'Krytyczny'
};

// ── Auth middleware ──
function requireAuth(req, res, next) {
  if (req.session.isAdmin) return next();
  res.redirect('/login');
}

// ═══════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════

// ── Logowanie ──
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/');
  }
  res.render('login', { error: 'Nieprawidłowe hasło' });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── Dashboard (lista zgłoszeń) ──
app.get('/', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = 20;
    const statusFilter = req.query.status || '';
    const sourceFilter = req.query.source || '';
    const typeFilter = req.query.type || '';
    const priorityFilter = req.query.priority || '';

    let query = supabase
      .from('feedback_reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);

    if (statusFilter) query = query.eq('status', statusFilter);
    if (sourceFilter) query = query.eq('source', sourceFilter);
    if (typeFilter) query = query.eq('type', typeFilter);
    if (priorityFilter) query = query.eq('priority', priorityFilter);

    const { data: reports, error, count } = await query;
    if (error) throw error;

    const totalPages = Math.ceil((count || 0) / perPage);

    // Podpisane URL-e do zrzutów (ważne 1h)
    const reportsWithScreenshots = await Promise.all(
      (reports || []).map(async (r) => {
        if (r.screenshot_url) {
          const { data } = await supabase.storage
            .from('feedback-screenshots')
            .createSignedUrl(r.screenshot_url, 3600);
          return { ...r, screenshot_signed_url: data?.signedUrl || null };
        }
        return { ...r, screenshot_signed_url: null };
      })
    );

    // Statystyki
    const { data: stats } = await supabase
      .from('feedback_reports')
      .select('status');

    const statusCounts = { new: 0, in_progress: 0, resolved: 0, rejected: 0, closed: 0 };
    (stats || []).forEach(s => { if (statusCounts[s.status] !== undefined) statusCounts[s.status]++ });

    res.render('dashboard', {
      reports: reportsWithScreenshots,
      page, totalPages, count,
      statusFilter, sourceFilter, typeFilter, priorityFilter,
      TYPE_LABELS, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS,
      statusCounts,
      query: req.query
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).render('error', { message: err.message });
  }
});

// ── Szczegóły zgłoszenia ──
app.get('/report/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: report, error } = await supabase
      .from('feedback_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !report) return res.status(404).render('error', { message: 'Zgłoszenie nie znaleziono' });

    // Signed URL dla zrzutu
    let screenshotSignedUrl = null;
    if (report.screenshot_url) {
      const { data } = await supabase.storage
        .from('feedback-screenshots')
        .createSignedUrl(report.screenshot_url, 3600);
      screenshotSignedUrl = data?.signedUrl || null;
    }

    res.render('detail', {
      report,
      screenshotSignedUrl,
      TYPE_LABELS, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS
    });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
});

// ── Aktualizacja zgłoszenia ──
app.post('/report/:id/update', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, admin_notes, assigned_to } = req.body;

    const updates = {};
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (admin_notes !== undefined) updates.admin_notes = admin_notes;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;

    if ((status === 'resolved' || status === 'closed') && !updates.resolved_at) {
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('feedback_reports')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    res.redirect(`/report/${id}`);
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
});

// ── Usuwanie zgłoszenia ──
app.post('/report/:id/delete', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Pobierz ścieżkę zrzutu przed usunięciem
    const { data: report } = await supabase
      .from('feedback_reports')
      .select('screenshot_url')
      .eq('id', id)
      .single();

    if (report?.screenshot_url) {
      await supabase.storage.from('feedback-screenshots').remove([report.screenshot_url]);
    }

    await supabase.from('feedback_reports').delete().eq('id', id);
    res.redirect('/');
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
});

// ── API: Pobierz zgłoszenia jako JSON (opcjonalnie) ──
app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('feedback_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`✅ Feedback Hub Admin działa na http://localhost:${PORT}`);
  console.log(`🔐 Hasło admina: ${process.env.ADMIN_PASSWORD ? '*** ustawione ***' : 'BRAK — ustaw w .env!'}`);
});
