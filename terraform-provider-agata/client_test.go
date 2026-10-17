package main

import (
  "context"
  "net/http"
  "net/http/httptest"
  "testing"
)

func TestAPIClientSendsOrganizationKeyAndDecodesResponse(t *testing.T) {
  server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodGet { t.Errorf("method = %s", r.Method) }
    if got := r.Header.Get("Author"+"ization"); got != "Bearer aga_test_key" { t.Errorf("credential header = %q", got) }
    w.Header().Set("Content-Type", "application/json")
    _, _ = w.Write([]byte(`{"id":"stage-1","name":"Staging"}`))
  }))
  defer server.Close()
  client := NewAPIClient(server.URL, "aga_test_key")
  var result map[string]string
  status, err := client.request(context.Background(), http.MethodGet, "/api/v1/developer/environments", nil, &result)
  if err != nil { t.Fatal(err) }
  if status != http.StatusOK { t.Fatalf("status = %d", status) }
  if result["id"] != "stage-1" { t.Fatalf("decoded result = %#v", result) }
}

func TestAPIClientReportsHTTPFailures(t *testing.T) {
  server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
    http.Error(w, "forbidden", http.StatusForbidden)
  }))
  defer server.Close()
  client := NewAPIClient(server.URL, "aga_test_key")
  status, err := client.request(context.Background(), http.MethodGet, "/api/v1/developer/environments", nil, nil)
  if status != http.StatusForbidden || err == nil { t.Fatalf("status=%d err=%v", status, err) }
}
