export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");

  const headers = {
    ...options.headers,
    "Authorization": `Bearer ${token}`,
  };

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("auth_token");
    window.location.assign("/login.html");
  }

  return response;
}
