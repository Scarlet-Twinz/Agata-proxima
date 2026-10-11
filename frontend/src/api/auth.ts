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
  const response = await fetch("/api/v1/session", { method:"GET", credentials:"include", headers:{Accept:"application/json"} });
  if (response.status === 401) return null;
  return readResponse<Session>(response);
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch("/api/v1/auth/login", {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email,password}),
  });
  const data = await readResponse<AuthResponse>(response);
  sessionStorage.setItem("proxima_csrf", data.csrf_token);
  return data;
}

export async function signup(input: {name:string;organization:string;email:string;password:string}): Promise<SignupResponse> {
  const response = await fetch("/api/v1/auth/signup", {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(input),
  });
  return readResponse<SignupResponse>(response);
}

export async function verifyEmailCode(email: string, code: string): Promise<{ok:boolean;verified:boolean;message:string}> {
  const response = await fetch("/api/v1/auth/verification/confirm", {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email,code}),
  });
  return readResponse<{ok:boolean;verified:boolean;message:string}>(response);
}

export async function resendVerification(email: string): Promise<{ok:boolean;message:string}> {
  const response = await fetch("/api/v1/auth/verification/resend", {
    method:"POST", credentials:"include",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email}),
  });
  return readResponse<{ok:boolean;message:string}>(response);
}

export async function logout(): Promise<void> {
  const csrf = sessionStorage.getItem("proxima_csrf") ?? "";
  await fetch("/api/v1/auth/logout", {
    method:"POST", credentials:"include",
    headers:{"x-csrf-token":csrf},
  });
  sessionStorage.removeItem("proxima_csrf");
}
