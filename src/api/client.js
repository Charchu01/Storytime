const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export async function claudeCall(system, userMsg, maxTokens = 1400) {
  const response = await fetch(`${API_BASE}/api/claude`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, userMsg, maxTokens }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `API error (${response.status})`);
  }

  return data.text;
}

export async function generateImage(prompt, aspectRatio = "3:4") {
  const response = await fetch(`${API_BASE}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, aspectRatio }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Image generation failed (${response.status})`);
  }

  return data.imageUrl;
}
