#!/bin/bash
# Test that formats and styles are properly loaded from database

set -e

echo "🎬 Testing Format & Visual Style Integration"
echo ""

# Database connection
DB_URL="postgresql://postgres:password@localhost:5432/nextjs_boilerplate"
export PGPASSWORD=password

echo "📋 Formats in Database:"
psql -h localhost -U postgres -d nextjs_boilerplate -t -c \
  "SELECT '  •', label, '(', key, ')' FROM \"VideoFormat\" WHERE \"organizationId\" IS NULL AND \"deletedAt\" IS NULL ORDER BY label;" | tr -d '\n' | sed 's/  •/\n  •/g'

echo ""
echo ""
echo "🎨 Visual Styles in Database:"
psql -h localhost -U postgres -d nextjs_boilerplate -t -c \
  "SELECT '  •', label, '(', key, ')' FROM \"VisualStyle\" WHERE \"organizationId\" IS NULL AND \"deletedAt\" IS NULL ORDER BY label;" | tr -d '\n' | sed 's/  •/\n  •/g'

echo ""
echo ""
echo "✅ Schema Validation:"

# Verify formats have required fields
FORMATS_VALID=$(psql -h localhost -U postgres -d nextjs_boilerplate -t -c \
  "SELECT COUNT(*) FROM \"VideoFormat\" WHERE \"organizationId\" IS NULL AND \"deletedAt\" IS NULL
   AND label IS NOT NULL AND key IS NOT NULL AND structure IS NOT NULL AND paragraphs > 0;")

# Verify styles have required fields
STYLES_VALID=$(psql -h localhost -U postgres -d nextjs_boilerplate -t -c \
  "SELECT COUNT(*) FROM \"VisualStyle\" WHERE \"organizationId\" IS NULL AND \"deletedAt\" IS NULL
   AND label IS NOT NULL AND key IS NOT NULL AND \"artDirection\" IS NOT NULL;")

echo "   Formats with all required fields: $FORMATS_VALID"
echo "   Styles with all required fields: $STYLES_VALID"

if [ "$FORMATS_VALID" -gt 0 ] && [ "$STYLES_VALID" -gt 0 ]; then
  echo ""
  echo "✨ All systems ready for video generation!"
  echo "   • Formats: Load via useVideoFormats() hook"
  echo "   • Styles: Load via useVisualStyles() hook"
  echo "   • API: POST /api/generate-storyboard with format + style"
else
  echo "❌ Missing required fields in formats or styles"
  exit 1
fi
