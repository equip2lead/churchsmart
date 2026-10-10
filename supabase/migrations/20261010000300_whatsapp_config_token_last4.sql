-- The Settings UI must show the saved access token as its last 4 characters
-- only. Storing that tail separately lets the client select it without ever
-- fetching api_token itself, so the secret never reaches the browser.
-- Generated rather than app-maintained so it cannot drift from the token.
--
-- NOTE: already applied to the remote project; kept here as the record.
alter table whatsapp_config
  add column if not exists api_token_last4 text
  generated always as (right(api_token, 4)) stored;
