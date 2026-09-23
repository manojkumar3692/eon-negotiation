const labels = {
  manual: "Manual snapshot",
  custom: "Custom API sync",
  shopify: "Shopify sync",
};

export function catalogSource(source) {
  return {
    label: labels[source] || "Imported catalog",
    detail: source === "manual" ? "Entered by the merchant" : "Latest synchronized stock snapshot",
  };
}

export function connectorCapabilities(installation) {
  if (installation?.result?.capabilities) return installation.result.capabilities;
  // Older successful cart tests replaced the capability envelope with context.
  // Ready is assigned only after all mandatory capabilities and economics pass.
  if (installation?.status === "ready" && installation.result?.operation === "context" && installation.result.checkoutSupported === true) {
    return {catalog: Boolean(installation.config?.catalogSync?.total), inventory: true, economics: true, checkout: true, reconciliation: true, events: true};
  }
  return {};
}

export function connectorReadiness(installation) {
  const capabilities = connectorCapabilities(installation);
  const catalog = capabilities.catalog === true;
  const inventory = capabilities.inventory === true;
  const economics = capabilities.economics === true;
  const checkout = capabilities.checkout === true;
  const reconciliation = capabilities.reconciliation === true;
  const events = capabilities.events === true;
  const negotiationReady = inventory && economics && checkout && reconciliation && events;
  return {
    catalog,
    inventory,
    economics,
    checkout,
    reconciliation,
    events,
    negotiationReady,
    catalogOnly: catalog && !negotiationReady,
    missing: [
      !inventory && "exact-cart inventory",
      !economics && "approved economics",
      !checkout && "enforceable checkout",
      !reconciliation && "checkout reconciliation",
      !events && "payment events",
    ].filter(Boolean),
  };
}

const diagnostics = {
  CONNECTOR_UNAUTHORIZED: "The merchant endpoint rejected the installation credential. Confirm the saved installation ID and one server-side secret.",
  CONNECTOR_FORBIDDEN: "The merchant endpoint understood the request but denied it. Check its installation binding and access policy.",
  CONNECTOR_HTTP_401_NON_JSON: "The endpoint returned a non-JSON 401. If this deployment uses access protection, allow machine access for this connector route; otherwise inspect merchant authentication.",
  CONNECTOR_DISABLED: "The merchant connector is disabled. Enable only the connector route in the merchant backend, then check capabilities again.",
  CONNECTOR_MISCONFIGURED: "The merchant endpoint is missing required server-side settings. Compare its workspace, installation and secret values with this connection.",
  CONNECTOR_NONCE_STORAGE_UNAVAILABLE: "The merchant could not claim request nonces. Apply its connector nonce-storage migration before retrying.",
  CONNECTOR_UNAVAILABLE: "The merchant endpoint returned 503. Check its deployment health and connector settings.",
  CONNECTOR_UNREACHABLE: "The endpoint could not be reached before timeout. Check the URL, public deployment and network logs.",
  CONNECTOR_DNS_UNRESOLVED: "The connector hostname does not resolve publicly yet. Check the DNS record and wait for propagation.",
  CONNECTOR_SCHEMA_INVALID: "The endpoint response does not match connector contract v3. Validate the operation schema in the merchant backend.",
  CONNECTOR_INVALID_JSON: "The endpoint returned malformed JSON. Inspect the merchant route response without exposing secrets.",
  CONNECTOR_RESPONSE_STALE: "The endpoint returned an expired or invalid response time. Check the merchant server clock and response expiry.",
  CONNECTOR_UNSUPPORTED: "This operation is intentionally unsupported by the merchant connector.",
  CHECKOUT_UNSUPPORTED: "Checkout enforcement is not available for this connection. Complete the merchant checkout adapter before live activation.",
};

export function connectorDiagnostic(code) {
  if (!code) return "";
  return diagnostics[code] || `Connector check failed (${code}). Review the merchant endpoint logs for this request.`;
}

export function backendEnvironment(workspaceId, installationId, secret) {
  return [
    `NEGOTIATION_ENABLED=true`,
    `NEGOTIATION_WORKSPACE_ID=${workspaceId}`,
    `NEGOTIATION_INSTALLATION_ID=${installationId}`,
    `NEGOTIATION_CONNECTOR_SECRET=${secret}`,
  ].join("\n");
}

export function shouldRefreshWorkspace(action) {
  return action === "sync";
}
