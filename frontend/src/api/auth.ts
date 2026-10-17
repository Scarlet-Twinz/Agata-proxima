import { API_BASE } from "./client";

export type Session = {
  authenticated: boolean;
  user_id: string;
  organization_id: string;
  role: string;
  csrf_token: string;
};

export type AuthResponse = {
  user_id: string;
  organization_id: string;
  csrf_token: string;
};

export type SignupResponse = {
  ok: boolean;
  verification_required: boolean;
  email_sent?: boolean;
  user_id: string;
  organization_id: string;
  message: string;
};

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.message === "string" ? data.message : "Request failed.");
  }
  return data as T;
}

export async function getSession(): Promise<Session | null> {
  const response = await fetch(`${API_BASE}/api/v1/session`, { method:"GET", credentials:"include", headers:{Accept:"application/json"}, cache:"no-store" });
  if (response.status === 401) {
    sessionStorage.removeItem("proxima_csrf");
    return null;
  }
  const session = await readResponse<Session>(response);
  // Rehydrate the CSRF token from the server-verified session after a browser
  // restart so a remembered sign-in can perform protected actions and logout.
  if (session.authenticated && session.csrf_token) {
    sessionStorage.setItem("proxima_csrf", session.csrf_token);
  }
  return session;
}

export async function login(email: string, password: string, rememberMe = false): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email,password,remember_me:rememberMe}),
  });
  const data = await readResponse<AuthResponse>(response);
  sessionStorage.setItem("proxima_csrf", data.csrf_token);
  return data;
}

export async function requestPasswordReset(email: string): Promise<{ok:boolean;message:string}> {
  const response = await fetch(`${API_BASE}/api/v1/auth/password-reset/request`, {
    method: "POST",
    credentials: "include",
    headers: {"Content-Type":"application/json", Accept:"application/json"},
    body: JSON.stringify({email}),
  });
  return readResponse<{ok:boolean;message:string}>(response);
}

export async function resetPassword(token: string, password: string): Promise<{ok:boolean;message:string}> {
  const response = await fetch(`${API_BASE}/api/v1/auth/password-reset/confirm`, {
    method: "POST",
    credentials: "include",
    headers: {"Content-Type":"application/json", Accept:"application/json"},
    body: JSON.stringify({token,password}),
  });
  return readResponse<{ok:boolean;message:string}>(response);
}

export async function signup(input: {name:string;organization:string;email:string;password:string}): Promise<SignupResponse> {
  const response = await fetch(`${API_BASE}/api/v1/auth/signup`, {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(input),
  });
  return readResponse<SignupResponse>(response);
}

export async function verifyEmailCode(email: string, code: string): Promise<{ok:boolean;verified:boolean;message:string}> {
  const response = await fetch(`${API_BASE}/api/v1/auth/verification/confirm`, {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email,code}),
  });
  return readResponse<{ok:boolean;verified:boolean;message:string}>(response);
}

export async function resendVerification(email: string): Promise<{ok:boolean;message:string}> {
  const response = await fetch(`${API_BASE}/api/v1/auth/verification/resend`, {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email}),
  });
  return readResponse<{ok:boolean;message:string}>(response);
}

export async function logout(): Promise<void> {
  const csrf = sessionStorage.getItem("proxima_csrf") ?? "";
  await fetch(`${API_BASE}/api/v1/auth/logout`, {
    method:"POST", credentials:"include",
    headers:{"x-csrf-token":csrf},
  });
  sessionStorage.removeItem("proxima_csrf");
}
