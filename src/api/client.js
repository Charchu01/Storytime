// ── Retry helper ──────────────────────────────────────────────────────────────
async function fetchWithRetry(url, options, maxRetries = 1) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Auto-retry on 429
      if (response.status === 429 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      return response;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export function friendlyError(status, fallback) {
  if (status === 429) return "Our servers are busy. Trying again in a moment...";
  if (status === 500) return "Something went wrong on our end. Please try again.";
  if (status === 403) return "There's a configuration issue. Please contact support.";
  return fallback || "Something went wrong. Let's try again.";
}

export async function claudeCall(system, userMsg, maxTokens = 1400, imageDataUrl = null) {
  let response;
  try {
    response = await fetchWithRetry("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, userMsg, maxTokens, imageDataUrl }),
    });
  } catch (err) {
    throw new Error(`Story generation request failed: ${err.message}`);
  }

  if (!response.ok) {
    let errMsg;
    try {
      const errData = await response.json();
      errMsg = errData.error;
    } catch { /* non-JSON error body */ }
    throw new Error(errMsg || friendlyError(response.status));
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Story API returned non-JSON response (status ${response.status}).`);
  }

  return data.text;
}

export async function analyzePhotoQuality(photoDataUri) {
  try {
    const result = await claudeCall(
      `You are a photo quality checker for a children's storybook app. The app uses face-preserving AI illustration — so the uploaded photo MUST have a clear, visible face.

Analyze this photo and return a JSON object with exactly these fields:
- "quality": one of "good", "fair", or "poor"
- "feedback": a short friendly sentence (max 15 words) explaining the result

Scoring rules:
- "good": Clear face visible, decent lighting, face is at least 15% of frame, not blurry
- "fair": Face is visible but has issues (slightly dark, partially turned, a bit blurry, multiple people)
- "poor": No face visible, extremely blurry, too dark to see features, face is tiny/distant, photo is of an object

Return ONLY valid JSON. No markdown, no explanation.`,
      "Please analyze this photo for face quality.",
      150,
      photoDataUri
    );

    try {
      const cleaned = result.replace(/```json\s*|```\s*/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return { quality: "fair", feedback: "Photo looks okay — we'll do our best!" };
    }
  } catch {
    return { quality: "fair", feedback: "Couldn't analyze — but we'll try our best!" };
  }
}

export async function uploadPhoto(photoDataUri) {
  let response;
  try {
    response = await fetchWithRetry("/api/upload-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoDataUri }),
    });
  } catch (err) {
    throw new Error("Something went wrong uploading the photo. Let's try again.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(friendlyError(response.status));
  }

  if (!response.ok) {
    throw new Error(friendlyError(response.status, data.error));
  }

  return data.photoUrl;
}

export async function generateImage(
  prompt,
  characterPhotoUrls = [],
  tier = "standard",
  style = null,
  referenceImageUrls = [],
  aspectRatio = "2:3",
  isCover = false,
  bookId = null,
  clientAttempt = 1
) {
  // Support both new array form and legacy single-URL form
  const charPhotos = Array.isArray(characterPhotoUrls) ? characterPhotoUrls : (characterPhotoUrls ? [characterPhotoUrls] : []);

  let response;
  try {
    response = await fetchWithRetry("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        characterPhotoUrls: charPhotos,
        // Backward compat: also send referencePhotoUrl for older API versions
        referencePhotoUrl: charPhotos[0] || null,
        referenceImageUrls,
        tier,
        style,
        aspectRatio,
        isCover,
        bookId: bookId || null,
        clientAttempt: clientAttempt || 1,
      }),
    });
  } catch (err) {
    throw new Error("Image generation request failed. Please try again.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Image server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(data.error || friendlyError(response.status));
  }

  const { predictionId, faceRefLost } = data;
  if (!predictionId) {
    throw new Error("No prediction ID returned");
  }
  if (faceRefLost) {
    console.warn("FACE_REF_LOST: Image generated WITHOUT hero face reference — character may look different");
  }

  const POLL_INTERVAL = 2500;
  const MAX_POLLS = 48;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    let pollRes;
    try {
      pollRes = await fetch(`/api/poll-image?id=${encodeURIComponent(predictionId)}`);
    } catch {
      continue;
    }

    let pollData;
    try {
      pollData = await pollRes.json();
    } catch {
      continue;
    }

    if (pollData.status === "succeeded") {
      if (!pollData.imageUrl) {
        throw new Error("Image succeeded but no URL returned");
      }
      return pollData.imageUrl;
    }

    if (pollData.status === "failed" || pollData.status === "canceled") {
      throw new Error(pollData.error || `Image generation ${pollData.status}`);
    }
  }

  throw new Error("Image generation timed out after 2 minutes");
}

// ── Payment helpers ─────────────────────────────────────────────────────────

export async function createPaymentIntent(tier, storySessionId) {
  let response;
  try {
    response = await fetchWithRetry("/api/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, storySessionId }),
    });
  } catch (err) {
    throw new Error("Something went wrong setting up payment. Please try again.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(friendlyError(response.status, "Payment service returned an invalid response."));
  }

  if (!response.ok) {
    throw new Error(data.error || friendlyError(response.status));
  }
  return data.clientSecret;
}

export async function checkPayment(sessionId) {
  try {
    const response = await fetch(`/api/check-payment?sessionId=${encodeURIComponent(sessionId)}`);
    if (!response.ok) throw new Error(friendlyError(response.status, "Payment check failed"));
    const data = await response.json();
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to check payment status.");
  }
}

// ── Family Vault helpers ────────────────────────────────────────────────────

export async function getVaultCharacters(userId = "anonymous") {
  try {
    const response = await fetch(`/api/vault?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) throw new Error(friendlyError(response.status, "Vault fetch failed"));
    const data = await response.json();
    return data.characters;
  } catch (err) {
    throw new Error(err.message || "Failed to load saved characters.");
  }
}

