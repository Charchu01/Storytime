// ── Admin Logger Utility ─────────────────────────────────────────────────────
// Central logging to Supabase for the admin dashboard.
// Replaces the old Vercel KV implementation.

import { supabaseAdmin } from './supabase-admin.js';

const sb = supabaseAdmin; // shorthand

// ── Book Logging ─────────────────────────────────────────────────────────────
// Updates an existing book record with health_status, or logs to activity_log.
// The book must already exist in Supabase (saved via save-book.js).

export async function logBook(bookData) {
  if (!sb) {
    console.warn('admin-logger: Supabase not configured, skipping logBook');
    return null;
  }
  try {
    const bookId = bookData.supabaseBookId || bookData.bookId;

    // If we have a Supabase UUID, update the book record with health status
    if (bookData.supabaseBookId) {
      await sb.from('books')
        .update({ health_status: bookData.status || 'healthy' })
        .eq('id', bookData.supabaseBookId);
    }

    // Log event to activity_log
    await logEvent('book_completed', {
      bookId,
      title: bookData.title || 'Untitled',
      tier: bookData.tier || 'standard',
      style: bookData.style || 'unknown',
      status: bookData.status || 'healthy',
    });

    return bookId;
  } catch (err) {
    console.error('Admin logger - logBook error:', err.message, err.stack);
    return null;
  }
}

// ── API Call Logging ─────────────────────────────────────────────────────────

export async function logApiCall(callData) {
  if (!sb) return;
  try {
    const record = {
      service: callData.service,
      call_type: callData.type,
      book_id: callData.bookId || null,
      status: callData.status || 200,
      duration_ms: callData.durationMs || 0,
      model: callData.model || null,
      cost: callData.cost || 0,
      error: callData.error || null,
      details: callData.details || null,
    };

    await sb.from('admin_api_calls').insert(record);

    // Log errors specially
    if (callData.error || (callData.status && callData.status >= 400)) {
      await logError({
        service: callData.service,
        type: callData.type,
        bookId: callData.bookId,
        error: callData.error || `HTTP ${callData.status}`,
        details: callData.details,
      });
    }

    return record;
  } catch (err) {
    console.error('Admin logger - logApiCall error:', err.message);
    return null;
  }
}

// ── Error Logging ────────────────────────────────────────────────────────────

export async function logError(errorData) {
  if (!sb) return;
  try {
    await sb.from('admin_errors').insert({
      service: errorData.service || 'unknown',
      error_type: errorData.type || 'error',
      book_id: errorData.bookId || null,
      error: errorData.error || 'Unknown error',
      details: errorData.details || null,
    });
  } catch (err) {
    console.error('Admin logger - logError error:', err.message);
  }
}

// ── Event Logging (Activity Feed) ────────────────────────────────────────────

export async function logEvent(type, data) {
  if (!sb) return;
  try {
    await sb.from('activity_log').insert({
      event_type: type,
      severity: type.includes('failed') || type.includes('error') ? 'error' : 'info',
      message: formatEventMessage(type, data),
      book_id: data.bookId || null,
      user_id: data.userId || null,
    });
  } catch (err) {
    console.error('Admin logger - logEvent error:', err.message);
  }
}

function formatEventMessage(type, data) {
  switch (type) {
    case 'book_completed':
      return `Book completed: "${data.title}" (${data.tier}, ${data.style}) — ${data.status}`;
    case 'payment_received':
      return `Payment received: $${data.amount} (${data.tier})`;
    case 'payment_failed':
      return `Payment failed: $${data.amount} (${data.tier})`;
    case 'validation_retry':
      return `Validation retry: page ${data.page} (text: ${data.textScore}, face: ${data.faceScore})`;
    case 'user_feedback':
      return `User feedback: ${data.stars} stars (${data.reaction || 'no reaction'})`;
    default:
      return `${type}: ${JSON.stringify(data).slice(0, 200)}`;
  }
}

// ── Revenue Logging ──────────────────────────────────────────────────────────
// Revenue is now derived from the books table (tier → price mapping).
// This function logs payment events for the activity feed.

export async function logRevenue(paymentData) {
  if (!sb) return;
  try {
    await logEvent(
      paymentData.status === 'succeeded' ? 'payment_received' : 'payment_failed',
      {
        amount: paymentData.amount,
        tier: paymentData.tier,
        sessionId: paymentData.sessionId,
        stripeId: paymentData.stripeId,
      }
    );
  } catch (err) {
    console.error('Admin logger - logRevenue error:', err.message);
  }
}

// ── Validation Logging ───────────────────────────────────────────────────────

export async function logValidation(validationData) {
  if (!sb) return;
  try {
    const record = {
      book_id: validationData.bookId || null,
      page: validationData.page || 'unknown',
      attempt: validationData.attempt || 1,
      text_score: validationData.textScore || 0,
      face_score: validationData.faceScore || 0,
      scene_accuracy: validationData.sceneAccuracy || 0,
      text_box_score: validationData.textBoxScore || null,
      format_ok: validationData.formatOk !== false,
      pass: validationData.pass || false,
      issues: validationData.issues || [],
      fix_notes: validationData.fixNotes || '',
      likeness_score: validationData.likenessScore || null,
      fingers_ok: validationData.fingersOk !== false,
      character_count: validationData.characterCount || null,
      quality_tier: validationData.qualityTier || null,
      composite_score: validationData.compositeScore || null,
    };

    await sb.from('admin_validations').insert(record);

    if (!record.pass) {
      await logEvent('validation_retry', {
        bookId: record.book_id,
        page: record.page,
        textScore: record.text_score,
        faceScore: record.face_score,
        issues: record.issues,
      });
    }

    return record;
  } catch (err) {
    console.error('Admin logger - logValidation error:', err.message);
    return null;
  }
}

