CREATE TRIGGER public_contact_touch
BEFORE UPDATE ON public_contact_requests
FOR EACH ROW
EXECUTE FUNCTION touch_updated_at()
