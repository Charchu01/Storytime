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

// Generate an image. referencePhotoUrl should be an HTTP URL (from uploadPhoto), NOT base64.
export async function generateImage(prompt, aspectRatio = "16:9", referencePhotoUrl = null, model = null) {
  let response;
  try {
    response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, aspectRatio, referencePhotoUrl, model }),
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