// ── Post-Game Analysis Logging ───────────────────────────────────────────────

export async function logPostGameAnalysis(bookId, analysis) {
  if (!sb) return;
  try {
    await sb.from('admin_postgame').upsert({
      book_id: bookId,
      overall_score: analysis.overallScore || null,
      would_recommend: analysis.wouldRecommend || false,
      scores: analysis.scores || null,
      top_issue: analysis.topIssue || null,
      data: analysis,
    }, { onConflict: 'book_id' });

    return true;
  } catch (err) {
    console.error('Admin logger - logPostGameAnalysis error:', err.message);
    return false;
  }
}

// ── User Logging ─────────────────────────────────────────────────────────────
// Users are already managed by save-book.js (find/create user by clerk_id).
// This function is kept for backward compat but is now a no-op for most fields
// since Supabase users table + increment_user_books RPC handles it.

export async function logUser(userData) {
  // User stats are managed by save-book.js and the increment_user_books RPC.
  // Nothing extra to do here — the Supabase users table is the source of truth.
  return null;
}

// ── Daily Stats ──────────────────────────────────────────────────────────────
// Daily stats are now computed via SQL aggregation in admin.js queries.
// No need to maintain a separate stats record.

export async function updateDailyApiStats(service, durationMs, cost, isError) {
  // Now handled via admin_api_calls table — just insert the call record.
  return logApiCall({
    service,
    type: 'aggregate',
    durationMs,
    cost,
    status: isError ? 500 : 200,
    error: isError ? 'error' : null,
  });
}

// ── Config Management ────────────────────────────────────────────────────────

export async function getConfig(key, defaultValue) {
  if (!sb) return defaultValue;
  try {
    const { data } = await sb.from('admin_config')
      .select('value')
      .eq('key', `config:${key}`)
      .single();
    return data?.value !== null && data?.value !== undefined ? data.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setConfig(key, value) {
  if (!sb) return false;
  try {
    await sb.from('admin_config').upsert({
      key: `config:${key}`,
      value: JSON.stringify(value) === value ? value : value,
      updated_at: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

// ── Prompt Override Management ───────────────────────────────────────────────

export async function getPromptOverride(section) {
  if (!sb) return null;
  try {
    const { data } = await sb.from('admin_config')
      .select('value')
      .eq('key', `prompt:${section}`)
      .single();
    return data?.value || null;
  } catch {
    return null;
  }
}

export async function setPromptOverride(section, text) {
  if (!sb) return false;
  try {
    if (text === null || text === '') {
      await sb.from('admin_config').delete().eq('key', `prompt:${section}`);
    } else {
      await sb.from('admin_config').upsert({
        key: `prompt:${section}`,
        value: text,
        updated_at: new Date().toISOString(),
      });
    }
    return true;
  } catch {
    return false;
  }
}

// ── Experiment Management ────────────────────────────────────────────────────

export async function getActiveExperiment(target) {
  if (!sb) return null;
  try {
    const { data } = await sb.from('admin_experiments')
      .select('*')
      .eq('status', 'running')
      .eq('target', target)
      .limit(1)
      .single();
    return data || null;
  } catch {
    return null;
  }
}

export async function logExperimentBookResult(experimentId, variant, scores) {
  if (!sb) return false;
  try {
    const { data: exp } = await sb.from('admin_experiments')
      .select('*')
      .eq('id', experimentId)
      .single();
    if (!exp) return false;

    const v = variant === 'B' ? exp.variant_b : exp.variant_a;
    v.bookCount = (v.bookCount || 0) + 1;

    if (scores.textScore !== undefined) {
      v.avgTextScore = ((v.avgTextScore || 0) * (v.bookCount - 1) + scores.textScore) / v.bookCount;
    }
    if (scores.overallScore !== undefined) {
      v.avgOverall = ((v.avgOverall || 0) * (v.bookCount - 1) + scores.overallScore) / v.bookCount;
    }

    await sb.from('admin_experiments')
      .update({
        [variant === 'B' ? 'variant_b' : 'variant_a']: v,
        updated_at: new Date().toISOString(),
      })
      .eq('id', experimentId);

    return true;
  } catch {
    return false;
  }
}

// ── User Feedback Logging ────────────────────────────────────────────────────

export async function logUserFeedback(bookId, feedback) {
  if (!sb) return false;
  try {
    await sb.from('admin_feedback').insert({
      book_id: bookId,
      stars: feedback.stars || 0,
      reaction: feedback.reaction || null,
      comment: feedback.comment || null,
    });

    await logEvent('user_feedback', {
      bookId,
      stars: feedback.stars,
      reaction: feedback.reaction,
    });

    return true;
  } catch (err) {
    console.error('Admin logger - logUserFeedback error:', err.message);
    return false;
  }
}
