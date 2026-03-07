-- Add prompt column to admin_validations for generation logging.
-- This stores the image generation prompt used for each validation attempt.

ALTER TABLE admin_validations ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE admin_validations ADD COLUMN IF NOT EXISTS image_url TEXT;
