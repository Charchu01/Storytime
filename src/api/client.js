export async function claudeCall(system, userMsg, maxTokens = 1400, imageDataUrl = null) {
  let response;
  try {
    response = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system, userMsg, maxTokens, imageDataUrl }),
    });
  } catch (err) {
    throw new Error(`Network error calling /api/claude: ${err.message}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const text = await response.text().catch(() => "");
    throw new Error(`/api/claude returned non-JSON (${response.status}): ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(data.error || `API error (${response.status})`);
  }

  return data.text;
}

// Analyze a photo for quality — checks face visibility, lighting, clarity.
// Returns { quality: "good"|"fair"|"poor", feedback: string }
export async function analyzePhotoQuality(photoDataUri) {
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
    return { quality: "fair", feedback: "Couldn't analyze — but we'll try our best!" };
  }
}

// Upload a photo data URI to Replicate file hosting and get back an HTTP URL.
// Call this ONCE before generating images, then reuse the URL for all pages.
export async function uploadPhoto(photoDataUri) {
  let response;
  try {
    response = await fetch("/api/upload-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoDataUri }),
    });
  } catch (err) {
    throw new Error(`Network error uploading photo: ${err.message}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const text = await response.text().catch(() => "");
    throw new Error(`/api/upload-photo returned non-JSON (${response.status}): ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(data.error || `Photo upload failed (${response.status})`);
  }

  return data.photoUrl;
}

// Generate an image using flux-pulid. referencePhotoUrl is an HTTP URL (from uploadPhoto).
export async function generateImage(prompt, referencePhotoUrl = null) {
  let response;
  try {
    response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, referencePhotoUrl }),
    });
  } catch (err) {
    throw new Error(`Network error calling /api/generate-image: ${err.message}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const text = await response.text().catch(() => "");
    throw new Error(`/api/generate-image returned non-JSON (${response.status}): ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(data.error || `Image generation failed (${response.status})`);
  }

  return data.imageUrl;
}
