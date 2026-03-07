export async function createToken(apiBase, email, password) {
  const response = await fetch(`${apiBase}/api/tokens`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status}`);
  }

  return response.json();
}

export async function getRoomByInviteCode(apiBase, token, code) {
  const response = await fetch(`${apiBase}/api/rooms/code/${encodeURIComponent(code)}`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Room lookup failed: ${response.status}`);
  }

  return response.json();
}
