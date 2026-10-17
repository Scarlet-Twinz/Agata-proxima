package main

import (
  "context"
  "net/url"

  "github.com/hashicorp/terraform-plugin-framework/datasource"
  "github.com/hashicorp/terraform-plugin-framework/provider"
  providerschema "github.com/hashicorp/terraform-plugin-framework/provider/schema"
  "github.com/hashicorp/terraform-plugin-framework/resource"
  "github.com/hashicorp/terraform-plugin-framework/schema/validator"
  "github.com/hashicorp/terraform-plugin-framework/types"
  "github.com/hashicorp/terraform-plugin-framework-validators/stringvalidator"
  "github.com/hashicorp/terraform-plugin-framework/diag"
)

type providerModel struct {
  BaseURL types.String `tfsdk:"base_url"`
  APIKey types.String `tfsdk:"api_key"`
}

type AgataProvider struct{}
func NewProvider() provider.Provider { return &AgataProvider{} }

func (p *AgataProvider) Metadata(_ context.Context, _ provider.MetadataRequest, resp *provider.MetadataResponse) {
  resp.TypeName = "agata"
}
func (p *AgataProvider) Schema(_ context.Context, _ provider.SchemaRequest, resp *provider.SchemaResponse) {
  resp.Schema = providerschema.Schema{Attributes: map[string]providerschema.Attribute{
    "base_url": providerschema.StringAttribute{Required:true, Description:"Agata Proxima Control Plane origin, for example https://api.example.com."},
    "api_key": providerschema.StringAttribute{Required:true, Sensitive:true, Description:"Organization-scoped Agata API key. Prefer AGATA_API_KEY from a secret manager."},
  }}
}
func (p *AgataProvider) Configure(ctx context.Context, req provider.ConfigureRequest, resp *provider.ConfigureResponse) {
  var config providerModel
  resp.Diagnostics.Append(req.Config.Get(ctx, &config)...)
  if resp.Diagnostics.HasError() { return }
  rawURL := config.BaseURL.ValueString()
  parsed, err := url.Parse(rawURL)
  if err != nil || parsed.Host == "" || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
    resp.Diagnostics.AddAttributeError("Invalid Control Plane URL", "base_url must be a clean HTTP(S) origin without credentials, path, query or fragment.", nil)
    return
  }
  key := config.APIKey.ValueString()
  if len(key) < 8 || len(key) < 4 || key[:4] != "aga_" {
    resp.Diagnostics.AddAttributeError("Invalid API key", "api_key must be an Agata API key beginning with aga_.", nil)
    return
  }
  resp.ResourceData = NewAPIClient(rawURL, key)
}
func (p *AgataProvider) Resources(_ context.Context) []func() resource.Resource {
  return []func() resource.Resource{NewEnvironmentResource}
}
func (p *AgataProvider) DataSources(_ context.Context) []func() datasource.DataSource { return nil }

var _ provider.Provider = (*AgataProvider)(nil)
var _ validator.String = stringvalidator.LengthAtLeast(1)
var _ diag.Diagnostics
