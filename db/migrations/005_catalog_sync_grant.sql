-- Catalog upserts refresh the merchant SKU along with price and inventory.
grant update(sku) on negotiation.products to negotiation_app;
