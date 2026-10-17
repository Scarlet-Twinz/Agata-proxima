package main

import (
  "context"
  "fmt"

  "github.com/hashicorp/terraform-plugin-framework/diag"
  "github.com/hashicorp/terraform-plugin-framework/resource"
  "github.com/hashicorp/terraform-plugin-framework/resource/schema"
  "github.com/hashicorp/terraform-plugin-framework/resource/schema/planmodifier"
  "github.com/hashicorp/terraform-plugin-framework/resource/schema/stringplanmodifier"
  "github.com/hashicorp/terraform-plugin-framework/types"
)

type environmentModel struct {
  ID types.String `tfsdk:"id"`
  Name types.String `tfsdk:"name"`
  Slug types.String `tfsdk:"slug"`
  Description types.String `tfsdk:"description"`
  Status types.String `tfsdk:"status"`
}
type environmentRecord struct {
  ID string `json:"id"`
  Name string `json:"name"`
  Slug string `json:"slug"`
  Description string `json:"description"`
  Status string `json:"status"`
}
type environmentResource struct { client *APIClient }

func NewEnvironmentResource() resource.Resource { return &environmentResource{} }
func (r *environmentResource) Metadata(_ context.Context, req resource.MetadataRequest, resp *resource.MetadataResponse) {
  resp.TypeName = req.ProviderTypeName + "_environment"
}
func (r *environmentResource) Schema(_ context.Context, _ resource.SchemaRequest, resp *resource.SchemaResponse) {
  resp.Schema = schema.Schema{Description:"Manages a named Agata Proxima environment. Environments are deployment-stage records inside an organization; they do not provision infrastructure or isolate databases/networks.", Attributes:map[string]schema.Attribute{
    "id": schema.StringAttribute{Computed:true, Description:"Control Plane environment UUID."},
    "name": schema.StringAttribute{Required:true, Description:"Human-readable environment name."},
    "slug": schema.StringAttribute{Optional:true, Computed:true, PlanModifiers:[]planmodifier.String{stringplanmodifier.RequiresReplace()}, Description:"Stable URL-safe slug. Changes require replacement."},
    "description": schema.StringAttribute{Optional:true, Description:"Purpose of this stage."},
    "status": schema.StringAttribute{Optional:true, Computed:true, Description:"Environment status: active or disabled."},
  }}
}
func (r *environmentResource) Configure(_ context.Context, req resource.ConfigureRequest, resp *resource.ConfigureResponse) {
  if req.ProviderData == nil { return }
  client, ok := req.ProviderData.(*APIClient)
  if !ok { resp.Diagnostics.AddError("Unexpected Resource Configure Type", fmt.Sprintf("Expected *APIClient, got %T.", req.ProviderData)); return }
  r.client = client
}
func (r *environmentResource) Create(ctx context.Context, req resource.CreateRequest, resp *resource.CreateResponse) {
  var plan environmentModel
  resp.Diagnostics.Append(req.Plan.Get(ctx,&plan)...)
  if resp.Diagnostics.HasError() { return }
  payload := map[string]any{"name":plan.Name.ValueString(),"description":plan.Description.ValueString()}
  if !plan.Slug.IsNull() && !plan.Slug.IsUnknown() && plan.Slug.ValueString()!="" { payload["slug"]=plan.Slug.ValueString() }
  var created environmentRecord
  _, err := r.client.request(ctx,"POST","/api/v1/developer/environments",payload,&created)
  if err != nil { resp.Diagnostics.AddError("Create Environment Failed",err.Error()); return }
  plan.ID=types.StringValue(created.ID); plan.Name=types.StringValue(created.Name); plan.Slug=types.StringValue(created.Slug); plan.Description=types.StringValue(created.Description); plan.Status=types.StringValue(created.Status)
  resp.Diagnostics.Append(resp.State.Set(ctx,&plan)...)
}
func (r *environmentResource) Read(ctx context.Context, req resource.ReadRequest, resp *resource.ReadResponse) {
  var state environmentModel
  resp.Diagnostics.Append(req.State.Get(ctx,&state)...)
  if resp.Diagnostics.HasError() { return }
  var records []environmentRecord
  _, err := r.client.request(ctx,"GET","/api/v1/developer/environments",nil,&records)
  if err != nil { resp.Diagnostics.AddError("Read Environments Failed",err.Error()); return }
  for _, record := range records {
    if record.ID==state.ID.ValueString() {
      state.Name=types.StringValue(record.Name); state.Slug=types.StringValue(record.Slug); state.Description=types.StringValue(record.Description); state.Status=types.StringValue(record.Status)
      resp.Diagnostics.Append(resp.State.Set(ctx,&state)...); return
    }
  }
  resp.State.RemoveResource(ctx)
}
func (r *environmentResource) Update(ctx context.Context, req resource.UpdateRequest, resp *resource.UpdateResponse) {
  var plan environmentModel
  resp.Diagnostics.Append(req.Plan.Get(ctx,&plan)...)
  if resp.Diagnostics.HasError() { return }
  payload := map[string]any{"name":plan.Name.ValueString(),"description":plan.Description.ValueString()}
  if !plan.Status.IsNull() && !plan.Status.IsUnknown() && plan.Status.ValueString()!="" { payload["status"]=plan.Status.ValueString() }
  var updated environmentRecord
  _, err := r.client.request(ctx,"PATCH","/api/v1/developer/environments/"+plan.ID.ValueString(),payload,&updated)
  if err != nil { resp.Diagnostics.AddError("Update Environment Failed",err.Error()); return }
  plan.Name=types.StringValue(updated.Name); plan.Slug=types.StringValue(updated.Slug); plan.Description=types.StringValue(updated.Description); plan.Status=types.StringValue(updated.Status)
  resp.Diagnostics.Append(resp.State.Set(ctx,&plan)...)
}
func (r *environmentResource) Delete(ctx context.Context, req resource.DeleteRequest, resp *resource.DeleteResponse) {
  var state environmentModel
  resp.Diagnostics.Append(req.State.Get(ctx,&state)...)
  if resp.Diagnostics.HasError() { return }
  status, err := r.client.request(ctx,"DELETE","/api/v1/developer/environments/"+state.ID.ValueString(),nil,nil)
  if err != nil && status!=404 { resp.Diagnostics.AddError("Delete Environment Failed",err.Error()) }
}

var _ resource.Resource = (*environmentResource)(nil)
var _ = diag.Diagnostics{}
