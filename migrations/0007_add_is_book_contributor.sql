/**
 * Add isBookContributor field to guest_profiles table
 *
 * This field tracks whether a guest appeared in "The Social Justice Investor" book.
 * The goal is to pair book contributors (financial market experts) with non-contributors
 * to cover diverse topics and expand the network.
 */

-- Add isBookContributor column to guest_profiles
ALTER TABLE guest_profiles ADD COLUMN is_book_contributor INTEGER NOT NULL DEFAULT 0 CHECK (is_book_contributor IN (0, 1));

-- Create index for filtering by book contributor status
CREATE INDEX IF NOT EXISTS idx_guest_profiles_is_book_contributor ON guest_profiles(is_book_contributor);
