-- Add book_id indexes for faster admin panel queries.
-- The book detail view queries admin_validations and admin_api_calls by book_id.
-- Without indexes, these queries scan the entire table.

CREATE INDEX IF NOT EXISTS idx_admin_validations_book_id ON admin_validations(book_id);
CREATE INDEX IF NOT EXISTS idx_admin_api_calls_book_id ON admin_api_calls(book_id);
