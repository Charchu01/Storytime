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

function friendlyError(status, fallback) {
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

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Story API returned non-JSON response (status ${response.status}). Check that API routes are accessible.`);
  }

  if (!response.ok) {
    throw new Error(data.error || friendlyError(response.status));
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
  referencePhotoUrl = null,
  tier = "standard",
  style = null,
  referenceImageUrls = [],
  aspectRatio = "3:4",
  isCover = false
) {
  let response;
  try {
    response = await fetchWithRetry("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        referencePhotoUrl,
        referenceImageUrls,
        tier,
        style,
        aspectRatio,
        isCover,
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

  const { predictionId } = data;
  if (!predictionId) {
    throw new Error("No prediction ID returned");
  }

  const POLL_INTERVAL = 2500;
  const MAX_POLLS = 48;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    let pollRes;
    try {
      pollRes = await fetch(`/api/poll-image?id=${predictionId}`);
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
  try {
    const response = await fetchWithRetry("/api/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, storySessionId }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(friendlyError(response.status, data.error));
    return data.clientSecret;
  } catch (err) {
    throw new Error(err.message || "Something went wrong setting up payment. Please try again.");
  }
}

export async function checkPayment(sessionId) {
  try {
    const response = await fetch(`/api/check-payment?sessionId=${sessionId}`);
    const data = await response.json();
    if (!response.ok) throw new Error(friendlyError(response.status, data.error));
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to check payment status.");
  }
}

// ── Family Vault helpers ────────────────────────────────────────────────────

export async function getVaultCharacters(userId = "anonymous") {
  try {
    const response = await fetch(`/api/vault?userId=${userId}`);
    const data = await response.json();
    if (!response.ok) throw new Error(friendlyError(response.status, data.error));
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
    const data = await response.json();
    if (!response.ok) throw new Error(friendlyError(response.status, data.error));
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
    const data = await response.json();
    if (!response.ok) throw new Error(friendlyError(response.status, data.error));
    return data;
  } catch (err) {
    throw new Error(err.message || "Failed to delete character.");
  }
}
