use crate::tenant::TenantContext;
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TenantBinding {
    Unbound,
    Bound(TenantContext),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BindingError {
    AlreadyBound,
    MissingContext,
    ContextExpired,
}

impl fmt::Display for BindingError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::AlreadyBound => write!(f, "tenant context is already bound to this session"),
            Self::MissingContext => write!(f, "tenant context is required"),
            Self::ContextExpired => write!(f, "tenant context has expired"),
        }
    }
}

impl std::error::Error for BindingError {}

impl TenantBinding {
    pub fn bind(
        &mut self,
        context: TenantContext,
        now_unix_seconds: u64,
    ) -> Result<(), BindingError> {
        if now_unix_seconds >= context.expires_at {
            return Err(BindingError::ContextExpired);
        }

        match self {
            Self::Unbound => {
                *self = Self::Bound(context);
                Ok(())
            }
            Self::Bound(_) => Err(BindingError::AlreadyBound),
        }
    }

    pub fn tenant_id(&self, now_unix_seconds: u64) -> Result<&str, BindingError> {
        match self {
            Self::Unbound => Err(BindingError::MissingContext),
            Self::Bound(context) if now_unix_seconds >= context.expires_at => {
                Err(BindingError::ContextExpired)
            }
            Self::Bound(context) => Ok(&context.tenant_id),
        }
    }

    pub fn reset(&mut self) {
        *self = Self::Unbound;
    }

    pub fn is_bound(&self) -> bool {
        matches!(self, Self::Bound(_))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn context(expires_at: u64) -> TenantContext {
        TenantContext {
            tenant_id: "tenant_a".into(),
            expires_at,
        }
    }

    #[test]
    fn binds_once_and_exposes_tenant() {
        let mut binding = TenantBinding::Unbound;

        binding.bind(context(2_000), 1_000).unwrap();

        assert_eq!(binding.tenant_id(1_001).unwrap(), "tenant_a");
        assert!(binding.is_bound());
    }

    #[test]
    fn rejects_rebinding_without_session_reset() {
        let mut binding = TenantBinding::Unbound;
        binding.bind(context(2_000), 1_000).unwrap();

        let other = TenantContext {
            tenant_id: "tenant_b".into(),
            expires_at: 2_000,
        };

        assert_eq!(
            binding.bind(other, 1_000),
            Err(BindingError::AlreadyBound)
        );
        assert_eq!(binding.tenant_id(1_000).unwrap(), "tenant_a");
    }

    #[test]
    fn expired_context_is_not_usable() {
        let mut binding = TenantBinding::Unbound;
        binding.bind(context(2_000), 1_000).unwrap();

        assert_eq!(
            binding.tenant_id(2_000),
            Err(BindingError::ContextExpired)
        );
    }

    #[test]
    fn reset_allows_a_new_session_context() {
        let mut binding = TenantBinding::Unbound;
        binding.bind(context(2_000), 1_000).unwrap();
        binding.reset();

        let other = TenantContext {
            tenant_id: "tenant_b".into(),
            expires_at: 3_000,
        };

        binding.bind(other, 1_000).unwrap();
        assert_eq!(binding.tenant_id(1_001).unwrap(), "tenant_b");
    }

    #[test]
    fn missing_context_fails_closed() {
        let binding = TenantBinding::Unbound;
        assert_eq!(binding.tenant_id(1_000), Err(BindingError::MissingContext));
    }
}
