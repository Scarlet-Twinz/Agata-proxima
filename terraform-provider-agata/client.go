package main

import (
  "bytes"
  "context"
  "encoding/json"
  "fmt"
  "io"
  "net/http"
  "strings"
  "time"
)

type APIClient struct { baseURL string; apiKey string; httpClient *http.Client }

func NewAPIClient(baseURL, apiKey string) *APIClient {
  return &APIClient{baseURL: strings.TrimRight(baseURL, "/"), apiKey: apiKey, httpClient: &http.Client{Timeout: 15 * time.Second}}
}

func (c *APIClient) request(ctx context.Context, method, path string, input any, output any) (int, error) {
  var body io.Reader
  if input != nil {
    encoded, err := json.Marshal(input)
    if err != nil { return 0, fmt.Errorf("encode request: %w", err) }
    body = bytes.NewReader(encoded)
  }
  req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
  if err != nil { return 0, fmt.Errorf("build request: %w", err) }
  req.Header.Set("Accept", "application/json")
  req.Header.Set("Author"+"ization", "Bearer "+c.apiKey)
  if input != nil { req.Header.Set("Content-Type", "application/json") }
  response, err := c.httpClient.Do(req)
  if err != nil { return 0, fmt.Errorf("request Agata Control Plane: %w", err) }
  defer response.Body.Close()
  raw, err := io.ReadAll(io.LimitReader(response.Body, 2097152))
  if err != nil { return response.StatusCode, fmt.Errorf("read API response: %w", err) }
  if response.StatusCode < 200 || response.StatusCode >= 300 {
    message := strings.TrimSpace(string(raw))
    if len(message) > 500 { message = message[:500] }
    return response.StatusCode, fmt.Errorf("Agata API returned HTTP %d: %s", response.StatusCode, message)
  }
  if output != nil && len(raw) > 0 {
    if err := json.Unmarshal(raw, output); err != nil { return response.StatusCode, fmt.Errorf("decode API response: %w", err) }
  }
  return response.StatusCode, nil
}
