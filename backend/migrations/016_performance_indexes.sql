-- Apply after the complete setup through migration 015.
-- Existing scope/date and unique indexes are retained; these cover additional
-- product filters, ordered catalogue pages, relation lookups and settlements.
-- Run before launch or during a quiet period: standard index builds lock writes.
begin;
set local lock_timeout = '10s';
create index if not exists products_store_status_created
 on public.store_products(store_id,status,created_at desc,id);
create index if not exists products_active_store_id
 on public.store_products(store_id,id) where status='Active';
create index if not exists products_active_store_stock
 on public.store_products(store_id,stock) where status='Active';
create index if not exists categories_store_id
 on public.store_categories(store_id,id);
create index if not exists trade_inventory_store_id
 on public.store_trade_inventory(store_id,id);
create index if not exists field_agents_store_id
 on public.store_field_agents(store_id,id);
create index if not exists applications_product
 on public.customer_applications(product_id);
create index if not exists payments_application_created
 on public.application_payments(application_id,created_at desc,id);
create index if not exists events_application_created
 on public.application_events(application_id,created_at desc,id);
create index if not exists settlement_items_settlement_id
 on public.agent_settlement_items(settlement_id,id);
create index if not exists support_tickets_user_id
 on public.support_tickets(user_id,id);
create index if not exists support_messages_ticket_order
 on public.support_messages(ticket_id,created_at,id);
commit;
