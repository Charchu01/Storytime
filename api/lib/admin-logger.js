import { kv } from '@vercel/kv';

// ── Admin Logger Utility ─────────────────────────────────────────────────────
// Central logging to Vercel KV for the admin dashboard.
// All admin data uses structured keys for efficient querying.

const SEVEN_DAYS = 7 * 24 * 60 * 60; // TTL for API call logs
const MAX_EVENTS = 200; // Max events in activity feed

// ── Book Logging ─────────────────────────────────────────────────────────────

export async function logBook(bookData) {
  try {
    const bookId = bookData.bookId || `book_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      bookId,
      createdAt: new Date().toISOString(),
      userId: bookData.userId || null,
      userEmail: bookData.userEmail || null,
      tier: bookData.tier || 'standard',
      style: bookData.style || 'unknown',
      bookType: bookData.bookType || 'adventure',
      tone: bookData.tone || null,
      pageCount: bookData.pageCount || 6,
      heroName: bookData.heroName || 'Unknown',
      heroAge: bookData.heroAge || null,
      heroType: bookData.heroType || 'child',
      hasPhoto: bookData.hasPhoto || false,
      characterCount: bookData.characterCount || 1,
      totalDurationMs: bookData.totalDurationMs || 0,
      totalCost: bookData.totalCost || 0,
      status: bookData.status || 'healthy',
      phases: bookData.phases || {},
      costs: bookData.costs || {},
      validations: bookData.validations || [],
      modelsUsed: bookData.modelsUsed || {},
      images: bookData.images || {},
      title: bookData.title || 'Untitled',
      dedication: bookData.dedication || null,
      storyTexts: bookData.storyTexts || [],
      assembledPrompts: bookData.assembledPrompts || {},
      claudeResponse: bookData.claudeResponse || null,
    };

    await kv.set(`admin:books:${bookId}`, record);

    // Add to book index (sorted set by timestamp)
    await kv.zadd('admin:books_index', {
      score: Date.now(),
      member: bookId,
    });

    // Log event
    await logEvent('book_completed', {
      bookId,
      title: record.title,
      tier: record.tier,
      style: record.style,
      status: record.status,
    });

    // Update daily stats
    await updateDailyStats(record);

    return bookId;
  } catch (err) {
    console.error('Admin logger - logBook error:', err.message, err.stack);
    return null;
  }
}

// ── API Call Logging ─────────────────────────────────────────────────────────

export async function logApiCall(callData) {
  try {
    const ts = Date.now();
    const record = {
      ts,
      service: callData.service, // 'anthropic', 'replicate', 'stripe', 'elevenlabs'
      type: callData.type, // 'story', 'validation', 'cover', 'spread', 'narration', etc.
      bookId: callData.bookId || null,
      status: callData.status || 200,
      durationMs: callData.durationMs || 0,
      model: callData.model || null,
      cost: callData.cost || 0,
      error: callData.error || null,
      details: callData.details || null,
    };

    await kv.set(`admin:api_calls:${ts}`, record, { ex: SEVEN_DAYS });

    // Add to API calls index
    await kv.zadd('admin:api_calls_index', {
      score: ts,
      member: `${ts}`,
    });

    // Log errors specially
    if (callData.error || (callData.status && callData.status >= 400)) {
      await logError({
        ts,
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
  try {
    const ts = errorData.ts || Date.now();
    const record = {
      ts,
      service: errorData.service || 'unknown',
      type: errorData.type || 'error',
      bookId: errorData.bookId || null,
      error: errorData.error || 'Unknown error',
      details: errorData.details || null,
    };

    await kv.set(`admin:errors:${ts}`, record, { ex: SEVEN_DAYS });
    await kv.zadd('admin:errors_index', {
      score: ts,
      member: `${ts}`,
    });

    return record;
  } catch (err) {
    console.error('Admin logger - logError error:', err.message);
    return null;
  }
}

// ── Event Logging (Activity Feed) ────────────────────────────────────────────

export async function logEvent(type, data) {
  try {
    const event = {
      ts: Date.now(),
      type,
      ...data,
    };

    // Push to a capped list
    await kv.lpush('admin:events', JSON.stringify(event));
    await kv.ltrim('admin:events', 0, MAX_EVENTS - 1);

    return event;
  } catch (err) {
    console.error('Admin logger - logEvent error:', err.message);
    return null;
  }
}

// ── Revenue Logging ──────────────────────────────────────────────────────────

export async function logRevenue(paymentData) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `admin:revenue:${today}`;

    const existing = await kv.get(key) || {
      date: today,
      gross: 0,
      transactions: 0,
      failed: 0,
      byTier: { standard: { count: 0, revenue: 0 }, premium: { count: 0, revenue: 0 } },
    };

    if (paymentData.status === 'succeeded') {
      existing.gross += paymentData.amount || 0;
      existing.transactions += 1;
      const tier = paymentData.tier || 'standard';
      if (!existing.byTier[tier]) existing.byTier[tier] = { count: 0, revenue: 0 };
      existing.byTier[tier].count += 1;
      existing.byTier[tier].revenue += paymentData.amount || 0;
    } else {
      existing.failed += 1;
    }

    await kv.set(key, existing);

    // Log event
    await logEvent(
      paymentData.status === 'succeeded' ? 'payment_received' : 'payment_failed',
      {
        amount: paymentData.amount,
        tier: paymentData.tier,
        sessionId: paymentData.sessionId,
        stripeId: paymentData.stripeId,
      }
    );

    return existing;
  } catch (err) {
    console.error('Admin logger - logRevenue error:', err.message);
    return null;
  }
}

// ── Validation Logging ───────────────────────────────────────────────────────

export async function logValidation(validationData) {
  try {
    const ts = Date.now();
    const record = {
      ts,
      bookId: validationData.bookId || null,
      page: validationData.page || 'unknown',
      attempt: validationData.attempt || 1,
      textScore: validationData.textScore || 0,
      faceScore: validationData.faceScore || 0,
      sceneAccuracy: validationData.sceneAccuracy || 0,
      formatOk: validationData.formatOk !== false,
      pass: validationData.pass || false,
      issues: validationData.issues || [],
      fixNotes: validationData.fixNotes || '',
    };

    await kv.set(`admin:validations:${ts}`, record, { ex: SEVEN_DAYS });
    await kv.zadd('admin:validations_index', {
      score: ts,
      member: `${ts}`,
    });

    // Log event if validation failed
    if (!record.pass) {
      await logEvent('validation_retry', {
        bookId: record.bookId,
        page: record.page,
        textScore: record.textScore,
        faceScore: record.faceScore,
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
  try {
    await kv.set(`admin:postgame:${bookId}`, {
      bookId,
      analyzedAt: new Date().toISOString(),
      ...analysis,
    });

    await kv.zadd('admin:postgame_index', {
      score: Date.now(),
      member: bookId,
    });

    return true;
  } catch (err) {
    console.error('Admin logger - logPostGameAnalysis error:', err.message);
    return false;
  }
}

// ── User Logging ─────────────────────────────────────────────────────────────

export async function logUser(userData) {
  try {
    const userId = userData.userId || 'anonymous';
    const key = `admin:users:${userId}`;

    const existing = await kv.get(key) || {
      userId,
      email: null,
      firstSeen: new Date().toISOString(),
      lastActive: null,
      bookCount: 0,
      totalSpent: 0,
      vaultCharacters: 0,
    };

    existing.lastActive = new Date().toISOString();
    if (userData.email) existing.email = userData.email;
    if (userData.bookCreated) existing.bookCount += 1;
    if (userData.amountPaid) existing.totalSpent += userData.amountPaid;
    if (userData.vaultCharacters !== undefined) existing.vaultCharacters = userData.vaultCharacters;

    await kv.set(key, existing);

    // Add to user index
    await kv.zadd('admin:users_index', {
      score: Date.now(),
      member: userId,
    });

    return existing;
  } catch (err) {
    console.error('Admin logger - logUser error:', err.message);
    return null;
  }
}

// ── Daily Stats Update ───────────────────────────────────────────────────────

async function updateDailyStats(bookRecord) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `admin:daily:${today}`;

    const existing = await kv.get(key) || {
      date: today,
      books: {
        total: 0, healthy: 0, warnings: 0, failed: 0,
        byTier: { standard: 0, premium: 0 },
        byStyle: {},
      },
      revenue: { gross: 0, costs: 0, net: 0, transactions: 0, failed: 0 },
      api: {
        anthropic: { calls: 0, errors: 0, totalMs: 0, cost: 0 },
        replicate: { calls: 0, errors: 0, totalMs: 0, cost: 0 },
        elevenlabs: { calls: 0, errors: 0, totalMs: 0, cost: 0 },
      },
      quality: { totalTextScore: 0, totalFaceScore: 0, scoreCount: 0, firstPassCount: 0, totalValidations: 0, retryCount: 0 },
      users: { active: 0, new: 0, returning: 0 },
    };

    // Update book stats
    existing.books.total += 1;
    if (bookRecord.status === 'healthy') existing.books.healthy += 1;
    else if (bookRecord.status === 'warnings') existing.books.warnings += 1;
    else existing.books.failed += 1;

    const tier = bookRecord.tier || 'standard';
    existing.books.byTier[tier] = (existing.books.byTier[tier] || 0) + 1;

    const style = bookRecord.style || 'unknown';
    existing.books.byStyle[style] = (existing.books.byStyle[style] || 0) + 1;

    // Update costs
    existing.revenue.costs += bookRecord.totalCost || 0;
    existing.revenue.net = existing.revenue.gross - existing.revenue.costs;

    // Update quality from validations
    if (bookRecord.validations && bookRecord.validations.length > 0) {
      for (const v of bookRecord.validations) {
        if (v.textScore) existing.quality.totalTextScore += v.textScore;
        if (v.faceScore) existing.quality.totalFaceScore += v.faceScore;
        existing.quality.scoreCount += 1;
        existing.quality.totalValidations += 1;
        if (v.attempt === 1 && v.pass) existing.quality.firstPassCount += 1;
        if (v.attempt > 1) existing.quality.retryCount += 1;
      }
    }

    await kv.set(key, existing);
    return existing;
  } catch (err) {
    console.error('Admin logger - updateDailyStats error:', err.message);
    return null;
  }
}

// ── Update Daily API Stats ───────────────────────────────────────────────────

export async function updateDailyApiStats(service, durationMs, cost, isError) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const key = `admin:daily:${today}`;

    const existing = await kv.get(key) || {
      date: today,
      books: { total: 0, healthy: 0, warnings: 0, failed: 0, byTier: {}, byStyle: {} },
      revenue: { gross: 0, costs: 0, net: 0, transactions: 0, failed: 0 },
      api: {
        anthropic: { calls: 0, errors: 0, totalMs: 0, cost: 0 },
        replicate: { calls: 0, errors: 0, totalMs: 0, cost: 0 },
        elevenlabs: { calls: 0, errors: 0, totalMs: 0, cost: 0 },
      },
      quality: { totalTextScore: 0, totalFaceScore: 0, scoreCount: 0, firstPassCount: 0, totalValidations: 0, retryCount: 0 },
      users: { active: 0, new: 0, returning: 0 },
    };

    const svc = existing.api[service];
    if (svc) {
      svc.calls += 1;
      if (isError) svc.errors += 1;
      svc.totalMs += durationMs || 0;
      svc.cost += cost || 0;
    }

    await kv.set(key, existing);
  } catch (err) {
    console.error('Admin logger - updateDailyApiStats error:', err.message);
  }
}

// ── Config Management ────────────────────────────────────────────────────────

export async function getConfig(key, defaultValue) {
  try {
    const val = await kv.get(`admin:config:${key}`);
    return val !== null && val !== undefined ? val : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setConfig(key, value) {
  try {
    await kv.set(`admin:config:${key}`, value);
    return true;
  } catch {
    return false;
  }
}

// ── Prompt Override Management ───────────────────────────────────────────────

export async function getPromptOverride(section) {
  try {
    return await kv.get(`admin:prompts:${section}`);
  } catch {
    return null;
  }
}

export async function setPromptOverride(section, text) {
  try {
    await kv.set(`admin:prompts:${section}`, text);
    return true;
  } catch {
    return false;
  }
}

// ── Experiment Management ────────────────────────────────────────────────────

export async function getActiveExperiment(target) {
  try {
    const expIds = await kv.zrange('admin:experiments_index', 0, -1);
    for (const id of expIds) {
      const exp = await kv.get(`admin:experiments:${id}`);
      if (exp && exp.status === 'running' && exp.target === target) {
        return exp;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function logExperimentBookResult(experimentId, variant, scores) {
  try {
    const exp = await kv.get(`admin:experiments:${experimentId}`);
    if (!exp) return false;

    const v = variant === 'B' ? exp.variantB : exp.variantA;
    v.bookCount = (v.bookCount || 0) + 1;

    // Running average
    if (scores.textScore !== undefined) {
      v.avgTextScore = ((v.avgTextScore || 0) * (v.bookCount - 1) + scores.textScore) / v.bookCount;
    }
    if (scores.overallScore !== undefined) {
      v.avgOverall = ((v.avgOverall || 0) * (v.bookCount - 1) + scores.overallScore) / v.bookCount;
    }

    await kv.set(`admin:experiments:${experimentId}`, exp);
    return true;
  } catch {
    return false;
  }
}

// ── User Feedback Logging ────────────────────────────────────────────────────

export async function logUserFeedback(bookId, feedback) {
  try {
    await kv.set(`admin:feedback:${bookId}`, {
      bookId,
      submittedAt: new Date().toISOString(),
      stars: feedback.stars || 0,
      reaction: feedback.reaction || null,
      comment: feedback.comment || null,
    });

    await kv.zadd('admin:feedback_index', {
      score: Date.now(),
      member: bookId,
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
