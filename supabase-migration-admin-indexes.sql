-- Add missing indexes and constraints for better query performance and data integrity.
-- Run this in your Supabase SQL Editor.

-- Book detail modal queries admin_validations and admin_api_calls by book_id
CREATE INDEX IF NOT EXISTS idx_admin_validations_book_id ON admin_validations(book_id);
CREATE INDEX IF NOT EXISTS idx_admin_api_calls_book_id ON admin_api_calls(book_id);

-- Admin dashboard filters books by health_status
CREATE INDEX IF NOT EXISTS idx_books_health_status ON books(health_status);

-- Soft-delete queries need to find non-deleted books efficiently
CREATE INDEX IF NOT EXISTS idx_books_deleted_at ON books(deleted_at) WHERE deleted_at IS NULL;

-- Activity log is queried by book_id in relinkBookId
CREATE INDEX IF NOT EXISTS idx_activity_log_book_id ON activity_log(book_id);