export async function saveToVault(character, userId = "anonymous") {
  try {
    const response = await fetchWithRetry("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify(character),
    });
    if (!response.ok) throw new Error(friendlyError(response.status, "Failed to save character"));
    const data = await response.json();
    return data.character;
  } catch (err) {
    throw new Error(err.message || "Failed to save character.");
  }
}

export async function deleteFromVault(characterId, userId = "anonymous") {
  try {
    const response = await fetchWithRetry("/api/vault", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ characterId }),
    });
    if (!response.ok) throw new Error(friendlyError(response.status, "Failed to delete character"));
    const data = await response.json();
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to delete character.");
  }
}

// ── Admin Book Logging ────────────────────────────────────────────────────────

export async function logBookToAdmin(bookData) {
  try {
    const res = await fetch('/api/admin-log-book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookData),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.warn('Admin log-book API error:', res.status, errData.error || '');
    }
  } catch (err) {
    console.warn('Admin log-book failed:', err.message);
  }
}

// ── Admin Feedback Submission ─────────────────────────────────────────────────

export async function submitBookFeedback(bookId, feedback) {
  try {
    const response = await fetch('/api/admin?action=submit_feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, ...feedback }),
    });
    return await response.json();
  } catch {
    return { success: false };
  }
}

// ── Supabase Book Save ──────────────────────────────────────────────────────

export async function saveBookToSupabase(bookData, pages, clerkId, bookId = null) {
  try {
    const response = await fetch('/api/save-book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book: bookData, pages, clerkId, bookId }),
    });
    const data = await response.json();
    return data.bookId || null;
  } catch (err) {
    console.warn('Supabase book save failed:', err.message);
    return null;
  }
}

export async function saveBookImage(imageUrl, bookId, pageType, pageIndex) {
  try {
    const response = await fetch('/api/save-book-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, bookId, pageType, pageIndex }),
    });
    const data = await response.json();
    return data.permanentUrl || imageUrl;
  } catch {
    return imageUrl; // fall back to original URL
  }
}

// ── Image Validation (Claude Vision) ─────────────────────────────────────────

export async function validateImage(
  imageUrl, expectedTexts, heroName,
  artStyle, pageType, sceneDescription, bookId,
  referencePhotoUrl, characterDescriptions, previousPageStyle,
  generationPrompt, clientAttempt
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch("/api/validate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          expectedTexts,
          heroName,
          artStyle,
          pageType,
          sceneDescription,
          bookId: bookId || null,
          referencePhotoUrl: referencePhotoUrl || null,
          characterDescriptions: characterDescriptions || null,
          previousPageStyle: previousPageStyle || null,
          generationPrompt: generationPrompt || null,
          clientAttempt: clientAttempt ?? 1,
        }),
      });
      if (!response.ok) throw new Error(`Validation returned ${response.status}`);
      const data = await response.json();
      return data;
    } catch (err) {
      console.warn(`Validation fetch error (attempt ${attempt + 1}):`, err.message);
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return { pass: false, reason: "network_error", textScore: 0, faceScore: 0, textBoxScore: 0, sceneAccuracy: 0, formatOk: false, issues: ["Validation network error"] };
    }
  }
}
